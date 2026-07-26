package org.yamcs.mrt.links;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.ConfigurationException;
import org.yamcs.Spec;
import org.yamcs.YConfiguration;
import org.yamcs.commanding.PreparedCommand;
import org.yamcs.logging.Log;
import org.yamcs.mrt.DefaultMqttToTmPacketConverter;
import org.yamcs.mrt.MqttToTmPacketConverter;
import org.yamcs.mrt.utils.MqttManager;
import org.yamcs.mrt.utils.MqttTopicHandler;
import org.yamcs.tctm.AbstractTcTmParamLink;

abstract class AbstractAstraGenericTmTcLink extends AbstractTcTmParamLink
    implements MqttTopicHandler {
  private static final Map<String, AbstractAstraGenericTmTcLink> TELEMETRY_STATUS_LINKS =
      new ConcurrentHashMap<>();
  private static final Map<String, Boolean> PENDING_TELEMETRY_OK = new ConcurrentHashMap<>();

  protected final Log log = new Log(getClass());

  private MqttToTmPacketConverter tmConverter;
  private String baseTopic;
  private String telemetryTopic;
  private String statusTopic;
  private String detailTopic;
  private String commandTopic;
  private String registeredLinkName;
  private List<String> telemetryStatusTargets = List.of();
  private Status status = Status.UNAVAIL;
  private String detailedStatus = "";

  protected boolean shouldProcessTelemetryPayload(byte[] payload) {
    return true;
  }

  protected boolean shouldMarkOwnStatusOkOnTelemetry() {
    return false;
  }

  @Override
  public void init(String instance, String name, YConfiguration config)
      throws ConfigurationException {
    super.init(instance, name, config);

    registeredLinkName = name;
    baseTopic = name;
    telemetryTopic = baseTopic + "/telemetry";
    statusTopic = baseTopic + "/status";
    detailTopic = baseTopic + "/detail";
    commandTopic = baseTopic + "/commands";
    if (config.containsKey("telemetryStatusTargets")) {
      telemetryStatusTargets = List.copyOf(config.getList("telemetryStatusTargets"));
    }

    tmConverter = new DefaultMqttToTmPacketConverter();
    tmConverter.init(yamcsInstance, linkName, config);

    registerTelemetryStatusLink(registeredLinkName, this);

    MqttManager manager = MqttManager.getInstance();
    try {
      manager.subscribe(telemetryTopic, this);
      manager.subscribe(statusTopic, this);
      manager.subscribe(detailTopic, this);
    } catch (MqttException e) {
      throw new ConfigurationException("Failed to subscribe to MQTT topics for " + baseTopic, e);
    }
  }

  @Override
  public Spec getSpec() {
    Spec spec = getDefaultSpec();
    spec.addOption("telemetryStatusTargets", Spec.OptionType.LIST)
        .withRequired(false)
        .withElementType(Spec.OptionType.STRING);
    return spec;
  }

  @Override
  protected void doStart() {
    notifyStarted();
  }

  @Override
  protected void doStop() {
    if (registeredLinkName != null) {
      TELEMETRY_STATUS_LINKS.remove(registeredLinkName, this);
    }
    notifyStopped();
  }

  @Override
  protected Status connectionStatus() {
    return status;
  }

  @Override
  public String getDetailedStatus() {
    return detailedStatus;
  }

  @Override
  public void handleMqtt(String topic, MqttMessage message) {
    if (telemetryTopic.equals(topic)) {
      dataIn(1, message.getPayload().length);

      if (!shouldProcessTelemetryPayload(message.getPayload())) {
        return;
      }

      noteTelemetryReceived();

      for (var tmPacket : tmConverter.convert(message)) {
        tmPacket = packetPreprocessor.process(tmPacket);
        if (tmPacket != null) {
          processPacket(tmPacket);
        }
      }
      return;
    }

    if (detailTopic.equals(topic)) {
      detailedStatus = new String(message.getPayload(), StandardCharsets.UTF_8);
      return;
    }

    if (statusTopic.equals(topic)) {
      String payload = new String(message.getPayload(), StandardCharsets.UTF_8);
      status =
          switch (payload) {
            case "OK", "RECEIVE" -> Status.OK;
            case "FAILED" -> Status.FAILED;
            case "DISABLED" -> Status.DISABLED;
            case "UNAVAIL" -> Status.UNAVAIL;
            default -> Status.UNAVAIL;
          };
      // log.info("{} {} {}", topic, payload, status);
    }
  }

  protected String getCommandTopic() {
    return commandTopic;
  }

  protected String getCommandPathPrefix() {
    return "/" + baseTopic + "/";
  }

  protected boolean shouldHandleCommand(PreparedCommand preparedCommand) {
    String qualifiedName = preparedCommand.getMetaCommand().getQualifiedName();
    return qualifiedName != null && qualifiedName.startsWith(getCommandPathPrefix());
  }

  protected boolean publishCommandText(PreparedCommand preparedCommand, String commandText) {
    byte[] binary = postprocess(preparedCommand);
    if (binary == null) {
      return false;
    }
    preparedCommand.setBinary(binary);

    try {
      byte[] payload = commandText.getBytes(StandardCharsets.UTF_8);
      MqttManager.getInstance().publish(getCommandTopic(), new MqttMessage(payload));
      dataOut(1, payload.length);
      ackCommand(preparedCommand.getCommandId());
      return true;
    } catch (MqttException e) {
      log.warn("Failed to send command {}", preparedCommand, e);
      failedCommand(preparedCommand.getCommandId(), e.toString());
      return false;
    }
  }

  void noteTelemetryReceived() {
    if (shouldMarkOwnStatusOkOnTelemetry()) {
      status = Status.OK;
    }

    for (String telemetryStatusTarget : telemetryStatusTargets) {
      markTelemetryStatusOk(telemetryStatusTarget);
    }
  }

  void setTelemetryStatusTargets(List<String> telemetryStatusTargets) {
    this.telemetryStatusTargets = List.copyOf(telemetryStatusTargets);
  }

  static void registerTelemetryStatusLink(
      String linkName, AbstractAstraGenericTmTcLink telemetryStatusLink) {
    TELEMETRY_STATUS_LINKS.put(linkName, telemetryStatusLink);
    if (PENDING_TELEMETRY_OK.remove(linkName) != null) {
      telemetryStatusLink.status = Status.OK;
    }
  }

  static void markTelemetryStatusOk(String linkName) {
    AbstractAstraGenericTmTcLink telemetryStatusLink = TELEMETRY_STATUS_LINKS.get(linkName);
    if (telemetryStatusLink != null) {
      telemetryStatusLink.status = Status.OK;
      return;
    }

    PENDING_TELEMETRY_OK.put(linkName, Boolean.TRUE);
  }

  static void clearTelemetryStatusRegistry() {
    TELEMETRY_STATUS_LINKS.clear();
    PENDING_TELEMETRY_OK.clear();
  }
}
