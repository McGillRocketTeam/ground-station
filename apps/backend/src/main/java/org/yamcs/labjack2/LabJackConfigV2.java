package org.yamcs.labjack2;

import org.yamcs.YConfiguration;
import org.yamcs.logging.Log;

public final class LabJackConfigV2 {
  private static final Log log = new Log(LabJackConfigV2.class);
  private static final double MIN_REALTIME_PACKET_RATE_HZ = 5.0;

  public static final int ANALOG_PIN_START = 0;
  public static final int ANALOG_PIN_END = 13;
  public static final int NUM_ANALOG_PINS = ANALOG_PIN_END - ANALOG_PIN_START + 1;
  public static final int NUM_DIGITAL_PINS = 23;

  public static double SCAN_RATE_HZ = 25.0;
  public static int SCANS_PER_READ = 6;
  public static int STREAM_RESOLUTION_INDEX = 0;
  public static int STREAM_SETTLING_US = 0;

  public static int AIN_LOW_RANGE_CHANNEL_COUNT = 6;
  public static double AIN_LOW_RANGE_V = 1.0;
  public static double AIN_HIGH_RANGE_V = 10.0;

  public static double TM_PACKET_RATE_HZ = 5.0;
  public static double TM_PACKET_RATE_TOLERANCE_HZ = 0.01;
  public static boolean ARCHIVE_FULL_RATE = false;
  public static String ARCHIVE_STREAM = "tm_labjack_hires";

  public static double DAC_READBACK_TOLERANCE_V = 0.05;
  public static int WATCHDOG_TIMEOUT_S = 300;
  public static long CONNECT_RETRY_MS = 1000;
  // Stream data does not feed the watchdog. This command-response read does, so once per second is
  // enough.
  public static long DIGITAL_FEED_INTERVAL_MS = 1000;
  public static String CSV_DIR = "yamcs-data/labjack_csv";

  private LabJackConfigV2() {}

  public static double rangeForChannel(int channel) {
    return channel < AIN_LOW_RANGE_CHANNEL_COUNT ? AIN_LOW_RANGE_V : AIN_HIGH_RANGE_V;
  }

  public static void applyOverrides(YConfiguration config) {
    if (config == null) {
      return;
    }

    SCAN_RATE_HZ = config.getDouble("scanRateHz", SCAN_RATE_HZ);
    SCANS_PER_READ = config.getInt("scansPerRead", SCANS_PER_READ);
    STREAM_RESOLUTION_INDEX = config.getInt("streamResolutionIndex", STREAM_RESOLUTION_INDEX);
    TM_PACKET_RATE_HZ = config.getDouble("tmPacketRateHz", TM_PACKET_RATE_HZ);
    ARCHIVE_FULL_RATE = config.getBoolean("archiveFullRate", ARCHIVE_FULL_RATE);
    ARCHIVE_STREAM = config.getString("archiveStream", ARCHIVE_STREAM);
    WATCHDOG_TIMEOUT_S = config.getInt("watchdogTimeoutS", WATCHDOG_TIMEOUT_S);
    DIGITAL_FEED_INTERVAL_MS = config.getLong("digitalFeedIntervalMs", DIGITAL_FEED_INTERVAL_MS);
    CSV_DIR = config.getString("csvDir", CSV_DIR);

    validateSamplingConfig(SCAN_RATE_HZ);
    log.info(
        "LabJackV2 config: scanRate={} Hz, scansPerRead={}, resolutionIndex={}, "
            + "tmPacketRate={} Hz, archiveFullRate={}, watchdogTimeout={} s",
        SCAN_RATE_HZ,
        SCANS_PER_READ,
        STREAM_RESOLUTION_INDEX,
        TM_PACKET_RATE_HZ,
        ARCHIVE_FULL_RATE,
        WATCHDOG_TIMEOUT_S);
  }

  public static void validateSamplingConfig(double achievedScanRateHz) {
    if (TM_PACKET_RATE_HZ < MIN_REALTIME_PACKET_RATE_HZ) {
      throw new IllegalArgumentException(
          "LabJackV2 realtime packet rate must be at least "
              + MIN_REALTIME_PACKET_RATE_HZ
              + " Hz, got "
              + TM_PACKET_RATE_HZ
              + " Hz");
    }
    if (TM_PACKET_RATE_HZ > achievedScanRateHz + TM_PACKET_RATE_TOLERANCE_HZ) {
      throw new IllegalArgumentException(
          "LabJackV2 packet rate cannot exceed scan rate: packetRateHz="
              + TM_PACKET_RATE_HZ
              + ", scanRateHz="
              + achievedScanRateHz
              + " Hz");
    }
  }
}
