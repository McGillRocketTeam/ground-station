package org.yamcs.labjack;

import com.sun.jna.ptr.IntByReference;
import libs.LJM;
import org.yamcs.TmPacket;
import org.yamcs.YConfiguration;
import org.yamcs.commanding.ArgumentValue;
import org.yamcs.commanding.PreparedCommand;
import org.yamcs.mdb.Mdb;
import org.yamcs.mdb.MdbFactory;
import org.yamcs.mdb.XtceTmExtractor;
import org.yamcs.tctm.AbstractTcTmParamLink;
import org.yamcs.xtce.ParameterEntry;
import org.yamcs.xtce.SequenceContainer;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.text.SimpleDateFormat;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Date;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * @author Jake
 * This class manages the connection to the LabJack, reads and writes from/to the LabJack
 * and places its readings into a binary packet (defined in LABJ_XTCE.xml) which is then put into a TM stream.
 *
 * AINs are read continuously via LabJack stream mode at a fixed scan rate. Digital pins are polled periodically.
 */

public class LabJackDataLink extends AbstractTcTmParamLink implements Runnable{

    private static LabJackDataLink instance;
    private static final String CSV_FILENAME = "yamcs-data" + File.separator + "labjack_csv" + File.separator + "labj_" + (new SimpleDateFormat("yyyy-MM-dd--HH-mm-ss")).format(new Date()) + ".csv";
    /*
    Determines how many packets are sent to be graphed by YAMCS out of the total number of packets collected.
    E.g. for every GRAPH_FREQ number of packets collected, 1 packet is sent to YAMCS.
     */
    // Send every scan to YAMCS UI — wireless latency makes eStreamRead calls expensive,
    // so extract maximum value from each batch rather than throttling here.
    private static final int GRAPH_FREQ = 1;
    private int packetCount = 0;
    private volatile byte[] lastDigitalData = new byte[3];
    //stores handle of currently connected LabJack device
    private int deviceHandle = 0;

    //stores whether the class is currently connected to a LabJack
    private boolean isConnected = false;

    private final Queue<TmPacket> dataQueue = new ConcurrentLinkedQueue<>();
    private ScheduledExecutorService executorService;
    private BufferedWriter csvWriter;
    private XtceTmExtractor tmExtractor;
    private SequenceContainer sequenceContainer;


    public LabJackDataLink(){
        instance = this;
    }

	public static LabJackDataLink getInstance(){
		return LabJackDataLink.instance;
	}


    /**
     * Attempts to connect to any LabJack device (via ethernet or USB)
     */
    private void attemptLabJackConnection(){
        IntByReference handleRef = new IntByReference(0);
        try{
            LJM.openS("ANY", "ANY", "ANY", handleRef);
            log.info("LabJack Connected");
            deviceHandle = handleRef.getValue();

            //Watchdog 5 min
            int type = LJM.Constants.UINT32;

            int WATCHDOG_ENABLE_DEFAULT = 61600;
            int WATCHDOG_TIMEOUT_S_DEFAULT = 61604;
            int WATCHDOG_DIO_ENABLE_DEFAULT = 61630;
            int WATCHDOG_DIO_STATE_DEFAULT = 61632;
            int WATCHDOG_RESET_ENABLE_DEFAULT = 61620;

            LJM.eWriteAddress(deviceHandle, WATCHDOG_ENABLE_DEFAULT, type, 0); //Disables watchdog to change it
            LJM.eWriteAddress(deviceHandle, WATCHDOG_TIMEOUT_S_DEFAULT, type, 300); //5 minute timer
            LJM.eWriteAddress(deviceHandle, WATCHDOG_DIO_ENABLE_DEFAULT, type, 0); //Disable DIO
            LJM.eWriteAddress(deviceHandle, WATCHDOG_DIO_STATE_DEFAULT, type, 0); //DIO all LOW
            LJM.eWriteAddress(deviceHandle, WATCHDOG_DIO_ENABLE_DEFAULT, type, 1); //Re enable DIO
            LJM.eWriteAddress(deviceHandle, WATCHDOG_ENABLE_DEFAULT, type, 1); //Re-enable watchdog

            // Set AIN79-AIN87 range to ±1V for higher resolution
            for (int i = 79; i <= 87; i++) {
                LJM.eWriteName(deviceHandle, "AIN" + i + "_RANGE", 1.0);
            }
            log.info("Set AIN79-AIN87 range to ±1V");

            LabJackUtil.startStream(deviceHandle);
            log.info("Stream started at " + LabJackUtil.SCAN_RATE + " scans/channel/second");

            isConnected = true;

        } catch(Exception e){
            log.warn("Could not connect to LabJack: " + e.getMessage());
        }
    }

    /**
     * Reads one batch of stream data (SCANS_PER_READ scans) and packs each scan into a TmPacket.
     * Blocks until the LabJack has buffered enough data. Every GRAPH_FREQ scans one packet is
     * forwarded to YAMCS; all scans are queued for CSV storage.
     */
    private void streamRead() {
        if (!isConnected) return;
        double[] streamData = LabJackUtil.readStream(deviceHandle);
        if (streamData == null) return;

        long now = getCurrentTime();
        byte[] digital = lastDigitalData;

        for (int scan = 0; scan < LabJackUtil.SCANS_PER_READ; scan++) {
            double[] scanValues = Arrays.copyOfRange(
                    streamData,
                    scan * LabJackUtil.NUM_ANALOG_PINS,
                    (scan + 1) * LabJackUtil.NUM_ANALOG_PINS);

            byte[] analogBinaryData = createAnalogBinaryPacket(scanValues);
            byte[] combinedBinaryData = new byte[analogBinaryData.length + digital.length];
            System.arraycopy(analogBinaryData, 0, combinedBinaryData, 0, analogBinaryData.length);
            System.arraycopy(digital, 0, combinedBinaryData, analogBinaryData.length, digital.length);

            dataIn(1, combinedBinaryData.length);
            TmPacket tmPacket = new TmPacket(now, combinedBinaryData);

            if (++packetCount >= GRAPH_FREQ) {
                packetCount = 0;
                processPacket(packetPreprocessor.process(tmPacket));
            }

            dataQueue.add(tmPacket);
        }
    }

    /**
     * Polls DIO_STATE and caches the result for use by the stream read loop.
     * Runs at a much lower rate than the analog stream since digital pins change slowly.
     */
    private void readDigitalPinsTask() {
        if (!isConnected) return;
        byte[] digital = LabJackUtil.readDigitalPins(deviceHandle);
        if (digital != null) {
            lastDigitalData = digital;
        }
    }



    private void savePacketToCSV() {

        while(!dataQueue.isEmpty()){
            StringBuilder row = new StringBuilder();

            TmPacket dataArr = dataQueue.poll();
            LocalDateTime dateTime = Instant.ofEpochMilli(dataArr.getReceptionTime())
                    .atZone(ZoneId.systemDefault())
                    .toLocalDateTime();
            row.append(dateTime.format(DateTimeFormatter.ISO_LOCAL_TIME)).append(",");
            var result = tmExtractor.processPacket(dataArr.getPacket(), dataArr.getGenerationTime(), dataArr.getReceptionTime(), dataArr.getSeqCount());
            row.append(dataArr.getReceptionTime());
            for(var param : result.getParameterResult()){
                row.append(param.getEngValue()).append(",");
            }
            row.setLength(row.length()-1);
            try {
                csvWriter.write(row.toString());
                csvWriter.newLine();
            } catch (IOException e) {
                throw new RuntimeException(e);
            }

        }
    }

    /**
     * Converts array of floating point analog readings into a corresponding array of bytes.
     * @param floatValues array of analog readings
     * @return array of bytes corresponding to the incoming array of readings (just used Float.floatToIntBits)
     */
    private byte[] createAnalogBinaryPacket(double[] floatValues) {
        ByteBuffer buffer = ByteBuffer.allocate(floatValues.length * 4); // Each float is 4 bytes (32 bits)

        for (double value : floatValues) {
            int bits = Float.floatToIntBits((float) value);  // Convert float to 32-bit int representation
            buffer.putInt(bits);  // Add the 32-bit int to the byte buffer
        }

        return buffer.array();  // Return the packed byte array
    }


    @Override
    protected Status connectionStatus() {
        return isConnected ? Status.OK : Status.UNAVAIL;
    }

    @Override
    protected void doStart() {
        if (!isDisabled()) {
            Thread thread = new Thread(this);
            thread.setName(getClass().getSimpleName());
            thread.start();
        }
        notifyStarted();
    }

    @Override
    protected void doStop() {
        if(isConnected){
            executorService.shutdown();
            LabJackUtil.stopStream(deviceHandle);
            LJM.close(deviceHandle);
            isConnected = false;

            try {
                csvWriter.close();
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }
        notifyStopped();
    }

    @Override
    public void run() {
        while(!isConnected){
            attemptLabJackConnection();
            try {
                Thread.sleep(10000);
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
        }


        initializeCSVWriterAndTasks();
    }

    private void initializeCSVWriterAndTasks(){
        try {
            File file = new File(CSV_FILENAME);
            if(!file.exists()){
                file.getParentFile().mkdirs();
                log.info("Creating LabJack CSV file at: " + file.getAbsolutePath());
                csvWriter = new BufferedWriter(new FileWriter(file));
                writeCSVHeader();
            } else{
                csvWriter = new BufferedWriter(new FileWriter(file));
            }

        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        for(int digital_pin = 0; digital_pin < LabJackUtil.NUM_DIGITAL_PINS; ++digital_pin){
            writeDigitalPin(digital_pin, 0);
        }

        executorService = Executors.newScheduledThreadPool(5);
        // streamRead blocks until SCANS_PER_READ scans are ready, so 0-delay scheduleWithFixedDelay
        // gives continuous back-to-back reads without thread pile-up
        executorService.scheduleWithFixedDelay(this::streamRead, 0, 1, TimeUnit.MILLISECONDS);
        executorService.scheduleWithFixedDelay(this::readDigitalPinsTask, 0, 100, TimeUnit.MILLISECONDS);
        executorService.scheduleWithFixedDelay(this::savePacketToCSV, 1000, 500, TimeUnit.MILLISECONDS);
    }

    private void writeCSVHeader() throws IOException {
        StringBuilder stringBuilder = new StringBuilder();
        stringBuilder.append("Reception Time,");
        for(int i = LabJackUtil.ANALOG_PIN_START; i <= LabJackUtil.ANALOG_PIN_END; i++){
            stringBuilder.append("AIN").append(i).append(",");
        }
        for(int i = 0; i < LabJackUtil.NUM_DIGITAL_PINS; i++){
            stringBuilder.append("DIO").append(i).append(",");
        }
        stringBuilder.setLength(stringBuilder.length()-1);
        csvWriter.write(stringBuilder.toString());
        csvWriter.newLine();
    }

    @Override
    public void doDisable() {
        if (isConnected) {
            executorService.shutdown();
            LabJackUtil.stopStream(deviceHandle);
            LJM.close(deviceHandle);
            isConnected = false;
            try {
                csvWriter.close();
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }
    }

    @Override
    public void doEnable(){
        Thread thread = new Thread(this);
        thread.setName(getClass().getSimpleName() + "-" + linkName);
        thread.start();
    }



    @Override
    public String getDetailedStatus() {
        if (isDisabled()) {
            return "DISABLED";
        } else if(isConnected){
            return "OK, connected to LabJack";
        } else {
            return "UNAVAILABLE, not connected to LabJack";
        }
    }

    @Override
    public void init(String instance, String name, YConfiguration config) {
        super.init(instance, name, config);
        Mdb mdb = MdbFactory.getInstance("ground_station");
        tmExtractor = new XtceTmExtractor(mdb);
        sequenceContainer = mdb.getSequenceContainer("/LabJackT7/LabJackPacket");
        tmExtractor.startProviding(sequenceContainer);

        for(var seqEntry : sequenceContainer.getEntryList()){
            if(seqEntry instanceof ParameterEntry parameterEntry){
                tmExtractor.startProviding(parameterEntry.getParameter());
            }
        }

    }

    @Override
    public boolean sendCommand(PreparedCommand preparedCommand) {
        if(!isConnected){
            log.warn("Attempting to send LabJack commands while not being connected to a LabJack");
            return false;
        }
        var arguments = preparedCommand.getArgAssignment();
        int pinNum = -1;
        ArgumentValue valueToWrite = null;
        for(var argument : arguments.entrySet()){
            if(argument.getKey().getName().equals("pin_number")){
                pinNum = argument.getValue().getEngValue().getUint32Value();
            }else{
                valueToWrite = argument.getValue();
            }
        }

        if(preparedCommand.getCommandName().endsWith("write_digital_pin")){
            writeDigitalPin(pinNum, ((int) valueToWrite.getEngValue().getSint64Value()));
        }else if(preparedCommand.getCommandName().endsWith("write_DAC_pin")){
            writeDACPin(pinNum, valueToWrite.getEngValue().getFloatValue());
        }

        return true;
    }

    public void writeDigitalPin(int pinNum, int voltage){
        try{
            LabJackUtil.setDigitalPin(deviceHandle, pinNum, voltage);
            log.info("Wrote: " + voltage + " to digital pin " + pinNum);
        } catch (Exception e){
            log.error("Failed to write " + voltage + " to digital pin " + pinNum);
        }
    }

    public void writeDACPin(int pinNum, float voltage){
        try{
            LabJackUtil.setDACPin(deviceHandle, pinNum, voltage);
            log.info("Wrote: " + voltage + " to DAC pin " + pinNum);
        } catch (Exception e){
            log.error("Failed to write " + voltage + " to DAC pin " + pinNum);
        }

    }
}