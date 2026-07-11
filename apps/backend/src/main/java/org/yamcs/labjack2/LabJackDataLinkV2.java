package org.yamcs.labjack2;

import static org.yamcs.parameter.SystemParametersService.getPV;

import java.util.Map;
import java.util.Queue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import libs.LJMException;
import org.yamcs.StandardTupleDefinitions;
import org.yamcs.TmPacket;
import org.yamcs.YConfiguration;
import org.yamcs.cmdhistory.CommandHistoryPublisher;
import org.yamcs.cmdhistory.CommandHistoryPublisher.AckStatus;
import org.yamcs.commanding.ArgumentValue;
import org.yamcs.commanding.PreparedCommand;
import org.yamcs.labjack.LabJackLink;
import org.yamcs.labjack.LabJackLinkRegistry;
import org.yamcs.labjack.LabJackPacket;
import org.yamcs.logging.Log;
import org.yamcs.parameter.ParameterValue;
import org.yamcs.parameter.SystemParametersService;
import org.yamcs.protobuf.Yamcs.Value.Type;
import org.yamcs.tctm.AbstractTcTmParamLink;
import org.yamcs.xtce.Argument;
import org.yamcs.xtce.Parameter;
import org.yamcs.yarch.DataType;
import org.yamcs.yarch.Stream;
import org.yamcs.yarch.Tuple;
import org.yamcs.yarch.TupleDefinition;
import org.yamcs.yarch.YarchDatabase;
import org.yamcs.yarch.YarchDatabaseInstance;

public class LabJackDataLinkV2 extends AbstractTcTmParamLink implements Runnable, LabJackLink {
    private enum State {
        DISCONNECTED,
        CONNECTING,
        STREAMING,
        RECONNECTING
    }

    private record BatchEntry(long receptionTime, double[] data, byte[] digitalState) {}

    private record CsvEntry(long receptionTime, byte[] packet) {}

    private static final Log log = new Log(LabJackDataLinkV2.class);

    private volatile State state = State.DISCONNECTED;
    private volatile boolean running;
    private volatile byte[] lastDigital = new byte[LabJackPacket.DIGITAL_BYTES];

    private LabJackDeviceV2 device;
    private Thread acquisitionThread;
    private Thread processingThread;
    private ScheduledExecutorService csvExecutor;
    private LabJackCsvWriterV2 csvWriter;
    private final Queue<CsvEntry> csvQueue = new ConcurrentLinkedQueue<>();
    private final BlockingQueue<BatchEntry> processingQueue = new LinkedBlockingQueue<>();

    private Stream archiveStream;
    private TupleDefinition archiveTupleDef;

    private int graphCounter;
    private int seqNum;
    private boolean watchdogConfigured;
    private double actualScanRateHz = LabJackConfigV2.SCAN_RATE_HZ;
    private long lastStreamWarningMs;
    private long nextDigitalFeedMs;
    private volatile int lastDeviceBacklog;
    private volatile int lastLjmBacklog;
    private volatile int lastDummySamples;

    private Parameter deviceBacklogParameter;
    private Parameter ljmBacklogParameter;
    private Parameter dummySamplesParameter;
    private Parameter processingQueueDepthParameter;

    public LabJackDataLinkV2() {
        LabJackLinkRegistry.set(this);
    }

    @Override
    public void init(String instance, String name, YConfiguration config) {
        super.init(instance, name, config);
        LabJackConfigV2.applyOverrides(config);
    }

    @Override
    public void setupSystemParameters(SystemParametersService sysParamService) {
        super.setupSystemParameters(sysParamService);

        deviceBacklogParameter = sysParamService.createSystemParameter(
                LINK_NAMESPACE + linkName + "/Device Backlog",
                Type.UINT32,
                "Number of scans still buffered on the LabJack device");
        ljmBacklogParameter = sysParamService.createSystemParameter(
                LINK_NAMESPACE + linkName + "/LJM Backlog",
                Type.UINT32,
                "Number of scans still buffered in the LJM host buffer");
        dummySamplesParameter = sysParamService.createSystemParameter(
                LINK_NAMESPACE + linkName + "/Dummy Samples",
                Type.UINT32,
                "Number of -9999 stream samples returned in the last read");
        processingQueueDepthParameter = sysParamService.createSystemParameter(
                LINK_NAMESPACE + linkName + "/Processing Queue Depth",
                Type.UINT32,
                "Number of LabJack batches waiting for packet processing");
    }

    @Override
    protected void collectSystemParameters(long time, java.util.List<ParameterValue> list) {
        super.collectSystemParameters(time, list);
        list.add(getPV(deviceBacklogParameter, time, lastDeviceBacklog));
        list.add(getPV(ljmBacklogParameter, time, lastLjmBacklog));
        list.add(getPV(dummySamplesParameter, time, lastDummySamples));
        list.add(getPV(processingQueueDepthParameter, time, processingQueue.size()));
    }

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
        state = State.DISCONNECTED;
        graphCounter = 0;
        seqNum = 0;
        actualScanRateHz = LabJackConfigV2.SCAN_RATE_HZ;
        watchdogConfigured = false;
        lastDigital = new byte[LabJackPacket.DIGITAL_BYTES];
        lastStreamWarningMs = 0;
        nextDigitalFeedMs = 0;
        clearBacklogMetrics();
        processingQueue.clear();
        device = new LabJackDeviceV2();

        setupArchiveStream();

        csvWriter = new LabJackCsvWriterV2();
        csvWriter.open();
        csvExecutor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, getClass().getSimpleName() + "-csv");
            t.setDaemon(true);
            return t;
        });
        csvExecutor.scheduleWithFixedDelay(this::drainCsv, 1000, 500, TimeUnit.MILLISECONDS);

        processingThread = new Thread(this::runProcessingLoop, getClass().getSimpleName() + "-proc");
        processingThread.start();
        acquisitionThread = new Thread(this, getClass().getSimpleName() + "-acq");
        acquisitionThread.start();
        LabJackLinkRegistry.set(this);
    }

    private synchronized void stopAcquisition() {
        if (!running) {
            return;
        }

        running = false;
        if (device != null) {
            device.stopStream();
        }
        if (acquisitionThread != null) {
            try {
                acquisitionThread.join(2000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        if (processingThread != null) {
            try {
                processingThread.join(2000);
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
        clearBacklogMetrics();
        state = State.DISCONNECTED;
        LabJackLinkRegistry.clear(this);
    }

    @Override
    public void run() {
        try {
            LabJackDeviceV2.configureLibraryAutoReconnect();
            while (running) {
                if (device == null || !device.isOpen()) {
                    connectLoop();
                    continue;
                }

                try {
                    acquireBatch();
                } catch (LJMException e) {
                    handleLjmError(e);
                } catch (Exception e) {
                    log.error("Unexpected LabJack error; reconnecting: " + e.getMessage());
                    reconnect();
                }
            }
        } catch (LinkageError err) {
            log.error("LabJack link disabled: could not load native library 'LabJackM' (" + err
                    + "). Install the LabJack LJM software on this machine and restart the backend.");
        } catch (Throwable t) {
            log.error("LabJack acquisition thread stopped unexpectedly: " + t);
        } finally {
            state = State.DISCONNECTED;
        }
    }

    private void connectLoop() {
        state = state == State.RECONNECTING ? State.RECONNECTING : State.CONNECTING;
        if (tryConnect()) {
            state = State.STREAMING;
        } else {
            sleep(LabJackConfigV2.CONNECT_RETRY_MS);
        }
    }

    private boolean tryConnect() {
        try {
            device.open();
            device.configureAnalogRanges();
            if (!watchdogConfigured) {
                device.configureWatchdog();
                watchdogConfigured = true;
            }
            device.setAllDigitalLow();
            actualScanRateHz = device.startStream();
            LabJackConfigV2.validateSamplingConfig(actualScanRateHz);
            log.info("LabJack streaming at " + actualScanRateHz + " Hz ("
                    + LabJackConfigV2.NUM_ANALOG_PINS + " AIN, " + LabJackConfigV2.SCANS_PER_READ
                    + " scans/read)");
            return true;
        } catch (Exception e) {
            log.warn("LabJack connect attempt failed: " + e.getMessage());
            device.close();
            return false;
        }
    }

    private void acquireBatch() {
        LabJackDeviceV2.StreamRead streamRead = device.readStream();
        lastDeviceBacklog = streamRead.deviceBacklog();
        lastLjmBacklog = streamRead.ljmBacklog();
        lastDummySamples = streamRead.dummySamples();
        logStreamHealth(streamRead);
        refreshDigitalStateIfNeeded();
        processingQueue.add(new BatchEntry(getCurrentTime(), streamRead.data(), lastDigital));
    }

    private void refreshDigitalStateIfNeeded() {
        long now = System.currentTimeMillis();
        if (now < nextDigitalFeedMs) {
            return;
        }

        try {
            // Stream traffic does not feed the watchdog; this command-response read does.
            lastDigital = device.readDigitalState();
            nextDigitalFeedMs = now + LabJackConfigV2.DIGITAL_FEED_INTERVAL_MS;
        } catch (LJMException e) {
            if (LabJackDeviceV2.isTransientDigitalReadError(e.getError())) {
                nextDigitalFeedMs = now + LabJackConfigV2.DIGITAL_FEED_INTERVAL_MS;
                log.warn("Digital read timed out during streaming (LJM " + e.getError() + " "
                        + LabJackDeviceV2.errorName(e.getError()) + "); reusing last state");
                return;
            }
            if (LabJackDeviceV2.isDisconnectError(e.getError()) || LabJackDeviceV2.isRestartStreamError(e.getError())) {
                throw e;
            }
            log.warn("Digital read failed (LJM " + e.getError() + " "
                    + LabJackDeviceV2.errorName(e.getError()) + "); reusing last state");
        }
    }

    private void runProcessingLoop() {
        while (running || !processingQueue.isEmpty()) {
            try {
                BatchEntry entry = processingQueue.poll(250, TimeUnit.MILLISECONDS);
                if (entry == null) {
                    continue;
                }
                processBatch(entry);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            } catch (Exception e) {
                log.error("LabJack processing error: " + e.getMessage());
            }
        }
    }

    private void processBatch(BatchEntry entry) {
        long now = entry.receptionTime();
        double[] data = entry.data();
        byte[] digitalState = entry.digitalState();
        int channels = LabJackConfigV2.NUM_ANALOG_PINS;
        for (int scan = 0; scan < LabJackConfigV2.SCANS_PER_READ; scan++) {
            byte[] packet = buildPacket(data, scan * channels, digitalState);

            dataIn(1, packet.length);
            csvQueue.add(new CsvEntry(now, packet));

            if (LabJackConfigV2.ARCHIVE_FULL_RATE) {
                emitToArchive(now, packet);
            }
            // Realtime/frontend can be decimated without affecting CSV or optional full-rate archive output.
            if (++graphCounter >= LabJackConfigV2.GRAPH_FREQ) {
                graphCounter = 0;
                processPacket(packetPreprocessor.process(new TmPacket(now, packet)));
            }
        }
    }

    private static byte[] buildPacket(double[] batch, int analogOffset, byte[] digitalState) {
        byte[] packet = new byte[LabJackPacket.PACKET_SIZE];
        int out = 0;
        for (int i = 0; i < LabJackConfigV2.NUM_ANALOG_PINS; i++) {
            int bits = Float.floatToIntBits((float) batch[analogOffset + i]);
            packet[out++] = (byte) (bits >>> 24);
            packet[out++] = (byte) (bits >>> 16);
            packet[out++] = (byte) (bits >>> 8);
            packet[out++] = (byte) bits;
        }
        System.arraycopy(digitalState, 0, packet, out, LabJackPacket.DIGITAL_BYTES);
        return packet;
    }

    private void logStreamHealth(LabJackDeviceV2.StreamRead streamRead) {
        if (streamRead.deviceBacklog() == 0 && streamRead.ljmBacklog() == 0 && streamRead.dummySamples() == 0) {
            return;
        }

        long now = System.currentTimeMillis();
        if (now - lastStreamWarningMs < 5000) {
            return;
        }

        lastStreamWarningMs = now;
        log.warn("LabJack stream backlog: device=" + streamRead.deviceBacklog()
                + ", ljm=" + streamRead.ljmBacklog()
                + ", dummySamples=" + streamRead.dummySamples());
    }

    private void handleLjmError(LJMException e) {
        int error = e.getError();
        if (LabJackDeviceV2.isRestartableStreamReadError(error)) {
            if (restartStream()) {
                return;
            }
        }
        if (LabJackDeviceV2.isDisconnectError(error)) {
            log.warn("LabJack disconnected (LJM " + error + " " + LabJackDeviceV2.errorName(error)
                    + ": " + e.getMessage() + ")");
            reconnect();
            return;
        }
        if (LabJackDeviceV2.isRestartStreamError(error)) {
            log.warn("LabJack stream stopped (LJM " + error + " " + LabJackDeviceV2.errorName(error)
                    + ": " + e.getMessage() + "); reconnecting");
            reconnect();
            return;
        }
        log.error("Transient LabJack error (LJM " + error + " " + LabJackDeviceV2.errorName(error)
                + "): " + e.getMessage());
    }

    private boolean restartStream() {
        try {
            log.warn("LabJack stream read failed; restarting stream on existing handle");
            device.stopStream();
            actualScanRateHz = device.startStream();
            LabJackConfigV2.validateSamplingConfig(actualScanRateHz);
            nextDigitalFeedMs = 0;
            clearBacklogMetrics();
            state = State.STREAMING;
            log.info("LabJack stream restarted at " + actualScanRateHz + " Hz");
            return true;
        } catch (Exception restartError) {
            log.warn("LabJack stream restart failed: " + restartError.getMessage() + "; reconnecting");
            reconnect();
            return false;
        }
    }

    private void reconnect() {
        state = State.RECONNECTING;
        device.stopStream();
        device.close();
        clearBacklogMetrics();
    }

    private void clearBacklogMetrics() {
        lastDeviceBacklog = 0;
        lastLjmBacklog = 0;
        lastDummySamples = 0;
    }

    private void setupArchiveStream() {
        archiveStream = null;
        archiveTupleDef = null;
        if (!LabJackConfigV2.ARCHIVE_FULL_RATE) {
            return;
        }

        YarchDatabaseInstance ydb = YarchDatabase.getInstance(yamcsInstance);
        archiveStream = ydb.getStream(LabJackConfigV2.ARCHIVE_STREAM);
        if (archiveStream == null) {
            log.warn("archiveFullRate is on but stream '" + LabJackConfigV2.ARCHIVE_STREAM
                    + "' is not declared in streamConfig; full-rate archiving disabled");
            return;
        }

        archiveTupleDef = new TupleDefinition();
        archiveTupleDef.addColumn(StandardTupleDefinitions.GENTIME_COLUMN, DataType.TIMESTAMP);
        archiveTupleDef.addColumn(StandardTupleDefinitions.SEQNUM_COLUMN, DataType.INT);
        archiveTupleDef.addColumn(StandardTupleDefinitions.TM_RECTIME_COLUMN, DataType.TIMESTAMP);
        archiveTupleDef.addColumn(StandardTupleDefinitions.TM_STATUS_COLUMN, DataType.INT);
        archiveTupleDef.addColumn(StandardTupleDefinitions.TM_PACKET_COLUMN, DataType.BINARY);
    }

    private void emitToArchive(long now, byte[] packet) {
        if (archiveStream == null) {
            return;
        }
        archiveStream.emitTuple(new Tuple(archiveTupleDef, new Object[] {now, seqNum++, now, 0, packet}));
    }

    private void drainCsv() {
        if (csvWriter == null) {
            return;
        }
        CsvEntry entry;
        while ((entry = csvQueue.poll()) != null) {
            csvWriter.writeRow(entry.receptionTime(), entry.packet());
        }
        csvWriter.flush();
    }

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
                ackCommand(preparedCommand.getCommandId());
                int actual = device.readDigitalPinState(pinNum);
                completeCommand(preparedCommand, actual == target,
                        "DIO" + pinNum + " readback=" + actual + ", commanded=" + target);
            } else if (cmd.endsWith("write_DAC_pin")) {
                double targetV = valueToWrite.getEngValue().getFloatValue();
                device.writeDac(pinNum, targetV);
                ackCommand(preparedCommand.getCommandId());
                double actualV = device.readDac(pinNum);
                completeCommand(preparedCommand,
                        Math.abs(actualV - targetV) <= LabJackConfigV2.DAC_READBACK_TOLERANCE_V,
                        "DAC" + pinNum + " readback=" + actualV + " V, commanded=" + targetV + " V");
            } else {
                log.warn("Unknown LabJack command: " + cmd);
                failedCommand(preparedCommand.getCommandId(), "Unknown LabJack command: " + cmd);
                return false;
            }
        } catch (Exception e) {
            log.error("LabJack command failed: " + e.getMessage());
            failedCommand(preparedCommand.getCommandId(), e.getMessage());
            return false;
        }

        return true;
    }

    private void completeCommand(PreparedCommand pc, boolean verified, String detail) {
        if (verified) {
            commandHistoryPublisher.publishAck(pc.getCommandId(),
                    CommandHistoryPublisher.CommandComplete_KEY, getCurrentTime(), AckStatus.OK);
            return;
        }

        log.warn("LabJack command readback mismatch: " + detail);
        commandHistoryPublisher.publishAck(pc.getCommandId(),
                CommandHistoryPublisher.CommandComplete_KEY, getCurrentTime(), AckStatus.NOK,
                "Readback mismatch: " + detail);
    }

    @Override
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
                    + LabJackConfigV2.TM_PACKET_RATE_HZ + " Hz";
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
