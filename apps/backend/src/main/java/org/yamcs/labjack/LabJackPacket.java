package org.yamcs.labjack;

import java.nio.ByteBuffer;

/**
 * Binary (de)serialisation for the LabJack telemetry packet, matching the XTCE container
 * {@code /LabJackT7/LabJackPacket} in {@code labjack-t7.xml}.
 *
 * <p>Wire layout (big-endian), {@value #PACKET_SIZE} bytes total:
 * <ul>
 *   <li>{@link LabJackConfig#NUM_ANALOG_PINS} IEEE-754 float32 AIN values (AIN0 first)</li>
 *   <li>3 bytes of digital state — 23 DIO bits, MSB of byte 0 = DIO0/FIO0, last bit padding</li>
 * </ul>
 *
 * <p>This class centralises the (fiddly) DIO bit ordering so it lives in exactly one place and is
 * covered by unit tests, instead of being duplicated between the read path and the CSV writer.
 */
public final class LabJackPacket {
    /** Bytes of analog payload: one float32 per AIN channel. */
    public static final int ANALOG_BYTES = LabJackConfig.NUM_ANALOG_PINS * 4;
    /** Bytes of digital payload: 23 DIO bits packed MSB-first into 3 bytes (1 padding bit). */
    public static final int DIGITAL_BYTES = 3;
    /** Total packet size in bytes. */
    public static final int PACKET_SIZE = ANALOG_BYTES + DIGITAL_BYTES;

    private LabJackPacket() {}

    /**
     * Builds a full telemetry packet from one stream scan and the cached digital state.
     *
     * @param analogScan {@link LabJackConfig#NUM_ANALOG_PINS} analog readings (volts)
     * @param digitalState 3-byte digital payload from {@link #encodeDigitalState(long)}
     * @return packed {@value #PACKET_SIZE}-byte packet
     */
    public static byte[] build(double[] analogScan, byte[] digitalState) {
        if (analogScan.length != LabJackConfig.NUM_ANALOG_PINS) {
            throw new IllegalArgumentException(
                    "Expected " + LabJackConfig.NUM_ANALOG_PINS + " analog values, got " + analogScan.length);
        }
        if (digitalState.length != DIGITAL_BYTES) {
            throw new IllegalArgumentException("Expected " + DIGITAL_BYTES + " digital bytes");
        }
        ByteBuffer buf = ByteBuffer.allocate(PACKET_SIZE); // ByteBuffer defaults to big-endian
        for (double value : analogScan) {
            buf.putFloat((float) value);
        }
        buf.put(digitalState);
        return buf.array();
    }

    /**
     * Encodes the raw {@code DIO_STATE} register value (bit <i>i</i> = DIO<i>i</i>, bits 0-22) into the
     * 3-byte MSB-first wire format the MDB expects (DIO0 = most-significant bit of byte 0).
     */
    public static byte[] encodeDigitalState(long dioStateRegister) {
        // Place DIO0..DIO22 into bits 9..31, reverse so DIO0 lands at bit 22, then shift back up so the
        // 23 DIO bits occupy bits 31..9 (DIO0 = bit 31). Bits 8..0 are unused padding.
        int packed = Integer.reverse(((int) dioStateRegister) << 9) << 9;
        return new byte[] {
            (byte) (packed >> 24), // DIO0-7
            (byte) (packed >> 16), // DIO8-15
            (byte) (packed >> 8)   // DIO16-22 (+1 padding bit)
        };
    }

    /** Reads the {@link LabJackConfig#NUM_ANALOG_PINS} analog float values from a packet. */
    public static float[] readAnalog(byte[] packet) {
        ByteBuffer buf = ByteBuffer.wrap(packet);
        float[] out = new float[LabJackConfig.NUM_ANALOG_PINS];
        for (int i = 0; i < out.length; i++) {
            out[i] = buf.getFloat();
        }
        return out;
    }

    /**
     * Reads the {@link LabJackConfig#NUM_DIGITAL_PINS} DIO states (0/1) from a packet, in DIO0..DIO22
     * order. Inverse of {@link #encodeDigitalState(long)} for the bits that map to real pins.
     */
    public static int[] readDigitalBits(byte[] packet) {
        int d = ((packet[ANALOG_BYTES] & 0xFF) << 16)
                | ((packet[ANALOG_BYTES + 1] & 0xFF) << 8)
                | (packet[ANALOG_BYTES + 2] & 0xFF);
        int[] bits = new int[LabJackConfig.NUM_DIGITAL_PINS];
        for (int n = 0; n < bits.length; n++) {
            bits[n] = (d >> (23 - n)) & 1;
        }
        return bits;
    }
}
