package org.yamcs.labjack;

import org.yamcs.YConfiguration;
import org.yamcs.logging.Log;

/**
 * Central place for every tunable that affects LabJack acquisition, the YAMCS publishing rate and the
 * watchdog. Values are plain {@code static} fields so they can be changed with a one-line edit and a
 * rebuild (per the DAQ "adjust via a static variable" workflow), and the most useful ones can also be
 * overridden at runtime from the link's {@code args:} block in {@code yamcs.ground_station.yaml} via
 * {@link #applyOverrides(YConfiguration)} — no recompile needed on the GS computer.
 *
 * <p>None of these touch sensor calibration; calibration lives in the MDB ({@code labjack-t7.xml}) and
 * is owned by the DAQ team.
 */
public final class LabJackConfig {
    private static final Log log = new Log(LabJackConfig.class);

    private LabJackConfig() {}

    // ---- Channel layout (T7) -------------------------------------------------------------------
    /** First streamed analog input (AIN0). */
    public static final int ANALOG_PIN_START = 0;
    /** Last streamed analog input (AIN13). */
    public static final int ANALOG_PIN_END = 13;
    /** Number of streamed analog channels (AIN0..AIN13 = 14). */
    public static final int NUM_ANALOG_PINS = ANALOG_PIN_END - ANALOG_PIN_START + 1;
    /** Digital lines on the T7 (FIO0-7, EIO0-7, CIO0-3, MIO0-2 = 23). */
    public static final int NUM_DIGITAL_PINS = 23;

    // ---- Stream acquisition (tune for the test) ------------------------------------------------
    /**
     * Stream scan rate in scans/channel/second. MVP target is 300 Hz; the performance test pushes this
     * to 500 Hz. T7 aggregate limit is 100 kSamples/s, so 14 channels * 500 Hz = 7 kS/s is well within
     * range (needs {@link #STREAM_RESOLUTION_INDEX} 0 or 1).
     */
    public static double SCAN_RATE_HZ = 300.0;
    /**
     * Scans returned per {@code eStreamRead}. This is the "stream mode buffer size" knob the DAQ test
     * report calls out: larger = fewer, bigger batches (multiple data points land in YAMCS at the same
     * timestamp); smaller = lower latency. eStreamRead blocks until this many scans are buffered, so at
     * 300 Hz a value of 30 yields ~10 reads/s (~100 ms batches).
     */
    public static int SCANS_PER_READ = 30;
    /** 0 = max speed/lowest resolution (required to reach the higher scan rates), up to 8 = slowest. */
    public static int STREAM_RESOLUTION_INDEX = 0;
    /** Per-channel settling time; 0 = auto. Increase only if STREAM_SCAN_OVERLAP warnings appear. */
    public static int STREAM_SETTLING_US = 0;

    // ---- Analog input ranges -------------------------------------------------------------------
    /** AIN channels < this index use {@link #AIN_LOW_RANGE_V}; the rest use {@link #AIN_HIGH_RANGE_V}. */
    public static int AIN_LOW_RANGE_CHANNEL_COUNT = 6; // AIN0-5
    /** ±1 V — load cells / CC pressure (high resolution). */
    public static double AIN_LOW_RANGE_V = 1.0;
    /** ±10 V — Amazon pressure transducers (full scale). */
    public static double AIN_HIGH_RANGE_V = 10.0;

    /** Range (volts) the given AIN channel should be configured to. */
    public static double rangeForChannel(int channel) {
        return channel < AIN_LOW_RANGE_CHANNEL_COUNT ? AIN_LOW_RANGE_V : AIN_HIGH_RANGE_V;
    }

    // ---- YAMCS publishing rate (IO-latency control) --------------------------------------------
    /**
     * Realtime decimation: forward 1 of every {@code GRAPH_FREQ} scans to the realtime processor (the
     * frontend). 1 = send every scan. Raising this throttles the websocket/UI without affecting the CSV
     * (always full rate) or — when {@link #ARCHIVE_FULL_RATE} is on — the YAMCS archive.
     */
    public static int GRAPH_FREQ = 1;
    /**
     * When true, every scan is also written to {@link #ARCHIVE_STREAM} so the YAMCS archive keeps the
     * full raw sample rate while the realtime/frontend path stays decimated by {@link #GRAPH_FREQ}.
     * Leave false for the MVP test (single-stream GRAPH_FREQ behaviour); enable for the 500 Hz
     * performance test. The second stream must be declared in streamConfig — see yamcs.ground_station.yaml.
     */
    public static boolean ARCHIVE_FULL_RATE = false;
    /** Archive-only stream used when {@link #ARCHIVE_FULL_RATE} is on. */
    public static String ARCHIVE_STREAM = "tm_labjack_hires";

    // ---- Watchdog ------------------------------------------------------------------------------
    /** Hardware watchdog timeout in seconds. Fires (resets DIO low) after this long with no CS comms. */
    public static int WATCHDOG_TIMEOUT_S = 300; // 5 minutes

    // ---- Connection / recovery -----------------------------------------------------------------
    /** Delay between connection attempts while the LabJack is absent (ms). */
    public static long CONNECT_RETRY_MS = 2000;
    /** Initial backoff after a stream failure before attempting to re-open (ms). */
    public static long RECONNECT_BACKOFF_MS = 1000;
    /** Upper bound for the exponential reconnect backoff (ms). */
    public static long RECONNECT_BACKOFF_MAX_MS = 10_000;

    // ---- CSV -----------------------------------------------------------------------------------
    /** Directory (relative to the YAMCS working dir) for the full-rate local CSV records. */
    public static String CSV_DIR = "yamcs-data/labjack_csv";

    /**
     * Optionally override the runtime-tunable fields from the link config. Unknown keys are ignored, so
     * an empty {@code args:} block leaves all defaults in place. Called from {@code LabJackDataLink.init}.
     */
    public static void applyOverrides(YConfiguration config) {
        if (config == null) {
            return;
        }
        SCAN_RATE_HZ = config.getDouble("scanRateHz", SCAN_RATE_HZ);
        SCANS_PER_READ = config.getInt("scansPerRead", SCANS_PER_READ);
        STREAM_RESOLUTION_INDEX = config.getInt("streamResolutionIndex", STREAM_RESOLUTION_INDEX);
        GRAPH_FREQ = Math.max(1, config.getInt("graphFreq", GRAPH_FREQ));
        ARCHIVE_FULL_RATE = config.getBoolean("archiveFullRate", ARCHIVE_FULL_RATE);
        ARCHIVE_STREAM = config.getString("archiveStream", ARCHIVE_STREAM);
        WATCHDOG_TIMEOUT_S = config.getInt("watchdogTimeoutS", WATCHDOG_TIMEOUT_S);
        CSV_DIR = config.getString("csvDir", CSV_DIR);
        log.info("LabJack config: scanRate={} Hz, scansPerRead={}, resolutionIndex={}, graphFreq={}, "
                + "archiveFullRate={}, watchdogTimeout={} s",
                SCAN_RATE_HZ, SCANS_PER_READ, STREAM_RESOLUTION_INDEX, GRAPH_FREQ,
                ARCHIVE_FULL_RATE, WATCHDOG_TIMEOUT_S);
    }
}
