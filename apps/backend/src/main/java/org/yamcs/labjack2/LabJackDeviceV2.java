package org.yamcs.labjack2;

import com.sun.jna.ptr.DoubleByReference;
import com.sun.jna.ptr.IntByReference;
import java.util.Arrays;
import java.util.Set;
import libs.LJMException;
import libs.LJM;
import org.yamcs.logging.Log;
import org.yamcs.labjack.LabJackPacket;

public class LabJackDeviceV2 {
    public record PollRead(double[] analogValues, byte[] digitalState) {}

    public record StreamRead(double[] data, int deviceBacklog, int ljmBacklog, int dummySamples) {}

    private static final Log log = new Log(LabJackDeviceV2.class);

    private static final int DIO_REGISTER_BASE = 2000;
    private static final int DAC_REGISTER_BASE = 1000;
    // T7 has 23 digital lines; watchdog direction/state uses a bitmask over all of them.
    private static final int DIO_ALL_OUTPUTS_MASK = 0x7FFFFF;
    // Present in LabJack docs but not in the bundled LJM.Errors enum.
    private static final int STREAM_SCAN_OVERLAP = 2942;

    private static final Set<LJM.Errors> DISCONNECT_ERRORS = Set.of(
            LJM.Errors.DEVICE_NOT_OPEN,
            LJM.Errors.STREAM_NOT_INITIALIZED,
            LJM.Errors.DEVICE_NOT_FOUND,
            LJM.Errors.SOCKET_LEVEL_ERROR,
            LJM.Errors.RECONNECT_FAILED,
            LJM.Errors.CONNECTION_HAS_YIELDED_RECONNECT_FAILED,
            LJM.Errors.STREAM_FLUSH_TIMEOUT,
            LJM.Errors.NO_RESPONSE_BYTES_RECEIVED,
            LJM.Errors.COULD_NOT_START_STREAM,
            LJM.Errors.STREAM_NOT_RUNNING);

    // These are stream failures where restarting the stream is the right recovery path.
    private static final Set<LJM.Errors> RESTART_STREAM_ERRORS = Set.of(
            LJM.Errors.LJM_BUFFER_FULL,
            LJM.Errors.DIGITAL_AUTO_RECOVERY_ERROR_DETECTED);

    private int handle;
    private boolean open;

    private static final String[] BASIC_READ_NAMES = buildBasicReadNames();

    public static void configureLibraryAutoReconnect() {
        try {
            LJM.writeLibraryConfigS("LJM_AUTO_RECONNECT_STICKY_CONNECTION", 1);
            LJM.writeLibraryConfigS("LJM_AUTO_RECONNECT_STICKY_SERIAL", 1);
        } catch (Exception e) {
            log.warn("Could not set LJM auto-reconnect config: " + e.getMessage());
        }
    }

    public static boolean isDisconnectError(int error) {
        return enumValue(error).map(DISCONNECT_ERRORS::contains).orElse(false);
    }

    public static boolean isRestartStreamError(int error) {
        return error == STREAM_SCAN_OVERLAP || enumValue(error).map(RESTART_STREAM_ERRORS::contains).orElse(false);
    }

    /**
     * Some stream-read failures recover cleanly by restarting the stream on the existing handle instead
     * of tearing the whole device session down.
     */
    public static boolean isRestartableStreamReadError(int error) {
        return switch (error) {
            case 1225, 1242, 1263, 1303, STREAM_SCAN_OVERLAP -> true;
            default -> enumValue(error).map(RESTART_STREAM_ERRORS::contains).orElse(false);
        };
    }

    /**
     * Some command-response reads can time out briefly while the stream is otherwise healthy. Treating
     * that as a full disconnect causes the "few packets, then reconnect loop" behavior.
     */
    public static boolean isTransientDigitalReadError(int error) {
        return error == LJM.Errors.NO_RESPONSE_BYTES_RECEIVED.getValue();
    }

    public static String errorName(int error) {
        if (error == STREAM_SCAN_OVERLAP) {
            return "STREAM_SCAN_OVERLAP";
        }
        return enumValue(error).map(Enum::name).orElse("UNKNOWN_ERROR");
    }

    private static java.util.Optional<LJM.Errors> enumValue(int error) {
        return Arrays.stream(LJM.Errors.values())
                .filter(value -> value.getValue() == error)
                .findFirst();
    }

    public boolean isOpen() {
        return open;
    }

    public void open() {
        try {
            IntByReference handleRef = new IntByReference();
            LJM.openS("ANY", "ANY", "ANY", handleRef);
            handle = handleRef.getValue();
            open = true;
        } catch (LJMException e) {
            logVisibleDevices("connect failed", e);
            throw e;
        }
    }

    private void logVisibleDevices(String context, LJMException cause) {
        try {
            String visibleDevices = discoverVisibleDevices();
            log.warn("LabJack discovery after " + context + " (" + cause.getMessage() + "): " + visibleDevices);
        } catch (Exception discoveryError) {
            log.warn("LabJack discovery failed after " + context + ": " + discoveryError.getMessage());
        }
    }

    static String discoverVisibleDevices() {
        final int maxDevices = 16;
        IntByReference numFound = new IntByReference();
        int[] deviceTypes = new int[maxDevices];
        int[] connectionTypes = new int[maxDevices];
        int[] serialNumbers = new int[maxDevices];
        int[] ipAddresses = new int[maxDevices];
        LJM.listAll(LJM.Constants.dtT7, LJM.Constants.ctANY, numFound, deviceTypes, connectionTypes,
                serialNumbers, ipAddresses);

        int count = Math.min(numFound.getValue(), maxDevices);
        if (count == 0) {
            return "no T7 devices discovered";
        }

        StringBuilder summary = new StringBuilder();
        for (int i = 0; i < count; i++) {
            if (i > 0) {
                summary.append("; ");
            }
            summary.append("serial=").append(serialNumbers[i])
                    .append(", transport=").append(connectionTypeName(connectionTypes[i]))
                    .append(", ip=").append(ipAddressToString(ipAddresses[i]))
                    .append(" (raw=").append(Integer.toUnsignedString(ipAddresses[i])).append(")");
        }
        if (numFound.getValue() > maxDevices) {
            summary.append("; ... ").append(numFound.getValue() - maxDevices).append(" more");
        }
        return summary.toString();
    }

    private static String connectionTypeName(int connectionType) {
        return switch (connectionType) {
            case LJM.Constants.ctUSB -> "USB";
            case LJM.Constants.ctETHERNET -> "ETHERNET";
            case LJM.Constants.ctWIFI -> "WIFI";
            case LJM.Constants.ctETHERNET_UDP -> "ETHERNET_UDP";
            case LJM.Constants.ctWIFI_UDP -> "WIFI_UDP";
            case LJM.Constants.ctETHERNET_ANY -> "ETHERNET_ANY";
            case LJM.Constants.ctWIFI_ANY -> "WIFI_ANY";
            default -> "UNKNOWN(" + connectionType + ")";
        };
    }

    static String ipAddressToString(int ipAddress) {
        long unsigned = Integer.toUnsignedLong(ipAddress);
        return ((unsigned >>> 24) & 0xFF) + "."
                + ((unsigned >>> 16) & 0xFF) + "."
                + ((unsigned >>> 8) & 0xFF) + "."
                + (unsigned & 0xFF);
    }

    public void close() {
        if (!open) {
            return;
        }
        try {
            LJM.close(handle);
        } catch (Exception e) {
            log.warn("Error closing LabJack handle: " + e.getMessage());
        } finally {
            open = false;
        }
    }

    public void configureAnalogRanges() {
        for (int channel = 0; channel < LabJackConfigV2.NUM_ANALOG_PINS; channel++) {
            LJM.eWriteName(handle, "AIN" + channel + "_RANGE", LabJackConfigV2.rangeForChannel(channel));
        }
    }

    /**
     * Minimal command-response configuration modeled after the official LJM write/read examples.
     */
    public void configureBasicReadLoop() {
        IntByReference errAddr = new IntByReference(-1);
        int framesPerChannel = 4;
        String[] names = new String[LabJackConfigV2.NUM_ANALOG_PINS * framesPerChannel];
        double[] values = new double[names.length];
        int index = 0;
        for (int channel = 0; channel < LabJackConfigV2.NUM_ANALOG_PINS; channel++) {
            names[index] = "AIN" + channel + "_NEGATIVE_CH";
            values[index++] = 199;
            names[index] = "AIN" + channel + "_RANGE";
            values[index++] = LabJackConfigV2.rangeForChannel(channel);
            names[index] = "AIN" + channel + "_RESOLUTION_INDEX";
            values[index++] = LabJackConfigV2.STREAM_RESOLUTION_INDEX;
            names[index] = "AIN" + channel + "_SETTLING_US";
            values[index++] = LabJackConfigV2.STREAM_SETTLING_US;
        }
        LJM.eWriteNames(handle, names.length, names, values, errAddr);
    }

    public PollRead readBasicLoop() {
        IntByReference errAddr = new IntByReference(-1);
        double[] values = new double[BASIC_READ_NAMES.length];
        LJM.eReadNames(handle, BASIC_READ_NAMES.length, BASIC_READ_NAMES, values, errAddr);

        double[] analogValues = Arrays.copyOf(values, LabJackConfigV2.NUM_ANALOG_PINS);
        byte[] digitalState = LabJackPacket.encodeDigitalState((long) values[LabJackConfigV2.NUM_ANALOG_PINS]);
        return new PollRead(analogValues, digitalState);
    }

    public void configureWatchdog() {
        // These *_DEFAULT registers persist on the device, so we set them once per link session.
        LJM.eWriteName(handle, "WATCHDOG_ENABLE_DEFAULT", 0);
        LJM.eWriteName(handle, "WATCHDOG_TIMEOUT_S_DEFAULT", LabJackConfigV2.WATCHDOG_TIMEOUT_S);
        LJM.eWriteName(handle, "WATCHDOG_RESET_ENABLE_DEFAULT", 0);
        LJM.eWriteName(handle, "WATCHDOG_DIO_ENABLE_DEFAULT", 1);
        LJM.eWriteName(handle, "WATCHDOG_DIO_INHIBIT_DEFAULT", 0);
        LJM.eWriteName(handle, "WATCHDOG_DIO_DIRECTION_DEFAULT", DIO_ALL_OUTPUTS_MASK);
        LJM.eWriteName(handle, "WATCHDOG_DIO_STATE_DEFAULT", 0);
        LJM.eWriteName(handle, "WATCHDOG_ENABLE_DEFAULT", 1);
    }

    public double startStream() {
        int[] scanList = new int[LabJackConfigV2.NUM_ANALOG_PINS];
        for (int i = 0; i < scanList.length; i++) {
            // Stream addresses for AIN# are # * 2 on the T7.
            scanList[i] = (LabJackConfigV2.ANALOG_PIN_START + i) * 2;
        }
        try {
            LJM.eStreamStop(handle);
        } catch (Exception ignored) {
        }
        LJM.eWriteName(handle, "STREAM_RESOLUTION_INDEX", LabJackConfigV2.STREAM_RESOLUTION_INDEX);
        LJM.eWriteName(handle, "STREAM_SETTLING_US", LabJackConfigV2.STREAM_SETTLING_US);
        DoubleByReference actualScanRate = new DoubleByReference(LabJackConfigV2.SCAN_RATE_HZ);
        LJM.eStreamStart(handle, LabJackConfigV2.SCANS_PER_READ, LabJackConfigV2.NUM_ANALOG_PINS, scanList,
                actualScanRate);
        return actualScanRate.getValue();
    }

    public StreamRead readStream() {
        double[] data = new double[LabJackConfigV2.SCANS_PER_READ * LabJackConfigV2.NUM_ANALOG_PINS];
        IntByReference deviceBacklog = new IntByReference();
        IntByReference ljmBacklog = new IntByReference();
        LJM.eStreamRead(handle, data, deviceBacklog, ljmBacklog);

        // LJM inserts -9999.0 when it has to preserve timing across dropped stream samples.
        int dummySamples = 0;
        for (double value : data) {
            if (value == -9999.0) {
                dummySamples++;
            }
        }

        return new StreamRead(data, deviceBacklog.getValue(), ljmBacklog.getValue(), dummySamples);
    }

    public void stopStream() {
        if (!open) {
            return;
        }
        try {
            LJM.eStreamStop(handle);
        } catch (Exception e) {
            log.warn("Stream stop failed: " + e.getMessage());
        } finally {
        }
    }

    public byte[] readDigitalState() {
        DoubleByReference ref = new DoubleByReference();
        LJM.eReadName(handle, "DIO_STATE", ref);
        return LabJackPacket.encodeDigitalState((long) ref.getValue());
    }

    public void writeDigitalPin(int pinNum, int state) {
        if (state != 0 && state != 1) {
            throw new IllegalArgumentException("Digital state must be 0 or 1, got " + state);
        }
        LJM.eWriteAddress(handle, DIO_REGISTER_BASE + pinNum, LJM.Constants.UINT16, state);
    }

    public int readDigitalPinState(int pinNum) {
        DoubleByReference ref = new DoubleByReference();
        LJM.eReadName(handle, "DIO_STATE", ref);
        return (int) ((((long) ref.getValue()) >> pinNum) & 1L);
    }

    public void writeDac(int pinNum, double volts) {
        LJM.eWriteAddress(handle, DAC_REGISTER_BASE + pinNum * 2, LJM.Constants.FLOAT32, volts);
    }

    public double readDac(int pinNum) {
        DoubleByReference ref = new DoubleByReference();
        LJM.eReadName(handle, "DAC" + pinNum, ref);
        return ref.getValue();
    }

    public void setAllDigitalLow() {
        for (int pin = 0; pin < LabJackConfigV2.NUM_DIGITAL_PINS; pin++) {
            writeDigitalPin(pin, 0);
        }
    }

    private static String[] buildBasicReadNames() {
        String[] names = new String[LabJackConfigV2.NUM_ANALOG_PINS + 1];
        for (int channel = 0; channel < LabJackConfigV2.NUM_ANALOG_PINS; channel++) {
            names[channel] = "AIN" + channel;
        }
        names[LabJackConfigV2.NUM_ANALOG_PINS] = "DIO_STATE";
        return names;
    }
}
