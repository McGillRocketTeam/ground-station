package org.yamcs.mrt.links;

import java.nio.charset.StandardCharsets;
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

abstract class AbstractAstraGenericTmTcLink extends AbstractTcTmParamLink implements MqttTopicHandler {
  protected final Log log = new Log(getClass());

  private MqttToTmPacketConverter tmConverter;
  private String baseTopic;
  private String telemetryTopic;
  private String statusTopic;
  private String detailTopic;
  private String commandTopic;
  private Status status = Status.UNAVAIL;
  private String detailedStatus = "";

  @Override
  public void init(String instance, String name, YConfiguration config) throws ConfigurationException {
    super.init(instance, name, config);

    baseTopic = name;
    telemetryTopic = baseTopic + "/telemetry";
    statusTopic = baseTopic + "/status";
    detailTopic = baseTopic + "/detail";
    commandTopic = baseTopic + "/commands";

    tmConverter = new DefaultMqttToTmPacketConverter();
    tmConverter.init(yamcsInstance, linkName, config);

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
    return getDefaultSpec();
  }

  @Override
  protected void doStart() {
    notifyStarted();
  }

  @Override
  protected void doStop() {
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
            case "OK" -> Status.OK;
            case "FAILED" -> Status.FAILED;
            case "DISABLED" -> Status.DISABLED;
            case "UNAVAIL" -> Status.UNAVAIL;
            default -> Status.UNAVAIL;
          };
      log.info("{} {} {}", topic, payload, status);
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
      return true;
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
      return true;
    }
  }
}
