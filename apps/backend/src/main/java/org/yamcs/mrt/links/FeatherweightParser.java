package org.yamcs.mrt.links;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Parses the user-facing ASCII protocol emitted by a Featherweight Ground Station V2. */
final class FeatherweightParser {
  record Packet(String type, Map<String, Object> values, String raw, boolean crcValid) {}

  private static final Pattern ENVELOPE =
      Pattern.compile(
          "^@\\s+(\\w+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d{1,2}:\\d{2}:\\d{2}\\.\\d+)\\s+(.*)\\s+CRC:\\s*([0-9A-Fa-f]{4})(?:\\s+([0-9A-Fa-f]{4}))?$");
  private static final Pattern GPS =
      Pattern.compile(
          "(?:CRC_(OK|ERR)\\s+)?(TRK|GS|FND)\\s+(\\S+)\\s+Alt\\s+([+-]?\\d+)\\s+lt\\s+([+-]?[\\d.]+)\\s+ln\\s+([+-]?[\\d.]+)\\s+Vel\\s+([+-]?\\d+)\\s+([+-]?\\d+)\\s+([+-]?\\d+)\\s+Fix\\s+(\\d+)\\s+#\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)");
  private static final Pattern RX_NOMTK =
      Pattern.compile(
          "(?:CRC_(OK|ERR)\\s+)?Rx\\s+NomTrk\\s+(\\S+)\\s+PkRx\\s+(\\d+)\\s+PkTx\\s+(\\d+)\\s+RSSI\\s+([+-]?\\d+)\\s+SNR\\s+([+-]?\\d+)\\s+AckRx\\s+(\\d+)\\s+AckTx\\s+(\\d+)\\s+RSSI\\s+([+-]?\\d+)\\s+SNR\\s+([+-]?\\d+)\\s+SF\\s*:?\\s*(\\d+)\\s+frq\\s+(\\d+)\\s+trk_B_V\\s+(\\d+)\\s+([+-]?\\d+)\\s+C");
  private static final Pattern GS_STAT =
      Pattern.compile(
          "(?:CRC_(OK|ERR)\\s+)?(\\S+)\\s+PkRx\\s+(\\d+)\\s+PkSnt\\s+(\\d+)\\s+p_RSSI\\s+([+-]?\\d+)\\s+AckRx\\s+(\\d+)\\s+AckSnt\\s+(\\d+)\\s+a_RSSI\\s+([+-]?\\d+)\\s+(\\S+)\\s+FndRx\\s+(\\d+)\\s+FndSnt\\s+(\\d+)\\s+f_RSSI\\s+([+-]?\\d+)\\s+SF\\s*:?\\s*(\\d+)\\s+f\\s+(\\d+)");
  private static final Pattern RX_FOUND =
      Pattern.compile(
          "(?:CRC_(OK|ERR)\\s+)?(\\S+)\\s+PkRx\\s+(\\d+)\\s+PkSnt\\s+(\\d+)\\s+p_RSSI\\s+([+-]?\\d+)\\s+AckRx\\s+(\\d+)\\s+AckSnt\\s+(\\d+)\\s+a_RSSI\\s+([+-]?\\d+)\\s+(\\S+)\\s+FndRx\\s+(\\d+)\\s+FndSnt\\s+(\\d+)\\s+f_RSSI\\s+([+-]?\\d+)\\s+SF\\s*:?\\s*(\\d+)\\s+f\\s+(\\d+)");
  private static final Pattern TX =
      Pattern.compile(
          "(\\S+)\\s+Tx\\s+Apid\\s+([0-9A-Fa-f]+)\\s+Tx\\s+dur:\\s+(\\d+)\\s+msec\\.?\\s+SF\\s*:?\\s*(\\d+)\\s+Freq\\s+(\\d+)");
  private static final Pattern RX_COORD =
      Pattern.compile(
          "(?:CRC_(OK|ERR)\\s+)?Rx\\s+(?:GS_Coord|CoordFound)\\s+(\\S+)\\s+RSSI\\s+([+-]?\\d+)\\s+SNR\\s+([+-]?\\d+)\\s+SF\\s*:?\\s*(\\d+)\\s+freq\\s+(\\d+)");

  private FeatherweightParser() {}

  static Packet parse(String raw) {
    Matcher envelope = ENVELOPE.matcher(raw.trim());
    if (!envelope.matches()) {
      return null;
    }

    String type = envelope.group(1);
    Map<String, Object> values = new LinkedHashMap<>();
    put(values, "packet_length", envelope.group(2));
    put(values, "year", envelope.group(3));
    put(values, "month", envelope.group(4));
    put(values, "day", envelope.group(5));
    values.put("time", envelope.group(6));
    values.put("received_crc", Integer.parseInt(envelope.group(8), 16));
    if (envelope.group(9) != null) {
      values.put("uart_crc", Integer.parseInt(envelope.group(9), 16));
    }

    int crcHeader = raw.lastIndexOf("CRC:");
    String crcInput = raw.substring(raw.indexOf('@'), crcHeader).stripTrailing();
    int computedCrc = crc16Bypass(crcInput.getBytes(StandardCharsets.US_ASCII));
    values.put("computed_crc", computedCrc);
    boolean crcValid = computedCrc == (int) values.get("received_crc");
    values.put("crc_valid", crcValid);

    String body = envelope.group(7).trim();
    boolean parsed = parseBody(type, body, values);
    return parsed ? new Packet(type, Map.copyOf(values), raw, crcValid) : null;
  }

  private static boolean parseBody(String type, String body, Map<String, Object> values) {
    return switch (type) {
      case "GPS_STAT" -> parseGps(body, values);
      case "RX_NOMTK" -> parseRxNomtk(body, values);
      case "GS_STAT" -> matchGroundStats(GS_STAT.matcher(body), values, false);
      case "RX_FOUND" -> matchGroundStats(RX_FOUND.matcher(body), values, true);
      case "TX_STAT" -> matchTx(body, values);
      case "RX_COORD", "RX_CRDFD" -> matchRxCoord(body, values);
      case "FRST_FIX" ->
          match(
              Pattern.compile(".*?Time2FF:\\s*(\\d+).*?").matcher(body),
              values,
              "time_to_first_fix_ms");
      case "RX_TMOUT" ->
          match(
              Pattern.compile("Rx\\s+Timeout\\s*:\\(\\s*SF:\\s*(\\d+)").matcher(body),
              values,
              "spreading_factor");
      case "RLY_DIST" -> matchRelayDistance(body, values);
      case "GS_COORD" -> matchGsCoord(body, values);
      case "COORDFND" -> matchCoordFound(body, values);
      case "FS_CHNGE" ->
          match(
              Pattern.compile("New\\s+(\\S+)\\s+flight\\s+state:\\s*(\\d+)").matcher(body),
              values,
              "change_type",
              "flight_state");
      case "BATT_BLE" -> matchBattery(body, values);
      default -> false;
    };
  }

  private static boolean parseGps(String body, Map<String, Object> values) {
    Matcher m = GPS.matcher(body);
    if (!m.matches()) return false;
    crcStatus(values, m.group(1));
    String[] names = {
      "unit_type",
      "lora_id",
      "altitude_asl_ft",
      "latitude_deg",
      "longitude_deg",
      "horizontal_velocity_ft_s",
      "heading_deg",
      "upward_velocity_ft_s",
      "fix_type",
      "satellites_total",
      "satellites_over_24_db",
      "satellites_over_32_db",
      "satellites_over_40_db"
    };
    for (int i = 0; i < names.length; i++) put(values, names[i], m.group(i + 2));
    for (int i = 0; i < 5; i++) {
      String satellite = m.group(i + 15);
      values.put("satellite_" + (i + 1), satellite);
      String[] parts = satellite.split("_");
      if (parts.length == 3) {
        put(values, "satellite_" + (i + 1) + "_azimuth_deg", parts[0]);
        put(values, "satellite_" + (i + 1) + "_elevation_deg", parts[1]);
        put(values, "satellite_" + (i + 1) + "_strength_db_hz", parts[2]);
      }
    }
    return true;
  }

  private static boolean parseRxNomtk(String body, Map<String, Object> values) {
    Matcher m = RX_NOMTK.matcher(body);
    if (!m.matches()) return false;
    crcStatus(values, m.group(1));
    String[] names = {
      "lora_id",
      "packets_received",
      "packets_sent",
      "packet_rssi_dbm",
      "packet_snr_db",
      "ack_received",
      "ack_sent",
      "ack_rssi_dbm",
      "ack_snr_db",
      "spreading_factor",
      "frequency_hz",
      "tracker_battery_mv",
      "relay_temperature_c"
    };
    for (int i = 0; i < names.length; i++) put(values, names[i], m.group(i + 2));
    return true;
  }

  private static boolean matchGroundStats(Matcher m, Map<String, Object> values, boolean foundId) {
    if (!m.matches()) return false;
    crcStatus(values, m.group(1));
    String[] names = {
      "lora_id",
      "packets_received",
      "packets_sent",
      "packet_rssi_dbm",
      "ack_received",
      "ack_sent",
      "ack_rssi_dbm",
      foundId ? "found_lora_id" : "status",
      "found_packets_received",
      "found_packets_sent",
      "found_rssi_dbm",
      "spreading_factor",
      "frequency_hz"
    };
    for (int i = 0; i < names.length; i++) put(values, names[i], m.group(i + 2));
    return true;
  }

  private static boolean matchRxCoord(String body, Map<String, Object> values) {
    Matcher m = RX_COORD.matcher(body);
    if (!m.matches()) return false;
    crcStatus(values, m.group(1));
    return groups(
        m,
        values,
        2,
        "lora_id",
        "packet_rssi_dbm",
        "packet_snr_db",
        "spreading_factor",
        "frequency_hz");
  }

  private static boolean matchTx(String body, Map<String, Object> values) {
    Matcher m = TX.matcher(body);
    if (!m.matches()) return false;
    values.put("lora_id", m.group(1));
    values.put("apid", Long.parseLong(m.group(2), 16));
    return groups(m, values, 3, "tx_duration_ms", "spreading_factor", "frequency_hz");
  }

  private static boolean matchRelayDistance(String body, Map<String, Object> values) {
    Matcher m =
        Pattern.compile(
                "(?:CRC_(OK|ERR)\\s+)?Relay:\\s*(\\S+)\\s+RSSI\\s+([+-]?\\d+)\\s+Relay_dAlt\\s+([+-]?\\d+)\\s+Relay_Dist:\\s*(\\d+)\\s+ft\\s+Fnd_mv:\\s*(\\d+)\\s+Rly_mV:\\s*(\\d+)\\s+([+-]?\\d+)\\s+degc",
                Pattern.CASE_INSENSITIVE)
            .matcher(body);
    if (!m.matches()) return false;
    crcStatus(values, m.group(1));
    return groups(
        m,
        values,
        2,
        "relay_lora_id",
        "relay_rssi_dbm",
        "relay_delta_altitude_ft",
        "relay_distance_ft",
        "found_battery_mv",
        "relay_battery_mv",
        "relay_temperature_c");
  }

  private static boolean matchGsCoord(String body, Map<String, Object> values) {
    Matcher m =
        Pattern.compile(
                "(?:CRC_(OK|ERR)\\s+)?(\\S+)\\s+Ch\\s+(\\d+)\\s+(odd|even):\\s*(\\d+)\\s+PSA:\\s*(.*)")
            .matcher(body);
    if (!m.matches()) return false;
    crcStatus(values, m.group(1));
    return groups(
        m, values, 2, "lora_id", "channel", "channel_side", "channel_is_odd", "coordination_text");
  }

  private static boolean matchCoordFound(String body, Map<String, Object> values) {
    Matcher m =
        Pattern.compile(
                "(?:CRC_(OK|ERR)\\s+)?Lost\\s+Trk\\s+(\\S+)\\s+Found!\\s+Fnd_mV:\\s*(\\d+)(?:\\s+(\\d+))?")
            .matcher(body);
    if (!m.matches()) return false;
    crcStatus(values, m.group(1));
    return groups(m, values, 2, "found_lora_id", "found_battery_mv", "packets_sent");
  }

  private static boolean matchBattery(String body, Map<String, Object> values) {
    Matcher m = Pattern.compile("(\\d+)\\s+BLE([+-])\\s+([+-]?\\d+)\\s+degC").matcher(body);
    if (!m.matches()) return false;
    groups(m, values, 1, "ground_station_battery_mv", "ble_status", "module_temperature_c");
    values.put("ble_connected", "+".equals(m.group(2)));
    return true;
  }

  private static boolean match(Matcher m, Map<String, Object> values, String... names) {
    return m.matches() && groups(m, values, 1, names);
  }

  private static boolean groups(Matcher m, Map<String, Object> values, int start, String... names) {
    for (int i = 0; i < names.length; i++) put(values, names[i], m.group(start + i));
    return true;
  }

  private static void crcStatus(Map<String, Object> values, String status) {
    if (status != null) values.put("radio_crc_ok", "OK".equals(status));
  }

  private static void put(Map<String, Object> values, String name, String value) {
    if (value == null) return;
    try {
      if (value.contains(".")) values.put(name, Double.parseDouble(value));
      else values.put(name, Long.parseLong(value));
    } catch (NumberFormatException e) {
      values.put(name, value);
    }
  }

  static int crc16Bypass(byte[] bytes) {
    int crc = 0;
    for (byte value : bytes) {
      crc ^= (value & 0xff) << 8;
      for (int bit = 0; bit < 8; bit++) crc = (crc & 0x8000) != 0 ? (crc << 1) ^ 0x8005 : crc << 1;
      crc &= 0xffff;
    }
    return crc;
  }
}
