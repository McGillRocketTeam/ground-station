package org.yamcs.mrt.links;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import java.nio.charset.StandardCharsets;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.ConfigurationException;
import org.yamcs.YConfiguration;
import org.yamcs.cmdhistory.CommandHistoryPublisher;
import org.yamcs.commanding.PreparedCommand;
import org.yamcs.protobuf.Commanding.CommandId;

public class AstraGenericTmTcLink extends AbstractAstraGenericTmTcLink {
  private static final Gson GSON = new Gson();

  private final Queue<CommandId> pendingCommands = new ConcurrentLinkedQueue<>();
  private String ackTopic;

  @Override
  public void init(String instance, String name, YConfiguration config) throws ConfigurationException {
    super.init(instance, name, config);

    ackTopic = name + "/acks";
    try {
      org.yamcs.mrt.utils.MqttManager.getInstance().subscribe(ackTopic, this);
    } catch (MqttException e) {
      throw new ConfigurationException("Failed to subscribe to MQTT ack topic for " + name, e);
    }
  }

  @Override
  public boolean sendCommand(PreparedCommand preparedCommand) {
    if (!shouldHandleCommand(preparedCommand)) {
      return false;
    }

    String commandText = preparedCommand.getMetaCommand().getShortDescription();
    if (commandText == null || commandText.isBlank()) {
      failedCommand(preparedCommand.getCommandId(), "Command shortDescription is required");
      return true;
    }

    pendingCommands.add(preparedCommand.getCommandId());
    commandHistoryPublisher.publishAck(
        preparedCommand.getCommandId(),
        CommandHistoryPublisher.CommandComplete_KEY,
        getCurrentTime(),
        CommandHistoryPublisher.AckStatus.PENDING);

    boolean published = publishCommandText(preparedCommand, commandText);
    if (!published) {
      pendingCommands.remove(preparedCommand.getCommandId());
    }
    return true;
  }

  @Override
  public void handleMqtt(String topic, MqttMessage message) {
    if (ackTopic != null && ackTopic.equals(topic)) {
      handleAck(message);
      return;
    }

    super.handleMqtt(topic, message);
  }

  private void handleAck(MqttMessage message) {
    CommandId commandId = pendingCommands.poll();
    if (commandId == null) {
      log.debug("Ignoring ack on {} because no radio command is pending", ackTopic);
      return;
    }

    String payload = new String(message.getPayload(), StandardCharsets.UTF_8);
    try {
      JsonObject json = GSON.fromJson(payload, JsonObject.class);
      String status = json != null && json.has("status") ? json.get("status").getAsString() : null;

      if ("ACK_OK".equals(status)) {
        commandHistoryPublisher.publishAck(
            commandId,
            CommandHistoryPublisher.CommandComplete_KEY,
            getCurrentTime(),
            CommandHistoryPublisher.AckStatus.OK);
      } else {
        commandHistoryPublisher.publishAck(
            commandId,
            CommandHistoryPublisher.CommandComplete_KEY,
            getCurrentTime(),
            CommandHistoryPublisher.AckStatus.NOK,
            status == null || status.isBlank() ? payload : status);
      }
    } catch (Exception e) {
      commandHistoryPublisher.publishAck(
          commandId,
          CommandHistoryPublisher.CommandComplete_KEY,
          getCurrentTime(),
          CommandHistoryPublisher.AckStatus.NOK,
          "Invalid ack payload: " + payload);
    }
  }
}
