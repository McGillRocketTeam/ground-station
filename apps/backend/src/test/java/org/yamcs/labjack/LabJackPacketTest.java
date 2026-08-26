package org.yamcs.labjack;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

/**
 * Covers the binary wire format — especially the fiddly 23-bit DIO packing — so it can't silently
 * drift from the MDB container. No hardware required.
 */
class LabJackPacketTest {

  @Test
  void packetSizeMatchesContainer() {
    // 14 float32 (56 bytes) + 3 DIO bytes
    assertEquals(LabJackConfig.NUM_ANALOG_PINS * 4 + 3, LabJackPacket.PACKET_SIZE);
    assertEquals(59, LabJackPacket.PACKET_SIZE);
  }

  @Test
  void analogRoundTrips() {
    double[] in = new double[LabJackConfig.NUM_ANALOG_PINS];
    for (int i = 0; i < in.length; i++) {
      in[i] = (i - 4) * 1.25; // mix of negative, zero, positive
    }
    byte[] packet = LabJackPacket.build(in, new byte[LabJackPacket.DIGITAL_BYTES]);
    float[] out = LabJackPacket.readAnalog(packet);

    assertEquals(in.length, out.length);
    for (int i = 0; i < in.length; i++) {
      assertEquals((float) in[i], out[i], 0.0f, "AIN" + i);
    }
  }

  @Test
  void digitalEncodeDecodeRoundTrips() {
    // bit i of the register == DIOi; check a non-trivial pattern, all-low and all-high.
    for (long reg : new long[] {0L, 0b101L, 0x2AAAAAL, 0x7FFFFFL, 0x155555L}) {
      byte[] packet =
          LabJackPacket.build(
              new double[LabJackConfig.NUM_ANALOG_PINS], LabJackPacket.encodeDigitalState(reg));
      int[] bits = LabJackPacket.readDigitalBits(packet);

      assertEquals(LabJackConfig.NUM_DIGITAL_PINS, bits.length);
      for (int n = 0; n < LabJackConfig.NUM_DIGITAL_PINS; n++) {
        assertEquals((int) ((reg >> n) & 1), bits[n], "DIO" + n + " for reg=" + reg);
      }
    }
  }

  @Test
  void dio0IsMostSignificantBitOfFirstDigitalByte() {
    // DIO0 high only -> MSB of the first digital byte set, everything else clear.
    byte[] dio = LabJackPacket.encodeDigitalState(0b1L);
    assertArrayEquals(new byte[] {(byte) 0x80, 0x00, 0x00}, dio);
  }
}
