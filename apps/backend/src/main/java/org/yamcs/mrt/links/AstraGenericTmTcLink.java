package org.yamcs.mrt.links;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Queue;
import java.util.Set;
import java.util.concurrent.ConcurrentLinkedQueue;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.ConfigurationException;
import org.yamcs.YConfiguration;
import org.yamcs.cmdhistory.CommandHistoryPublisher;
import org.yamcs.commanding.PreparedCommand;
import org.yamcs.parameter.Value;
import org.yamcs.protobuf.Commanding.CommandId;
import org.yamcs.xtce.Argument;

public class AstraGenericTmTcLink extends AbstractAstraGenericTmTcLink {
  private static final Gson GSON = new Gson();

  private final Queue<CommandId> pendingCommands = new ConcurrentLinkedQueue<>();
  private String ackTopic;

  @Override
  public void init(String instance, String name, YConfiguration config)
      throws ConfigurationException {
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

    String commandTemplate = preparedCommand.getMetaCommand().getShortDescription();
    if (commandTemplate == null || commandTemplate.isBlank()) {
      failedCommand(preparedCommand.getCommandId(), "Command shortDescription is required");
      return true;
    }

    String commandText;
    try {
      commandText = renderCommandText(preparedCommand, commandTemplate);
    } catch (IllegalArgumentException e) {
      failedCommand(preparedCommand.getCommandId(), e.getMessage());
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

  static String renderCommandText(PreparedCommand command, String template) {
    String commandText = template;
    Set<String> interpolatedArguments = new HashSet<>();

    for (Argument argument : command.getMetaCommand().getEffectiveArgumentList()) {
      String placeholder = "{" + argument.getName() + "}";
      if (!commandText.contains(placeholder)) {
        continue;
      }

      Value value = argumentValue(command, argument);
      commandText = commandText.replace(placeholder, formatArgumentValue(value));
      interpolatedArguments.add(argument.getName());
    }

    if (commandText.indexOf('{') >= 0 || commandText.indexOf('}') >= 0) {
      throw new IllegalArgumentException("Command has an unresolved argument placeholder");
    }

    for (Argument argument : command.getMetaCommand().getEffectiveArgumentList()) {
      if (interpolatedArguments.contains(argument.getName())) {
        continue;
      }
      commandText += " " + formatArgumentValue(argumentValue(command, argument));
    }

    return commandText.strip() + "\n";
  }

  private static Value argumentValue(PreparedCommand command, Argument argument) {
    var assignment = command.getArgAssignment(argument);
    if (assignment == null) {
      throw new IllegalArgumentException("Missing command argument " + argument.getName());
    }
    Value value = assignment.getEngValue();
    if (value == null) {
      value = assignment.getRawValue();
    }
    if (value == null) {
      throw new IllegalArgumentException("Missing command argument " + argument.getName());
    }
    return value;
  }

  private static String formatArgumentValue(Value value) {
    return switch (value.getType()) {
      case BOOLEAN -> value.getBooleanValue() ? "t" : "f";
      case FLOAT -> Float.toString(value.getFloatValue());
      case DOUBLE -> Double.toString(value.getDoubleValue());
      case UINT32 -> Integer.toUnsignedString(value.getUint32Value());
      case SINT32 -> Integer.toString(value.getSint32Value());
      case UINT64 -> Long.toUnsignedString(value.getUint64Value());
      case SINT64 -> Long.toString(value.getSint64Value());
      case STRING, ENUMERATED -> value.getStringValue();
      default ->
          throw new IllegalArgumentException(
              "Unsupported radio command argument type " + value.getType());
    };
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
