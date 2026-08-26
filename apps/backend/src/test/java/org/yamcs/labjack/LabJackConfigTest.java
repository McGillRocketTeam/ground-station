package org.yamcs.labjack;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

/** Sanity checks on the channel/range layout used by the HAL and the MDB. */
class LabJackConfigTest {

  @Test
  void analogChannelCount() {
    assertEquals(14, LabJackConfig.NUM_ANALOG_PINS);
    assertEquals(23, LabJackConfig.NUM_DIGITAL_PINS);
  }

  @Test
  void lowRangeChannelsUseOneVolt() {
    // AIN0-5 (load cells / CC pressure) -> ±1 V
    for (int ch = 0; ch < LabJackConfig.AIN_LOW_RANGE_CHANNEL_COUNT; ch++) {
      assertEquals(LabJackConfig.AIN_LOW_RANGE_V, LabJackConfig.rangeForChannel(ch), "AIN" + ch);
    }
  }

  @Test
  void highRangeChannelsUseTenVolts() {
    // AIN6-13 (Amazon pressure transducers) -> ±10 V
    for (int ch = LabJackConfig.AIN_LOW_RANGE_CHANNEL_COUNT;
        ch < LabJackConfig.NUM_ANALOG_PINS;
        ch++) {
      assertEquals(LabJackConfig.AIN_HIGH_RANGE_V, LabJackConfig.rangeForChannel(ch), "AIN" + ch);
    }
  }

  @Test
  void packetSamplingDefaultsMatchCheckedInConfig() {
    assertEquals(6, LabJackConfig.SCANS_PER_READ);
    assertEquals(12, LabJackConfig.GRAPH_FREQ);
    assertEquals(25.0, LabJackConfig.TM_PACKET_RATE_HZ);
    assertDoesNotThrow(() -> LabJackConfig.validateSamplingConfig(LabJackConfig.SCAN_RATE_HZ));
  }
}
