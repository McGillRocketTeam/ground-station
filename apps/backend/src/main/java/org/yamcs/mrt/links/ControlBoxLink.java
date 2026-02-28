package org.yamcs.mrt.links;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.YConfiguration;
import org.yamcs.logging.Log;
import org.yamcs.mrt.DefaultMqttToTmPacketConverter;
import org.yamcs.mrt.MqttToTmPacketConverter;
import org.yamcs.mrt.utils.MqttManager;
import org.yamcs.mrt.utils.MqttTopicHandler;
import org.yamcs.tctm.AbstractTmDataLink;

public class ControlBoxLink extends AbstractTmDataLink implements MqttTopicHandler {
  MqttToTmPacketConverter tmConverter;

  // Local State
  private String baseTopic;
  private long dataInCount;

  private Status status = Status.UNAVAIL;
  private String detailedStatus = "";
  private static final Log log = new Log(AstraGenericTmLink.class);

  // Previous switch states for change detection (null = no previous packet received yet)
  private byte[] previousSwitchStates = null;

  private static final int YAMCS_HTTP_PORT = 8090;
  private static final String YAMCS_INSTANCE = "ground_station";
  private static final String YAMCS_PROCESSOR = "realtime";

  private final HttpClient httpClient = HttpClient.newHttpClient();

  /**
   * Switch-to-LabJack pin mapping. Each entry maps a byte offset in the ControlBox telemetry packet
   * to the corresponding LabJack digital pin number.
   *
   * <p>Packet layout (from controlbox.xml): byte 0: panel_1_switch_estop byte 1:
   * panel_2_switch_launch byte 2: panel_3_switch_1 byte 3: panel_3_switch_2 byte 4:
   * panel_4_switch_1 byte 5: panel_4_switch_2 byte 6: panel_5_switch_1 byte 7: panel_5_switch_2
   * byte 8: panel_6_switch_1 byte 9: panel_6_switch_2 byte 10: panel_7_switch_1 byte 11:
   * panel_7_switch_2 byte 12: panel_8_switch_1 byte 13: panel_8_switch_2 byte 14:
   * panel_9_switch_key
   *
   * <p>Pin number -1 means the switch is not mapped to a LabJack pin.
   *
   * <p>When a switch changes, issueWriteDigitalPinCommand() sends an async HTTP POST to
   * http://localhost:8090/api/processors/ground_station/realtime/commands/LabJackT7/write_digital_pin
   * with pin_number and pin_state (HIGH/LOW).
   */
  // @formatter:off
  private static final Map<Integer, SwitchMapping> SWITCH_PIN_MAP =
      Map.ofEntries(
          Map.entry(0, new SwitchMapping("panel_1_switch_estop", -1)), // E-stop: not mapped
          Map.entry(1, new SwitchMapping("panel_2_switch_launch", -1)), // Launch: not mapped
          Map.entry(2, new SwitchMapping("panel_3_switch_1", 0)), // FIO0
          Map.entry(3, new SwitchMapping("panel_3_switch_2", 1)), // FIO1
          Map.entry(4, new SwitchMapping("panel_4_switch_1", 2)), // FIO2
          Map.entry(5, new SwitchMapping("panel_4_switch_2", 3)), // FIO3
          Map.entry(6, new SwitchMapping("panel_5_switch_1", 4)), // FIO4
          Map.entry(7, new SwitchMapping("panel_5_switch_2", 5)), // FIO5
          Map.entry(8, new SwitchMapping("panel_6_switch_1", 6)), // FIO6
          Map.entry(9, new SwitchMapping("panel_6_switch_2", 7)), // FIO7
          Map.entry(10, new SwitchMapping("panel_7_switch_1", 8)), // EIO0
          Map.entry(11, new SwitchMapping("panel_7_switch_2", 9)), // EIO1
          Map.entry(12, new SwitchMapping("panel_8_switch_1", 10)), // EIO2
          Map.entry(13, new SwitchMapping("panel_8_switch_2", 11)), // EIO3
          Map.entry(14, new SwitchMapping("panel_9_switch_key", -1)) // Key: not mapped
          );

  // @formatter:on

  private record SwitchMapping(String name, int labJackPin) {}

  @Override
  public void init(String instance, String name, YConfiguration config) {
    MqttManager manager = MqttManager.getInstance();
    this.baseTopic = name;

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
   * Compares the current telemetry packet against the previous one to detect switch state changes.
   * For each changed switch that has a LabJack pin mapping, issues a /LabJackT7/write_digital_pin
   * command via the Yamcs HTTP API.
   */
  private void detectAndDispatchChanges(byte[] currentPayload) {
    if (previousSwitchStates == null) {
      // First packet received, store as baseline
      previousSwitchStates = currentPayload.clone();
      return;
    }

    int numSwitches = Math.min(currentPayload.length, previousSwitchStates.length);
    for (int i = 0; i < numSwitches; i++) {
      if (currentPayload[i] != previousSwitchStates[i]) {
        SwitchMapping mapping = SWITCH_PIN_MAP.get(i);
        if (mapping == null) {
          continue;
        }

        boolean newState = currentPayload[i] != 0;
        log.info("Switch state change: " + mapping.name() + " -> " + (newState ? "ON" : "OFF"));

        if (mapping.labJackPin() >= 0) {
          issueWriteDigitalPinCommand(mapping.labJackPin(), newState, mapping.name());
        }
      }
    }

    previousSwitchStates = currentPayload.clone();
  }

  /**
   * Issues a /LabJackT7/write_digital_pin command via the Yamcs HTTP API.
   *
   * @param pinNumber the LabJack digital pin number (0-22)
   * @param pinState true for HIGH, false for LOW
   * @param switchName the name of the control box switch (for logging)
   */
  private void issueWriteDigitalPinCommand(int pinNumber, boolean pinState, String switchName) {
    String pinStateStr = pinState ? "HIGH" : "LOW";
    String url =
        String.format(
            "http://localhost:%d/api/processors/%s/%s/commands/LabJackT7/write_digital_pin",
            YAMCS_HTTP_PORT, YAMCS_INSTANCE, YAMCS_PROCESSOR);

    String jsonBody =
        String.format(
            "{\"args\": {\"pin_number\": %d, \"pin_state\": \"%s\"}}", pinNumber, pinStateStr);

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
                log.info(
                    "Issued write_digital_pin: pin="
                        + pinNumber
                        + " state="
                        + pinStateStr
                        + " (triggered by "
                        + switchName
                        + ")");
              } else {
                log.warn(
                    "Failed to issue write_digital_pin for "
                        + switchName
                        + ": HTTP "
                        + response.statusCode()
                        + " - "
                        + response.body());
              }
            })
        .exceptionally(
            ex -> {
              log.error(
                  "Error issuing write_digital_pin for " + switchName + ": " + ex.getMessage());
              return null;
            });
  }
}
