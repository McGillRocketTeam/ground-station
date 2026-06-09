package org.yamcs.labjack;

import java.util.Arrays;
import java.util.Map;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import libs.LJMException;
import org.yamcs.StandardTupleDefinitions;
import org.yamcs.TmPacket;
import org.yamcs.YConfiguration;
import org.yamcs.commanding.ArgumentValue;
import org.yamcs.commanding.PreparedCommand;
import org.yamcs.tctm.AbstractTcTmParamLink;
import org.yamcs.xtce.Argument;
import org.yamcs.yarch.DataType;
import org.yamcs.yarch.Stream;
import org.yamcs.yarch.Tuple;
import org.yamcs.yarch.TupleDefinition;
import org.yamcs.yarch.YarchDatabase;
import org.yamcs.yarch.YarchDatabaseInstance;

/**
 * YAMCS data link for the LabJack T7. Streams AIN0-13 in stream mode, polls the digital lines, packs
 * each scan into the {@code /LabJackT7/LabJackPacket} container, and writes a full-rate local CSV.
 *
 * <p>Design (see {@code docs/test-reports} + the refactor summary):
 * <ul>
 *   <li><b>Supervised acquisition</b> — a single thread owns the
 *       {@code DISCONNECTED → CONNECTING → STREAMING → RECONNECTING} lifecycle. A stream read that
 *       fails with a disconnect-class LJM error (e.g. the T7 is powered off) tears down and transparently
 *       re-establishes the stream once the device returns — fixing the old "stuck after E_STREAM_READ_FAIL"
 *       behaviour.</li>
 *   <li><b>Dual-rate</b> — every scan goes to the CSV (full rate). The realtime/frontend path is
 *       decimated by {@link LabJackConfig#GRAPH_FREQ}. With {@link LabJackConfig#ARCHIVE_FULL_RATE} on,
 *       every scan is additionally written to the {@link LabJackConfig#ARCHIVE_STREAM} so the YAMCS
 *       archive keeps the full raw rate while the UI stays responsive.</li>
 *   <li><b>Watchdog</b> — armed on connect via {@link LabJackDevice#configureWatchdog()}; the periodic
 *       digital read supplies the host→device traffic that keeps it fed during normal operation, so it
 *       only trips (driving all DIO low) when the control station truly goes silent.</li>
 * </ul>
 * Hardware tunables live in {@link LabJackConfig}. Sensor calibration is in the MDB, not here.
 */
public class LabJackDataLink extends AbstractTcTmParamLink implements Runnable {

    private enum State { DISCONNECTED, CONNECTING, STREAMING, RECONNECTING }

    private record CsvEntry(long receptionTime, byte[] packet) {}

    /**
     * Singleton handle so safety-critical callers (the control box E-stop in {@code ControlBoxLink}) can
     * drive pins directly via {@link #writeDigitalPin(int, int)}, bypassing the HTTP command path for
     * minimal latency.
     */
    private static volatile LabJackDataLink instance;

    public LabJackDataLink() {
        instance = this;
    }

    public static LabJackDataLink getInstance() {
        return instance;
    }

    private volatile State state = State.DISCONNECTED;
    private volatile boolean running = false;

    private LabJackDevice device;
    private Thread acquisitionThread;
    private ScheduledExecutorService csvExecutor;
    private LabJackCsvWriter csvWriter;
    private final Queue<CsvEntry> csvQueue = new ConcurrentLinkedQueue<>();

    private int graphCounter = 0;
    private int seqNum = 0;
    private boolean watchdogConfigured = false; // flash-backed; write once per session, not per reconnect
    private volatile byte[] lastDigital = new byte[LabJackPacket.DIGITAL_BYTES];

    // Optional full-rate archive (ARCHIVE_FULL_RATE)
    private Stream archiveStream;
    private TupleDefinition archiveTupleDef;

    @Override
    public void init(String instance, String name, YConfiguration config) {
        super.init(instance, name, config);
        // Reads scanRateHz/scansPerRead/graphFreq/archiveFullRate/... if present; otherwise keeps the
        // static defaults. Safe with no extra keys in the link config.
        LabJackConfig.applyOverrides(config);
    }

    // ---- Lifecycle -----------------------------------------------------------------------------

    @Override
    protected void doStart() {
        if (!isDisabled()) {
            startAcquisition();
        }
        notifyStarted();
    }

    @Override
    protected void doStop() {
        stopAcquisition();
        notifyStopped();
    }

    @Override
    public void doEnable() {
        startAcquisition();
    }

    @Override
    public void doDisable() {
        stopAcquisition();
    }

    private synchronized void startAcquisition() {
        if (running) {
            return;
        }
        running = true;
        graphCounter = 0;
        watchdogConfigured = false;
        // NOTE: do not touch LJM here — this runs on the YAMCS service-init thread. The first native
        // call (which forces loading LabJackM.dll) happens on the acquisition thread in run(), so a
        // missing native library degrades the link gracefully instead of failing backend startup.
        device = createDevice();
        setupArchiveStream();

        csvWriter = new LabJackCsvWriter();
        csvWriter.open();
        csvExecutor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, getClass().getSimpleName() + "-csv");
            t.setDaemon(true);
            return t;
        });
        csvExecutor.scheduleWithFixedDelay(this::drainCsv, 1000, 500, TimeUnit.MILLISECONDS);

        acquisitionThread = new Thread(this, getClass().getSimpleName() + "-acq");
        acquisitionThread.start();
    }

    private synchronized void stopAcquisition() {
        if (!running) {
            return;
        }
        running = false;
        if (device != null) {
            device.stopStream(); // unblocks a pending eStreamRead so the acquisition loop can exit
        }
        if (acquisitionThread != null) {
            try {
                acquisitionThread.join(2000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        if (csvExecutor != null) {
            csvExecutor.shutdownNow();
        }
        drainCsv();
        if (csvWriter != null) {
            csvWriter.close();
        }
        if (device != null) {
            device.close();
        }
        state = State.DISCONNECTED;
    }

    /** Overridable so tests can inject a fake device (no hardware / no Mockito needed). */
    protected LabJackDevice createDevice() {
        return new LabJackDevice();
    }

    // ---- Acquisition loop ----------------------------------------------------------------------

    @Override
    public void run() {
        long backoff = LabJackConfig.RECONNECT_BACKOFF_MS;
        try {
            // First LJM call on this (background) thread: forces JNA to load LabJackM.dll now. If the
            // native library is missing/incompatible it throws an UnsatisfiedLinkError (a LinkageError,
            // not an Exception), handled below so the backend still starts.
            LabJackDevice.configureLibraryAutoReconnect();
            while (running) {
                if (!device.isOpen()) {
                    if (state != State.RECONNECTING) {
                        state = State.CONNECTING;
                    }
                    if (tryConnect()) {
                        state = State.STREAMING;
                        backoff = LabJackConfig.RECONNECT_BACKOFF_MS;
                    } else {
                        long wait = (state == State.RECONNECTING)
                                ? backoff : LabJackConfig.CONNECT_RETRY_MS;
                        sleep(wait);
                        backoff = Math.min(backoff * 2, LabJackConfig.RECONNECT_BACKOFF_MAX_MS);
                    }
                    continue;
                }
                try {
                    acquireOnce();
                } catch (LJMException e) {
                    if (LabJackDevice.isDisconnectError(e.getError())) {
                        log.warn("LabJack stream lost (LJM " + e.getError() + ": " + e.getMessage()
                                + "); re-establishing");
                        enterReconnecting();
                    } else {
                        log.error("Transient LabJack error (LJM " + e.getError() + "): " + e.getMessage());
                    }
                } catch (Exception e) {
                    log.error("Unexpected LabJack error; re-establishing: " + e.getMessage());
                    enterReconnecting();
                }
            }
        } catch (LinkageError err) {
            // Native library (LabJackM.dll / liblabjackm) missing or incompatible. Can't recover without
            // installing it and restarting, so do NOT take down the backend: disable the link and leave a
            // clear, actionable message. The rest of YAMCS keeps running.
            log.error("LabJack link disabled: could not load native library 'LabJackM' (" + err
                    + "). Install the LabJack LJM software (provides LabJackM.dll on Windows) on this"
                    + " machine and restart the backend. The rest of YAMCS is unaffected.");
        } catch (Throwable t) {
            log.error("LabJack acquisition thread stopped unexpectedly: " + t);
        } finally {
            state = State.DISCONNECTED;
        }
    }

    private boolean tryConnect() {
        try {
            device.open();
            device.configureAnalogRanges();
            if (!watchdogConfigured) {
                device.configureWatchdog(); // *_DEFAULT persists in flash; write once per session
                watchdogConfigured = true;
            }
            device.setAllDigitalLow(); // safe state on every (re)connect
            device.startStream();
            log.info("LabJack streaming at " + LabJackConfig.SCAN_RATE_HZ + " Hz ("
                    + LabJackConfig.NUM_ANALOG_PINS + " AIN, " + LabJackConfig.SCANS_PER_READ
                    + " scans/read, graphFreq=" + LabJackConfig.GRAPH_FREQ + ")");
            return true;
        } catch (Exception e) {
            log.warn("LabJack connect attempt failed: " + e.getMessage());
            device.close();
            return false;
        }
    }

    private void enterReconnecting() {
        state = State.RECONNECTING;
        device.stopStream();
        device.close();
    }

    /** Reads one stream batch + the digital state and publishes/records the scans. */
    private void acquireOnce() {
        double[] batch = device.readStream(); // throws LJMException on disconnect

        // Command-response digital read: also the traffic that keeps the watchdog fed. A transient
        // failure reuses the last value; a disconnect-class failure propagates to trigger reconnect.
        try {
            lastDigital = device.readDigitalState();
        } catch (LJMException e) {
            if (LabJackDevice.isDisconnectError(e.getError())) {
                throw e;
            }
            log.warn("Digital read failed (LJM " + e.getError() + "); reusing last state");
        }
        byte[] digital = lastDigital;

        long now = getCurrentTime();
        int n = LabJackConfig.NUM_ANALOG_PINS;
        for (int scan = 0; scan < LabJackConfig.SCANS_PER_READ; scan++) {
            double[] scanValues = Arrays.copyOfRange(batch, scan * n, (scan + 1) * n);
            byte[] packet = LabJackPacket.build(scanValues, digital);

            dataIn(1, packet.length);
            csvQueue.add(new CsvEntry(now, packet)); // full rate -> CSV

            if (LabJackConfig.ARCHIVE_FULL_RATE) {
                emitToArchive(now, packet); // full rate -> YAMCS archive
            }

            if (++graphCounter >= LabJackConfig.GRAPH_FREQ) { // decimated -> realtime/frontend
                graphCounter = 0;
                processPacket(packetPreprocessor.process(new TmPacket(now, packet)));
            }
        }
    }

    // ---- Full-rate archive (optional) ----------------------------------------------------------

    private void setupArchiveStream() {
        archiveStream = null;
        if (!LabJackConfig.ARCHIVE_FULL_RATE) {
            return;
        }
        YarchDatabaseInstance ydb = YarchDatabase.getInstance(yamcsInstance);
        archiveStream = ydb.getStream(LabJackConfig.ARCHIVE_STREAM);
        if (archiveStream == null) {
            log.warn("archiveFullRate is on but stream '" + LabJackConfig.ARCHIVE_STREAM
                    + "' is not declared in streamConfig; full-rate archiving disabled");
            return;
        }
        archiveTupleDef = new TupleDefinition();
        archiveTupleDef.addColumn(StandardTupleDefinitions.GENTIME_COLUMN, DataType.TIMESTAMP);
        archiveTupleDef.addColumn(StandardTupleDefinitions.SEQNUM_COLUMN, DataType.INT);
        archiveTupleDef.addColumn(StandardTupleDefinitions.TM_RECTIME_COLUMN, DataType.TIMESTAMP);
        archiveTupleDef.addColumn(StandardTupleDefinitions.TM_STATUS_COLUMN, DataType.INT);
        archiveTupleDef.addColumn(StandardTupleDefinitions.TM_PACKET_COLUMN, DataType.BINARY);
        log.info("Full-rate archive enabled -> stream '" + LabJackConfig.ARCHIVE_STREAM + "'");
    }

    private void emitToArchive(long now, byte[] packet) {
        if (archiveStream == null) {
            return;
        }
        archiveStream.emitTuple(
                new Tuple(archiveTupleDef, new Object[] {now, seqNum++, now, 0, packet}));
    }

    // ---- CSV -----------------------------------------------------------------------------------

    private void drainCsv() {
        CsvEntry e;
        while ((e = csvQueue.poll()) != null) {
            csvWriter.writeRow(e.receptionTime(), e.packet());
        }
        csvWriter.flush();
    }

    // ---- Commands ------------------------------------------------------------------------------

    @Override
    public boolean sendCommand(PreparedCommand preparedCommand) {
        if (device == null || !device.isOpen()) {
            log.warn("Cannot send LabJack command while not connected");
            return false;
        }
        int pinNum = -1;
        ArgumentValue valueToWrite = null;
        for (Map.Entry<Argument, ArgumentValue> argument : preparedCommand.getArgAssignment().entrySet()) {
            if (argument.getKey().getName().equals("pin_number")) {
                pinNum = argument.getValue().getEngValue().getUint32Value();
            } else {
                valueToWrite = argument.getValue();
            }
        }
        if (pinNum < 0 || valueToWrite == null) {
            log.error("LabJack command missing pin_number or value argument");
            return false;
        }

        try {
            String cmd = preparedCommand.getCommandName();
            if (cmd.endsWith("write_digital_pin")) {
                int state = (int) valueToWrite.getEngValue().getSint64Value();
                device.writeDigitalPin(pinNum, state);
                log.info("Wrote " + state + " to DIO" + pinNum);
            } else if (cmd.endsWith("write_DAC_pin")) {
                double voltage = valueToWrite.getEngValue().getFloatValue();
                device.writeDac(pinNum, voltage);
                log.info("Wrote " + voltage + " V to DAC" + pinNum);
            } else {
                log.warn("Unknown LabJack command: " + cmd);
                return false;
            }
        } catch (Exception e) {
            log.error("LabJack command failed: " + e.getMessage());
            return false;
        }
        return true;
    }

    /**
     * Directly drives a digital pin, bypassing the YAMCS command pipeline. Used by the control box
     * E-stop fast path ({@code ControlBoxLink}) for minimal latency. Safe no-op if not connected.
     */
    public void writeDigitalPin(int pinNum, int state) {
        if (device == null || !device.isOpen()) {
            log.warn("Cannot write DIO" + pinNum + " - LabJack not connected");
            return;
        }
        try {
            device.writeDigitalPin(pinNum, state);
        } catch (Exception e) {
            log.error("Failed to write DIO" + pinNum + ": " + e.getMessage());
        }
    }

    // ---- Status --------------------------------------------------------------------------------

    @Override
    protected Status connectionStatus() {
        return state == State.STREAMING ? Status.OK : Status.UNAVAIL;
    }

    @Override
    public String getDetailedStatus() {
        if (isDisabled()) {
            return "DISABLED";
        }
        return switch (state) {
            case STREAMING -> "OK - streaming at " + LabJackConfig.SCAN_RATE_HZ + " Hz";
            case CONNECTING -> "Connecting to LabJack...";
            case RECONNECTING -> "Reconnecting - LabJack link lost";
            case DISCONNECTED -> "Disconnected";
        };
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
