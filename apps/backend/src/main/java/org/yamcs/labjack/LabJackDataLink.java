package org.yamcs.labjack;

import java.util.Arrays;
import java.util.Map;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import libs.LJMException;
import org.yamcs.StandardTupleDefinitions;
import org.yamcs.TmPacket;
import org.yamcs.YConfiguration;
import org.yamcs.cmdhistory.CommandHistoryPublisher;
import org.yamcs.cmdhistory.CommandHistoryPublisher.AckStatus;
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
    private final AtomicInteger csvQueueDepth = new AtomicInteger();

    private int graphCounter = 0;
    private int seqNum = 0;
    private boolean watchdogConfigured = false; // flash-backed; write once per session, not per reconnect
    private volatile byte[] lastDigital = new byte[LabJackPacket.DIGITAL_BYTES];
    private double actualScanRateHz = LabJackConfig.SCAN_RATE_HZ;
    private int maxDeviceScanBacklog = 0;
    private int maxLjmScanBacklog = 0;
    private int maxCsvQueueDepth = 0;
    private int lastLoggedCsvQueueDepth = 0;
    private long lastBacklogLogMs = 0;
    private long lastHealthyStreamLogMs = 0;

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
        actualScanRateHz = LabJackConfig.SCAN_RATE_HZ;
        watchdogConfigured = false;
        maxDeviceScanBacklog = 0;
        maxLjmScanBacklog = 0;
        maxCsvQueueDepth = 0;
        lastLoggedCsvQueueDepth = 0;
        lastBacklogLogMs = 0;
        lastHealthyStreamLogMs = 0;
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
                    } else {
                        sleep(LabJackConfig.CONNECT_RETRY_MS);
                    }
                    continue;
                }
                try {
                    acquireOnce();
                } catch (LJMException e) {
                    String classification = classifyLjmError(e.getError());
                    if (LabJackDevice.isDisconnectError(e.getError())) {
                        log.warn("LabJack stream lost (LJM " + e.getError() + ", " + classification + ": "
                                + e.getMessage() + "); re-establishing");
                        enterReconnecting();
                    } else {
                        log.error("Transient LabJack error (LJM " + e.getError() + ", " + classification
                                + "): " + e.getMessage());
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
            actualScanRateHz = device.startStream();
            LabJackConfig.validateSamplingConfig(actualScanRateHz);
            log.info("LabJack streaming at " + actualScanRateHz + " Hz ("
                    + LabJackConfig.NUM_ANALOG_PINS + " AIN, " + LabJackConfig.SCANS_PER_READ
                    + " scans/read, packetRate=" + LabJackConfig.TM_PACKET_RATE_HZ + " Hz)");
            return true;
        } catch (LJMException e) {
            log.warn("LabJack connect attempt failed (LJM " + e.getError() + ", "
                    + classifyLjmError(e.getError()) + "): " + e.getMessage());
            device.close();
            return false;
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
        LabJackDevice.StreamRead streamRead = device.readStream(); // throws LJMException on disconnect
        double[] batch = streamRead.data();
        logStreamTelemetry(streamRead);

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
            int csvDepth = csvQueueDepth.incrementAndGet();
            if (csvDepth > maxCsvQueueDepth) {
                maxCsvQueueDepth = csvDepth;
                if (csvDepth >= 1000 && csvDepth - lastLoggedCsvQueueDepth >= 1000) {
                    lastLoggedCsvQueueDepth = csvDepth;
                    log.warn("LabJack CSV queue depth high: " + csvDepth + " pending rows");
                }
            }

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
            csvQueueDepth.decrementAndGet();
            csvWriter.writeRow(e.receptionTime(), e.packet());
        }
        csvWriter.flush();
    }

    private void logStreamTelemetry(LabJackDevice.StreamRead streamRead) {
        int deviceScanBacklog = streamRead.deviceScanBacklog();
        int ljmScanBacklog = streamRead.ljmScanBacklog();
        int dummySamples = streamRead.dummySamples();

        maxDeviceScanBacklog = Math.max(maxDeviceScanBacklog, deviceScanBacklog);
        maxLjmScanBacklog = Math.max(maxLjmScanBacklog, ljmScanBacklog);

        long now = System.currentTimeMillis();
        boolean backlogPresent = deviceScanBacklog > 0 || ljmScanBacklog > 0;
        boolean shouldLogBacklog = backlogPresent && (lastBacklogLogMs == 0 || now - lastBacklogLogMs >= 5000);
        if (shouldLogBacklog) {
            lastBacklogLogMs = now;
            log.warn("LabJack stream backlog: device=" + deviceScanBacklog
                    + " scans, ljm=" + ljmScanBacklog + " scans, csvQueue=" + csvQueueDepth.get()
                    + ", maxDevice=" + maxDeviceScanBacklog + ", maxLjm=" + maxLjmScanBacklog + ")");
        }

        if (dummySamples > 0) {
            log.warn("LabJack stream returned " + dummySamples + " dummy samples (-9999.0); deviceBacklog="
                    + deviceScanBacklog + ", ljmBacklog=" + ljmScanBacklog + ", csvQueue="
                    + csvQueueDepth.get());
        }

        if (!backlogPresent && dummySamples == 0 && (lastHealthyStreamLogMs == 0 || now - lastHealthyStreamLogMs >= 30000)) {
            lastHealthyStreamLogMs = now;
            log.info("LabJack stream healthy: deviceBacklog=" + deviceScanBacklog + ", ljmBacklog="
                    + ljmScanBacklog + ", csvQueue=" + csvQueueDepth.get() + ", maxDevice="
                    + maxDeviceScanBacklog + ", maxLjm=" + maxLjmScanBacklog + ", maxCsvQueue="
                    + maxCsvQueueDepth);
        }
    }

    private static String classifyLjmError(int errorCode) {
        return switch (errorCode) {
            case 1301 -> "ljm_buffer_full_host_not_keeping_up";
            case 1320 -> "digital_auto_recovery_detected_device_buffer_overflow";
            case 2942 -> "stream_scan_overlap_sample_rate_too_high";
            case 1224, 1225, 1227, 1233, 1239, 1240, 1242, 1263, 1302, 1303 -> "disconnect_or_stream_stopped";
            default -> "unclassified";
        };
    }

    // ---- Commands ------------------------------------------------------------------------------

    /**
     * Executes a LabJack command and publishes its acknowledgment lifecycle to the command history
     * (same fields {@code AstraCommandLink.handleFCAck} updates, so the UI shows progress identically):
     * <ol>
     *   <li><b>Acknowledge_Sent → OK</b> as soon as the LJM write returns without error;</li>
     *   <li><b>CommandComplete → OK/NOK</b> by reading the pin back and comparing with the commanded
     *       target — the LJM write API gives no per-command completion signal beyond throwing, so
     *       readback verification is the completion source of truth.</li>
     * </ol>
     * Failures (not connected, LJM error, readback mismatch) publish NOK with the reason.
     */
    @Override
    public boolean sendCommand(PreparedCommand preparedCommand) {
        if (device == null || !device.isOpen()) {
            log.warn("Cannot send LabJack command while not connected");
            failedCommand(preparedCommand.getCommandId(), "LabJack not connected");
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
            failedCommand(preparedCommand.getCommandId(), "Missing pin_number or value argument");
            return false;
        }

        try {
            String cmd = preparedCommand.getCommandName();
            if (cmd.endsWith("write_digital_pin")) {
                int target = (int) valueToWrite.getEngValue().getSint64Value();
                device.writeDigitalPin(pinNum, target);
                ackCommand(preparedCommand.getCommandId()); // Acknowledge_Sent -> OK
                int actual = device.readDigitalPinState(pinNum);
                completeCommand(preparedCommand, actual == target,
                        "DIO" + pinNum + " readback=" + actual + ", commanded=" + target);
                log.info("Wrote " + target + " to DIO" + pinNum + " (readback " + actual + ")");
            } else if (cmd.endsWith("write_DAC_pin")) {
                double targetV = valueToWrite.getEngValue().getFloatValue();
                device.writeDac(pinNum, targetV);
                ackCommand(preparedCommand.getCommandId()); // Acknowledge_Sent -> OK
                double actualV = device.readDac(pinNum);
                completeCommand(preparedCommand,
                        Math.abs(actualV - targetV) <= LabJackConfig.DAC_READBACK_TOLERANCE_V,
                        "DAC" + pinNum + " readback=" + actualV + " V, commanded=" + targetV + " V");
                log.info("Wrote " + targetV + " V to DAC" + pinNum + " (readback " + actualV + " V)");
            } else {
                log.warn("Unknown LabJack command: " + cmd);
                failedCommand(preparedCommand.getCommandId(), "Unknown LabJack command: " + cmd);
                return false;
            }
        } catch (Exception e) {
            // The LJM call threw — that is the SDK's failure signal; reflect it in the command history.
            log.error("LabJack command failed: " + e.getMessage());
            failedCommand(preparedCommand.getCommandId(), e.getMessage());
            return false;
        }
        return true;
    }

    /**
     * Publishes the CommandComplete ack from the post-write readback comparison: OK when the pin now
     * reads the commanded value, NOK (with the readback detail) otherwise.
     */
    private void completeCommand(PreparedCommand pc, boolean verified, String detail) {
        if (verified) {
            commandHistoryPublisher.publishAck(pc.getCommandId(),
                    CommandHistoryPublisher.CommandComplete_KEY, getCurrentTime(), AckStatus.OK);
        } else {
            log.warn("LabJack command readback mismatch: " + detail);
            commandHistoryPublisher.publishAck(pc.getCommandId(),
                    CommandHistoryPublisher.CommandComplete_KEY, getCurrentTime(), AckStatus.NOK,
                    "Readback mismatch: " + detail);
        }
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
            case STREAMING -> "OK - streaming at " + actualScanRateHz + " Hz, saving packets at "
                    + LabJackConfig.TM_PACKET_RATE_HZ + " Hz";
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
