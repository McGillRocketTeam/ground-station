package org.yamcs.labjack;

import com.sun.jna.ptr.DoubleByReference;
import com.sun.jna.ptr.IntByReference;
import java.util.Set;
import libs.LJM;
import libs.LJMException;
import org.yamcs.logging.Log;

/**
 * Instance-based hardware abstraction layer for a single LabJack T7 — replaces the old static
 * {@code LabJackUtil}. It owns the LJM device handle and exposes only the operations the data link
 * needs (open/stream/read/digital IO/watchdog), translating LJM register access into intent-revealing
 * methods.
 *
 * <p>Failures propagate as {@link LJMException} (carrying the numeric LJM error code via
 * {@link LJMException#getError()}); the caller uses {@link #isDisconnectError(int)} to decide whether a
 * failure means "device went away, re-establish the stream". The class is intentionally non-final with
 * overridable methods so tests can subclass it with a fake (no hardware / no Mockito required).
 */
public class LabJackDevice {
    private static final Log log = new Log(LabJackDevice.class);

    // LabJack Modbus register bases (T7). DIO# lives at 2000+#, DAC# at 1000+(#*2).
    private static final int DIO_REGISTER_BASE = 2000;
    private static final int DAC_REGISTER_BASE = 1000;
    private static final int DIO_ALL_OUTPUTS_MASK = 0x7FFFFF; // 23 DIO bits

    /**
     * LJM error codes (see {@link libs.LJM}) that mean the connection/stream is gone and we must
     * re-open and restart the stream rather than keep reading. Anything else is treated as transient.
     */
    private static final Set<Integer> DISCONNECT_ERRORS = Set.of(
            1224, // DEVICE_NOT_OPEN
            1225, // STREAM_NOT_INITIALIZED
            1227, // DEVICE_NOT_FOUND
            1233, // SOCKET_LEVEL_ERROR
            1239, // RECONNECT_FAILED
            1240, // CONNECTION_HAS_YIELDED_RECONNECT_FAILED
            1242, // STREAM_FLUSH_TIMEOUT
            1302, // COULD_NOT_START_STREAM
            1303  // STREAM_NOT_RUNNING
    );

    private int handle = 0;
    private boolean open = false;
    private boolean streaming = false;

    /** True if the given LJM error code indicates the device link dropped (stream must be re-established). */
    public static boolean isDisconnectError(int ljmError) {
        return DISCONNECT_ERRORS.contains(ljmError);
    }

    /**
     * Best-effort: ask LJM to keep trying to re-attach to the same physical device if a connection
     * drops. Complements the explicit reconnect loop in the data link; never fatal if unsupported.
     */
    public static void configureLibraryAutoReconnect() {
        try {
            LJM.writeLibraryConfigS("LJM_AUTO_RECONNECT_STICKY_CONNECTION", 1);
            LJM.writeLibraryConfigS("LJM_AUTO_RECONNECT_STICKY_SERIAL", 1);
        } catch (Exception e) {
            log.warn("Could not set LJM auto-reconnect config: " + e.getMessage());
        }
    }

    /** Opens any reachable LabJack (ethernet or USB). */
    public void open() {
        IntByReference handleRef = new IntByReference(0);
        LJM.openS("ANY", "ANY", "ANY", handleRef);
        handle = handleRef.getValue();
        open = true;
        streaming = false;
        log.info("LabJack opened (handle " + handle + ")");
    }

    public boolean isOpen() {
        return open;
    }

    public boolean isStreaming() {
        return streaming;
    }

    /** Closes the device handle. Safe to call when already closed. */
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
            streaming = false;
        }
    }

    /** Sets each AIN channel to its configured range (see {@link LabJackConfig#rangeForChannel(int)}). */
    public void configureAnalogRanges() {
        for (int i = 0; i < LabJackConfig.NUM_ANALOG_PINS; i++) {
            LJM.eWriteName(handle, "AIN" + i + "_RANGE", LabJackConfig.rangeForChannel(i));
        }
        log.info("AIN ranges set (AIN0-" + (LabJackConfig.AIN_LOW_RANGE_CHANNEL_COUNT - 1) + " = ±"
                + LabJackConfig.AIN_LOW_RANGE_V + "V, rest = ±" + LabJackConfig.AIN_HIGH_RANGE_V + "V)");
    }

    /**
     * Arms the T7 hardware watchdog (datasheet §23) to drive <b>all 23 DIO low</b> — without rebooting —
     * if it times out after {@link LabJackConfig#WATCHDOG_TIMEOUT_S} seconds with no qualifying comms.
     * Uses LJM register <i>names</i> so the address map can't drift. Register semantics (per §23):
     * <ul>
     *   <li>{@code DIO_ENABLE=1} — enable the DIO failsafe action</li>
     *   <li>{@code DIO_INHIBIT=0} — bitmask where 1 = protect/skip a line; 0 affects every DIO</li>
     *   <li>{@code DIO_DIRECTION=0x7FFFFF} — bitmask where 1 = drive as output (all 23 lines)</li>
     *   <li>{@code DIO_STATE=0} — level bitmask; all low</li>
     *   <li>{@code RESET_ENABLE=0} — do <b>not</b> reboot the device on timeout (DIO-low only)</li>
     * </ul>
     * The previous code never set DIO_DIRECTION, so the lines stayed inputs and were not actually
     * driven low — fixed here.
     *
     * <p><b>Feeding the timer:</b> §23 "When Using Stream" — spontaneous stream data does NOT reset the
     * watchdog; only a command-response exchange does. The data link's periodic {@code DIO_STATE} read
     * supplies exactly that, so the watchdog stays fed during normal streaming and only trips when the
     * control station goes silent.
     *
     * <p>These are {@code *_DEFAULT} (flash-backed) registers; frequent writes wear the flash, so the
     * data link calls this only once per session (the settings persist across device reboots anyway).
     */
    public void configureWatchdog() {
        LJM.eWriteName(handle, "WATCHDOG_ENABLE_DEFAULT", 0); // disable while (re)configuring
        LJM.eWriteName(handle, "WATCHDOG_TIMEOUT_S_DEFAULT", LabJackConfig.WATCHDOG_TIMEOUT_S);
        LJM.eWriteName(handle, "WATCHDOG_RESET_ENABLE_DEFAULT", 0);          // no reboot on timeout
        LJM.eWriteName(handle, "WATCHDOG_DIO_ENABLE_DEFAULT", 1);            // drive DIO on timeout
        LJM.eWriteName(handle, "WATCHDOG_DIO_INHIBIT_DEFAULT", 0);           // 0 = affect all 23 DIO
        LJM.eWriteName(handle, "WATCHDOG_DIO_DIRECTION_DEFAULT", DIO_ALL_OUTPUTS_MASK); // all outputs
        LJM.eWriteName(handle, "WATCHDOG_DIO_STATE_DEFAULT", 0);             // all LOW
        LJM.eWriteName(handle, "WATCHDOG_ENABLE_DEFAULT", 1);                // enable
        log.info("Watchdog armed: " + LabJackConfig.WATCHDOG_TIMEOUT_S
                + "s timeout, all 23 DIO -> LOW on trip (no reboot)");
    }

    /** Starts stream mode over AIN0..AIN13 at {@link LabJackConfig#SCAN_RATE_HZ}. */
    public void startStream() {
        int[] scanList = new int[LabJackConfig.NUM_ANALOG_PINS];
        for (int i = 0; i < LabJackConfig.NUM_ANALOG_PINS; i++) {
            scanList[i] = (LabJackConfig.ANALOG_PIN_START + i) * 2; // AIN# register address = #*2
        }
        // The device persists stream state across host restarts; clear any leftover stream first.
        try {
            LJM.eStreamStop(handle);
        } catch (Exception ignored) {
            // no stream was running — fine
        }
        LJM.eWriteName(handle, "STREAM_RESOLUTION_INDEX", LabJackConfig.STREAM_RESOLUTION_INDEX);
        LJM.eWriteName(handle, "STREAM_SETTLING_US", LabJackConfig.STREAM_SETTLING_US);
        DoubleByReference actualScanRate = new DoubleByReference(LabJackConfig.SCAN_RATE_HZ);
        LJM.eStreamStart(handle, LabJackConfig.SCANS_PER_READ, LabJackConfig.NUM_ANALOG_PINS,
                scanList, actualScanRate);
        streaming = true;
        log.info("Stream started: requested " + LabJackConfig.SCAN_RATE_HZ + " Hz, actual "
                + actualScanRate.getValue() + " Hz, " + LabJackConfig.SCANS_PER_READ + " scans/read");
    }

    /**
     * Reads one batch ({@link LabJackConfig#SCANS_PER_READ} scans). Blocks until the data is buffered.
     * Throws {@link LJMException} on failure (inspect {@link #isDisconnectError(int)}); never returns null.
     *
     * @return flat array of {@code SCANS_PER_READ * NUM_ANALOG_PINS} values, scan-major
     */
    public double[] readStream() {
        double[] data = new double[LabJackConfig.SCANS_PER_READ * LabJackConfig.NUM_ANALOG_PINS];
        LJM.eStreamRead(handle, data, new IntByReference(0), new IntByReference(0));
        return data;
    }

    /** Stops stream mode (best-effort). */
    public void stopStream() {
        if (!open) {
            return;
        }
        try {
            LJM.eStreamStop(handle);
        } catch (Exception e) {
            log.warn("Stream stop failed: " + e.getMessage());
        } finally {
            streaming = false;
        }
    }

    /**
     * Reads {@code DIO_STATE} (all 23 digital lines at once — avoids the input-mode side effect of
     * reading pins individually) and returns it in the 3-byte wire format.
     */
    public byte[] readDigitalState() {
        DoubleByReference ref = new DoubleByReference();
        LJM.eReadName(handle, "DIO_STATE", ref);
        return LabJackPacket.encodeDigitalState((long) ref.getValue());
    }

    /** Drives one digital line (0-22) high or low. */
    public void writeDigitalPin(int pinNum, int state) {
        if (state != 0 && state != 1) {
            throw new IllegalArgumentException("Digital state must be 0 or 1, got " + state);
        }
        LJM.eWriteAddress(handle, DIO_REGISTER_BASE + pinNum, LJM.Constants.UINT16, state);
    }

    /** Drives all 23 digital lines low (safe state). Used on connect and after a reconnect. */
    public void setAllDigitalLow() {
        for (int pin = 0; pin < LabJackConfig.NUM_DIGITAL_PINS; pin++) {
            writeDigitalPin(pin, 0);
        }
    }

    /** Sets a DAC output (0-1) to the given voltage (0-5 V). */
    public void writeDac(int pinNum, double volts) {
        LJM.eWriteAddress(handle, DAC_REGISTER_BASE + pinNum * 2, LJM.Constants.FLOAT32, volts);
    }
}
