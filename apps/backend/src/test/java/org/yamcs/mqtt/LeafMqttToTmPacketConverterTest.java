package org.yamcs.mqtt;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

public class LeafMqttToTmPacketConverterTest {

    @Test
    public void testBasicHexValues() {
        String hexString = "0x44 0x1c 0xa 0x0 0x2 0x30 0xf2 0xfb";
        byte[] expected = { 0x44, 0x1C, 0x0A, 0x00, 0x02, 0x30, (byte) 0xF2, (byte) 0xFB };
        byte[] actual = LeafMqttToTmPacketConverter.parseHexString(hexString);
        assertArrayEquals(expected, actual);
    }

    @Test
    public void testSingleHexDigitValues() {
        String hexString = "0x1 0x2 0x3 0x4 0x5";
        byte[] expected = { 0x01, 0x02, 0x03, 0x04, 0x05 };
        byte[] actual = LeafMqttToTmPacketConverter.parseHexString(hexString);
        assertArrayEquals(expected, actual);
    }

    @Test
    public void testMixedFormatsWithSpacesAndNewlines() {
        String hexString = "0x00 0x01 0xFF\n0xAB 0xCD 0xEF";
        byte[] expected = { 0x00, 0x01, (byte) 0xFF, (byte) 0xAB, (byte) 0xCD, (byte) 0xEF };
        byte[] actual = LeafMqttToTmPacketConverter.parseHexString(hexString);
        assertArrayEquals(expected, actual);
    }

    @Test
    public void testHexValuesWithDifferentLengths() {
        String hexString = "0x10 0x1F 0xA0 0x1 0xFF";
        byte[] expected = { 0x10, 0x1F, (byte) 0xA0, 0x01, (byte) 0xFF };
        byte[] actual = LeafMqttToTmPacketConverter.parseHexString(hexString);
        assertArrayEquals(expected, actual);
    }

    @Test
    public void testLeadingAndTrailingWhitespace() {
        String hexString = "   0x10 0x1F 0xa0 0x01 0xFF   ";
        byte[] expected = { 0x10, 0x1F, (byte) 0xA0, 0x01, (byte) 0xFF };
        byte[] actual = LeafMqttToTmPacketConverter.parseHexString(hexString);
        assertArrayEquals(expected, actual);
    }

    @Test
    public void testNoHexValues() {
        String hexString = "";
        byte[] expected = {};
        byte[] actual = LeafMqttToTmPacketConverter.parseHexString(hexString);
        assertArrayEquals(expected, actual);
    }

    @Test
    public void testInvalidHexPrefix() {
        String hexString = "0x10 0x1F 0xG0"; // 'G' is not a valid hex digit
        assertThrows(NumberFormatException.class, () -> {
            LeafMqttToTmPacketConverter.parseHexString(hexString);
        });
    }
}
