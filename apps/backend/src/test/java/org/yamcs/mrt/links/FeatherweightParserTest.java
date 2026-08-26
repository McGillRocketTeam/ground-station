package org.yamcs.mrt.links;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.yamcs.xtce.xml.XtceStaxReader;

class FeatherweightParserTest {
  @Test
  void parsesGpsPacketAndChecksCrc() {
    String withoutCrc =
        "@ GPS_STAT 202 0000 00 00 00:25:35.528 CRC_OK TRK GPSTrk06707 Alt 000000 lt +00.00000 ln +00.00000 Vel +0000 +000 +0000 Fix 3 # 9 4 2 0 123_45_40 000_00_00 000_00_00 000_00_00 000_00_00";
    FeatherweightParser.Packet packet = parseWithCrc(withoutCrc);

    assertNotNull(packet);
    assertTrue(packet.crcValid());
    assertEquals("GPS_STAT", packet.type());
    assertEquals("GPSTrk06707", packet.values().get("lora_id"));
    assertEquals(3L, packet.values().get("fix_type"));
    assertEquals(123L, packet.values().get("satellite_1_azimuth_deg"));
    assertEquals(40L, packet.values().get("satellite_1_strength_db_hz"));
  }

  @Test
  void parsesObservedGroundStationAndTransmitPackets() {
    FeatherweightParser.Packet ground =
        parseWithCrc(
            "@ GS_STAT 198 0000 00 00 00:25:35.528 CRC_OK GPSTrk06707 PkRx 105 PkSnt 107 p_RSSI -49 AckRx 0 AckSnt 104 a_RSSI -62 temporary FndRx 0 FndSnt 0 f_RSSI -50 SF 10 f 904600000");
    FeatherweightParser.Packet transmit =
        parseWithCrc(
            "@ TX_STAT 109 0000 00 00 00:25:35.554 GPSTrk06707 Tx Apid 0A Tx dur: 62 msec SF10 Freq 904600000");

    assertNotNull(ground);
    assertEquals(-49L, ground.values().get("packet_rssi_dbm"));
    assertNotNull(transmit);
    assertEquals(10L, transmit.values().get("apid"));
  }

  @Test
  void crc16BypassMatchesStandardCheckValue() {
    assertEquals(
        0xfee8, FeatherweightParser.crc16Bypass("123456789".getBytes(StandardCharsets.US_ASCII)));
  }

  @Test
  void parsesCapturePacketWithDeviceCrc() {
    FeatherweightParser.Packet packet =
        FeatherweightParser.parse(
            "@ TX_STAT  109 0000 00 00 00:25:35.554 GPSTrk06707 Tx Apid 00 Tx dur: 62 msec SF10 Freq 904600000 CRC: 8695");

    assertNotNull(packet);
    assertTrue(packet.crcValid());
  }

  @Test
  void featherweightMdbLoads() throws Exception {
    assertEquals(
        81,
        new XtceStaxReader("src/main/yamcs/mdb/featherweight.xml")
            .readXmlDocument()
            .getParameterCount(true));
  }

  private static FeatherweightParser.Packet parseWithCrc(String packet) {
    int crc = FeatherweightParser.crc16Bypass(packet.getBytes(StandardCharsets.US_ASCII));
    return FeatherweightParser.parse(packet + " CRC: " + String.format("%04X", crc));
  }
}
