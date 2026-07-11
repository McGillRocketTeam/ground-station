package org.yamcs.mrt.links;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.YConfiguration;
import org.yamcs.labjack.LabJackConfig;
import org.yamcs.labjack.LabJackLink;
import org.yamcs.labjack.LabJackLinkRegistry;
import org.yamcs.logging.Log;
import org.yamcs.mrt.DefaultMqttToTmPacketConverter;
import org.yamcs.mrt.MqttToTmPacketConverter;
import org.yamcs.mrt.utils.MqttManager;
import org.yamcs.mrt.utils.MqttTopicHandler;
import org.yamcs.tctm.AbstractTmDataLink;

public class ControlBoxLink extends AbstractTmDataLink implements MqttTopicHandler {
  private static final String FLIGHT_COMPUTER_COMMAND_PATH = "/FlightComputer/";
  private static final String EMPTY_COMMAND_BODY = "{\"args\":{},\"extra\":{}}";

  MqttToTmPacketConverter tmConverter;

  // Local State
  private String baseTopic;
  private long dataInCount;

  private Status status = Status.UNAVAIL;
  private String detailedStatus = "";
  private static final Log log = new Log(AstraGenericTmLink.class);

  // Previous switch states for change detection (null = no previous packet received yet)
  private byte[] previousSwitchStates = null;

  // Debounce: track last accepted switch transition so the first edge wins for the debounce window.
  private final Map<Integer, Long> lastCommandTime = new HashMap<>();
  private static final long SWITCH_DEBOUNCE_MS = 1000;

  // Keep the arming key briefly asserted across very short telemetry bounce.
  private static final long ARMING_KEY_DEBOUNCE_MS = 75;

  // Debounce: track last time arming key was seen ON to hold armed state across brief bounces
  private long lastArmingKeyOnTime = 0;

  private static final int YAMCS_HTTP_PORT = 8090;
  private static final int FILL_FIO = 2;
  private static final int DUMP_FIO = 3;
  private static final int PURG_FIO = 5;
  private static final int MOV__FIO = 5;
  private static final int BLKT_FIO = 4;
  private static final int VENT_FIO = 4;
  private static final int RUN__FIO = 0;
  private static final int IGNP__MIO = 1;
  private static final int IGNM__MIO = 0;

  private static final String YAMCS_INSTANCE = "launch-canada";
  private static final String YAMCS_PROCESSOR = "realtime";

  private final HttpClient httpClient = HttpClient.newHttpClient();
  private Map<Integer, LabJackCommandMapping> labJackCommandMap = Map.of();
  private Map<Integer, FlightComputerCommandMapping> flightComputerCommandMap = Map.of();

  /**
   * Switch names by byte offset in the ControlBox telemetry packet.
   *
   * <p>Packet layout (from controlbox.xml):
   * byte 0: panel_1_switch_estop
   * byte 1: panel_2_switch_1 (launch)
   * byte 2: panel_2_switch_2
   * byte 3: panel_3_switch_1
   * byte 4: panel_3_switch_2
   * byte 5: panel_4_switch_1
   * byte 6: panel_4_switch_2
   * byte 7: panel_5_switch_1
   * byte 8: panel_5_switch_2
   * byte 9: panel_6_switch_1
   * byte 10: panel_6_switch_2
   * byte 11: panel_7_switch_1
   * byte 12: panel_7_switch_2
   * byte 13: panel_8_switch_1
   * byte 14: panel_9_switch_key
   * byte 15: panel_8_switch_2 (BLKT)
   */
  // @formatter:off
  private static final Map<Integer, String> SWITCH_NAME_MAP =
      Map.ofEntries(
          Map.entry(0,  "panel_1_switch_estop"),
          Map.entry(1,  "panel_2_switch_1"),
          Map.entry(2,  "panel_2_switch_2"),
          Map.entry(3,  "panel_3_switch_1"),
          Map.entry(4,  "panel_3_switch_2"),
          Map.entry(5,  "panel_4_switch_1"),
          Map.entry(6,  "panel_4_switch_2"),
          Map.entry(7,  "panel_5_switch_1"),
          Map.entry(8,  "panel_5_switch_2"),
          Map.entry(9,  "panel_6_switch_1"),
          Map.entry(10, "panel_6_switch_2"),
          Map.entry(11, "panel_7_switch_1"),
          Map.entry(12, "panel_7_switch_2"),
          Map.entry(13, "panel_8_switch_1"),
          Map.entry(14, "panel_9_switch_key"),
          Map.entry(15, "panel_8_switch_2")
          );

  private static final Map<Integer, LabJackCommandMapping> DEFAULT_LABJACK_COMMAND_MAP =
      Map.ofEntries(
          Map.entry(1,  new LabJackCommandMapping(MOV__FIO, false)),
          Map.entry(3,  new LabJackCommandMapping(RUN__FIO, false)),
          Map.entry(4,  new LabJackCommandMapping(DUMP_FIO, false)),
          Map.entry(5,  new LabJackCommandMapping(VENT_FIO, false)),
          Map.entry(6,  new LabJackCommandMapping(FILL_FIO, false)),
          Map.entry(7,  new LabJackCommandMapping(PURG_FIO, false)),
          Map.entry(12, new LabJackCommandMapping(20 + IGNM__MIO, true)),
          Map.entry(13, new LabJackCommandMapping(20 + IGNP__MIO, true)),
          Map.entry(15, new LabJackCommandMapping(BLKT_FIO, false))
          );

  // @formatter:on

  private record LabJackCommandMapping(int pin, boolean isDac) {}

  private record FlightComputerCommandMapping(String onCommand, String offCommand) {}

  /** Byte offset treated as the effective arming key switch in the telemetry packet. */
  private static final int ARMING_KEY_OFFSET = 14;

  /**
   * Switches that require the arming key to be ON before their commands are dispatched. Identified
   * by their byte offset in the telemetry packet. If a switch in this set changes while the key is
   * OFF, the command is blocked and a warning is logged.
   */
  private static final Set<Integer> ARMING_KEY_GUARDED_SWITCHES =
      Set.of(
          1
          );

  /** Byte offset of the emergency stop switch in the telemetry packet. */
  private static final int ESTOP_OFFSET = 0;

  @Override
  public void init(String instance, String name, YConfiguration config) {
    MqttManager manager = MqttManager.getInstance();
    this.baseTopic = name;
    this.labJackCommandMap = loadLabJackCommandMap(config);
    this.flightComputerCommandMap = loadFlightComputerCommandMap(config);

    tmConverter = new DefaultMqttToTmPacketConverter();
    tmConverter.init(yamcsInstance, linkName, config);

    try {
      manager.subscribe(baseTopic + "/telemetry", this);
      manager.subscribe(baseTopic + "/status", this);
      manager.subscribe(baseTopic + "/detail", this);
    } catch (MqttException e) {
      e.printStackTrace();
    }

    super.init(instance, name, config);
  }

  @Override
  public void doStart() {
    notifyStarted();
  }

  @Override
  public void doStop() {
    notifyStopped();
  }

  @Override
  public Status connectionStatus() {
    return this.status;
  }

  @Override
  public Status getLinkStatus() {
    return this.status;
  }

  @Override
  public String getDetailedStatus() {
    return this.detailedStatus;
  }

  @Override
  public long getDataInCount() {
    return this.dataInCount;
  }

  @Override
  public void handleMqtt(String topic, MqttMessage message) {

    if (topic.equals(baseTopic + "/telemetry")) {
      dataInCount += message.getPayload().length;

      byte[] payload = message.getPayload();
      detectAndDispatchChanges(payload);

      for (var tmPacket : tmConverter.convert(message)) {
        tmPacket = packetPreprocessor.process(tmPacket);

        if (tmPacket != null) {
          processPacket(tmPacket);
        }
      }

    } else if (topic.equals(baseTopic + "/detail")) {
      String payload = new String(message.getPayload());
      this.detailedStatus = payload;
    } else if (topic.equals(baseTopic + "/status")) {
      String payload = new String(message.getPayload());
      Status newStatus =
          switch (payload) {
            case "OK" -> Status.OK;
            case "FAILED" -> Status.FAILED;
            case "DISABLED" -> Status.DISABLED;
            case "UNAVAIL" -> Status.UNAVAIL;
            default -> Status.UNAVAIL;
          };

      log.info(topic + " " + new String(message.getPayload()) + " " + newStatus);
      this.status = newStatus;
    }
  }

  /**
   * Compares the current telemetry packet against the previous one to detect switch state changes
   * and dispatches any configured LabJack or FlightComputer commands.
   */
  private void detectAndDispatchChanges(byte[] currentPayload) {
    if (previousSwitchStates == null) {
      // First packet received, store as baseline
      previousSwitchStates = currentPayload.clone();
      return;
    }

    int numSwitches = Math.min(currentPayload.length, previousSwitchStates.length);
    long now = System.currentTimeMillis();
    boolean rawArmingKeyOn =
        currentPayload.length > ARMING_KEY_OFFSET && currentPayload[ARMING_KEY_OFFSET] != 0;
    if (rawArmingKeyOn) {
      lastArmingKeyOnTime = now;
    }
    boolean armingKeyOn = rawArmingKeyOn || (now - lastArmingKeyOnTime) < ARMING_KEY_DEBOUNCE_MS;
    boolean estopOn = currentPayload.length > ESTOP_OFFSET && currentPayload[ESTOP_OFFSET] != 0;
    byte[] nextSwitchStates = previousSwitchStates.clone();

    // E-stop activation: on transition to ON, immediately set all mapped pins LOW
    if (numSwitches > ESTOP_OFFSET
        && currentPayload[ESTOP_OFFSET] != previousSwitchStates[ESTOP_OFFSET]
        && estopOn) {
      handleEmergencyStop();
      // Store current state as baseline and do not process other switches for this packet
      previousSwitchStates = currentPayload.clone();
      return;
    }

    // If E-stop is currently asserted, block any other switch actions. Log attempts.
    if (estopOn) {
      for (int i = 0; i < numSwitches; i++) {
        if (i == ESTOP_OFFSET) continue;
        if (currentPayload[i] != previousSwitchStates[i]) {
          String name = switchNameForOffset(i);
          log.warn("Blocked switch change for " + name + " because E-STOP is active");
        }
      } 
      // Keep baseline in sync so changes made while E-stop was active are ignored
      previousSwitchStates = currentPayload.clone();
      return;
    }

    // Normal processing when no E-stop active
    for (int i = 0; i < numSwitches; i++) {
      if (currentPayload[i] != previousSwitchStates[i]) {
        String switchName = switchNameForOffset(i);
        boolean newState = currentPayload[i] != 0;
        log.info("Switch state change: " + switchName + " -> " + (newState ? "ON" : "OFF"));

        if (ARMING_KEY_GUARDED_SWITCHES.contains(i) && !armingKeyOn) {
          log.warn("Blocked command for " + switchName + ": arming key is OFF");
          nextSwitchStates[i] = currentPayload[i];
          continue;
        }

        Long last = lastCommandTime.get(i);
        if (last != null && (now - last) < SWITCH_DEBOUNCE_MS) {
          log.debug("Debounced rapid change for " + switchName + "; keeping first state in burst");
          continue;
        }
        lastCommandTime.put(i, now);
        nextSwitchStates[i] = currentPayload[i];

        LabJackCommandMapping labJackMapping = labJackCommandMap.get(i);
        if (labJackMapping != null) {
          if (labJackMapping.isDac()) {
            issueWriteDACPinCommand(labJackMapping.pin(), newState, switchName);
          } else {
            issueWriteDigitalPinCommand(labJackMapping.pin(), newState, switchName);
          }
        }

        issueFlightComputerCommand(i, newState, switchName);
      }
    }

    previousSwitchStates = nextSwitchStates;
  }

  /**
   * Handles emergency stop activation by immediately setting all LabJack digital pins to LOW. Uses
   * direct LabJackDataLink calls (bypassing the HTTP API) for minimal latency.
   */
  private void handleEmergencyStop() {
    log.warn("EMERGENCY STOP ACTIVATED - setting all digital pins to LOW");

    LabJackLink labJack = LabJackLinkRegistry.get();
    if (labJack == null) {
      log.error("E-stop: LabJack link instance not available");
      return;
    }

    for (int pin = 0; pin < LabJackConfig.NUM_DIGITAL_PINS; pin++) {
      labJack.writeDigitalPin(pin, 0);
    }

    log.warn("EMERGENCY STOP: all digital pins set to LOW");
    issueFlightComputerCommand(ESTOP_OFFSET, true, "panel_1_switch_estop");
  }

  private Map<Integer, FlightComputerCommandMapping> loadFlightComputerCommandMap(
      YConfiguration config) {
    if (!config.containsKey("flightComputerCommands")) {
      return Map.of();
    }

    Object rawMappings = config.getRoot().get("flightComputerCommands");
    if (!(rawMappings instanceof List<?> mappingsList)) {
      log.warn("Ignoring invalid flightComputerCommands config: expected a list");
      return Map.of();
    }

    Map<Integer, FlightComputerCommandMapping> mappings = new HashMap<>();
    for (Object entry : mappingsList) {
      if (!(entry instanceof Map<?, ?> rawEntry)) {
        log.warn("Ignoring invalid flightComputerCommands entry: expected a map");
        continue;
      }

      Integer offset = resolveSwitchOffset(rawEntry);
      if (offset == null) {
        log.warn(
            "Ignoring flightComputerCommands entry without a valid offset or switchName");
        continue;
      }

      String onCommand = normalizeFlightComputerCommand(rawEntry.get("onCommand"));
      String offCommand = normalizeFlightComputerCommand(rawEntry.get("offCommand"));
      if (onCommand == null && offCommand == null) {
        log.warn(
            "Ignoring flightComputerCommands entry for offset "
                + offset
                + ": no onCommand or offCommand configured");
        continue;
      }

      mappings.put(offset, new FlightComputerCommandMapping(onCommand, offCommand));
    }

    return Map.copyOf(mappings);
  }

  private Map<Integer, LabJackCommandMapping> loadLabJackCommandMap(YConfiguration config) {
    if (!config.containsKey("labJackCommands")) {
      return DEFAULT_LABJACK_COMMAND_MAP;
    }

    Object rawMappings = config.getRoot().get("labJackCommands");
    if (!(rawMappings instanceof List<?> mappingsList)) {
      log.warn("Ignoring invalid labJackCommands config: expected a list");
      return DEFAULT_LABJACK_COMMAND_MAP;
    }

    Map<Integer, LabJackCommandMapping> mappings = new HashMap<>();
    for (Object entry : mappingsList) {
      if (!(entry instanceof Map<?, ?> rawEntry)) {
        log.warn("Ignoring invalid labJackCommands entry: expected a map");
        continue;
      }

      Integer offset = resolveSwitchOffset(rawEntry);
      Integer pin = parseSwitchOffset(rawEntry.get("pin"));
      if (offset == null || pin == null) {
        log.warn("Ignoring labJackCommands entry without a valid offset/switchName and pin");
        continue;
      }

      boolean isDac = Boolean.TRUE.equals(rawEntry.get("isDac"));
      mappings.put(offset, new LabJackCommandMapping(pin, isDac));
    }

    return Map.copyOf(mappings);
  }

  private Integer parseSwitchOffset(Object rawOffset) {
    if (rawOffset instanceof Number number) {
      return number.intValue();
    }
    if (rawOffset instanceof String text && !text.isBlank()) {
      try {
        return Integer.parseInt(text);
      } catch (NumberFormatException e) {
        return null;
      }
    }
    return null;
  }

  private Integer resolveSwitchOffset(Map<?, ?> rawEntry) {
    Integer offset = parseSwitchOffset(rawEntry.get("offset"));
    if (offset != null) {
      return offset;
    }

    Object rawSwitchName = rawEntry.get("switchName");
    if (!(rawSwitchName instanceof String switchName) || switchName.isBlank()) {
      return null;
    }

    for (Map.Entry<Integer, String> entry : SWITCH_NAME_MAP.entrySet()) {
      if (entry.getValue().equals(switchName)) {
        return entry.getKey();
      }
    }

    return null;
  }

  private String switchNameForOffset(int offset) {
    return SWITCH_NAME_MAP.getOrDefault(offset, "switch_" + offset);
  }

  private String normalizeFlightComputerCommand(Object rawCommand) {
    if (!(rawCommand instanceof String command)) {
      return null;
    }

    String trimmed = command.trim();
    if (trimmed.isEmpty()) {
      return null;
    }

    return trimmed.startsWith("/") ? trimmed : FLIGHT_COMPUTER_COMMAND_PATH + trimmed;
  }

  private void issueFlightComputerCommand(int switchOffset, boolean newState, String switchName) {
    FlightComputerCommandMapping mapping = flightComputerCommandMap.get(switchOffset);
    if (mapping == null) {
      return;
    }

    String commandPath = newState ? mapping.onCommand() : mapping.offCommand();
    if (commandPath == null) {
      return;
    }

    log.info("Issuing FlightComputer command: " + commandPath + " (triggered by " + switchName + ")");
    issueYamcsCommand(commandPath, EMPTY_COMMAND_BODY, "FlightComputer command for " + switchName);
  }

  /**
   * Issues a /LabJack/write_digital_pin command via the Yamcs HTTP API.
   *
   * @param pinNumber the LabJack digital pin number (0-22)
   * @param pinState true for HIGH, false for LOW
   * @param switchName the name of the control box switch (for logging)
   */
  private void issueWriteDigitalPinCommand(int pinNumber, boolean pinState, String switchName) {
    log.info(
        "Issuing write_digital_pin command: pin="
            + pinNumber
            + " state="
            + (pinState ? "HIGH" : "LOW")
            + " (triggered by "
            + switchName
            + ")");
    String pinStateStr = pinState ? "HIGH" : "LOW";
    String url =
        String.format(
            "http://localhost:%d/api/processors/%s/%s/commands/EGSE/Pad/LabJack/write_digital_pin",
            YAMCS_HTTP_PORT, YAMCS_INSTANCE, YAMCS_PROCESSOR);

    String jsonBody =
        String.format(
            "{\"args\": {\"pin_number\": %d, \"pin_state\": \"%s\"}}", pinNumber, pinStateStr);

    issueYamcsCommand(
        url,
        jsonBody,
        "write_digital_pin for " + switchName,
        "Issued write_digital_pin: pin="
            + pinNumber
            + " state="
            + pinStateStr
            + " (triggered by "
            + switchName
            + ")");
  }

  /**
   * Issues a /LabJack/write_DAC_pin command via the Yamcs HTTP API.
   *
   * @param pinNumber the LabJack DAC pin number (0 or 1)
   * @param pinState true → 5.0 V, false → 0.0 V
   * @param switchName the name of the control box switch (for logging)
   */
  private void issueWriteDACPinCommand(int pinNumber, boolean pinState, String switchName) {
    float voltage = pinState ? 5.0f : 0.0f;
    String url =
        String.format(
            "http://localhost:%d/api/processors/%s/%s/commands/EGSE/Pad/LabJack/write_DAC_pin",
            YAMCS_HTTP_PORT, YAMCS_INSTANCE, YAMCS_PROCESSOR);

    String jsonBody =
        String.format(
            "{\"args\": {\"pin_number\": %d, \"pin_voltage\": %s}}", pinNumber, voltage);

    issueYamcsCommand(
        url,
        jsonBody,
        "write_DAC_pin for " + switchName,
        "Issued write_DAC_pin: pin="
            + pinNumber
            + " voltage="
            + voltage
            + "V (triggered by "
            + switchName
            + ")");
  }

  private void issueYamcsCommand(String commandPath, String jsonBody, String actionDescription) {
    String url =
        String.format(
            "http://localhost:%d/api/processors/%s/%s/commands%s",
            YAMCS_HTTP_PORT, YAMCS_INSTANCE, YAMCS_PROCESSOR, commandPath);
    issueYamcsCommand(url, jsonBody, actionDescription, "Issued " + actionDescription);
  }

  private void issueYamcsCommand(
      String url, String jsonBody, String actionDescription, String successMessage) {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
            .build();

    httpClient
        .sendAsync(request, HttpResponse.BodyHandlers.ofString())
        .thenAccept(
            response -> {
              if (response.statusCode() == 200) {
                log.info(successMessage);
              } else {
                log.warn(
                    "Failed to issue "
                        + actionDescription
                        + ": HTTP "
                        + response.statusCode()
                        + " - "
                        + response.body());
              }
            })
        .exceptionally(
            ex -> {
              log.error("Error issuing " + actionDescription + ": " + ex.getMessage());
              return null;
            });
  }
}
