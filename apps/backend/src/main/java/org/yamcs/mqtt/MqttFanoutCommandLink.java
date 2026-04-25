package org.yamcs.mqtt;

import com.google.gson.Gson;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.eclipse.paho.client.mqttv3.IMqttActionListener;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.IMqttToken;
import org.eclipse.paho.client.mqttv3.MqttAsyncClient;
import org.eclipse.paho.client.mqttv3.MqttCallback;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.CommandOption;
import org.yamcs.CommandOption.CommandOptionType;
import org.yamcs.ConfigurationException;
import org.yamcs.Spec;
import org.yamcs.Spec.OptionType;
import org.yamcs.YConfiguration;
import org.yamcs.YamcsServer;
import org.yamcs.cmdhistory.CommandHistoryPublisher;
import org.yamcs.cmdhistory.CommandHistoryPublisher.AckStatus;
import org.yamcs.commanding.PreparedCommand;
import org.yamcs.tctm.AbstractTcDataLink;

/**
 * Sends one logical Yamcs command to multiple configured MQTT targets and aggregates their acks.
 */
public class MqttFanoutCommandLink extends AbstractTcDataLink implements MqttCallback {

  static final String TARGET_SYSTEM_A_OPTION_ID = "mqttFanoutSystemA";
  static final String TARGET_SYSTEM_B_OPTION_ID = "mqttFanoutSystemB";
  private static final String TARGET_ALL = "BOTH";
  private static final int DEFAULT_ACK_FLAG_BYTE_INDEX = 2;
  private static final int DEFAULT_ACK_FLAG_BIT_INDEX = 1;
  private static final int DEFAULT_COMMAND_FLAG_BIT_INDEX = 2;
  private static final int DEFAULT_ACK_ID_BYTE_INDEX = 3;
  private static final int FIRST_SEQUENCE = 1;
  private static final int MAX_SEQUENCE = 255;
  private static final int RESET_AV_ACK_SEQUENCE = 0;
  private static final String RESET_AV_COMMAND_NAME = "reset_av";
  private static final String RESET_AV_COMMAND_CODE = "rs";
  private static final Gson GSON = new Gson();

  private String detailedStatus = "Not started.";
  private MqttAsyncClient client;
  private MqttConnectOptions connOpts;
  private boolean commandCountingEnabled = true;

  private List<Target> targets = List.of();
  private Map<String, AckRoute> ackRouteByTopic = Map.of();

  private final AtomicInteger currentCommandId = new AtomicInteger(1);
  private final Map<Integer, DispatchState> dispatchBySequence = new ConcurrentHashMap<>();
  private volatile DispatchState uncountedDispatch;
  private volatile DispatchState pendingResetAvDispatch;

  @Override
  public void init(String yamcsInstance, String linkName, YConfiguration config)
      throws ConfigurationException {
    super.init(yamcsInstance, linkName, config);

    registerCommandOption();
    connOpts = MqttUtils.getConnectionOptions(config);
    client = MqttUtils.newClient(config);
    commandCountingEnabled = config.getBoolean("commandCountingEnabled", true);
    targets = loadTargets(config);

    Map<String, AckRoute> ackRoutes = new LinkedHashMap<>();
    for (Target target : targets) {
      if (commandCountingEnabled) {
        registerAckRoute(
            ackRoutes, target.ackTopic(), target, AckChannel.FLIGHT_COMPUTER, "ackTopic");
        registerAckRoute(
            ackRoutes, target.radioAckTopic(), target, AckChannel.RADIO, "radioAckTopic");
      } else {
        registerAckRoute(
            ackRoutes, target.statusAckTopic(), target, AckChannel.STATUS, "statusAckTopic");
      }
    }
    ackRouteByTopic = Collections.unmodifiableMap(ackRoutes);
  }

  @Override
  public Spec getSpec() {
    Spec spec = getDefaultSpec();
    MqttUtils.addConnectionOptionsToSpec(spec);
    spec.addOption("commandCountingEnabled", OptionType.BOOLEAN).withDefault(true);

    Spec targetSpec = new Spec();
    targetSpec.addOption("name", OptionType.STRING).withRequired(true);
    targetSpec.addOption("ackName", OptionType.STRING).withRequired(false);
    targetSpec.addOption("baseTopic", OptionType.STRING).withRequired(false);
    targetSpec.addOption("commandTopic", OptionType.STRING).withRequired(false);
    targetSpec.addOption("ackTopic", OptionType.STRING).withRequired(false);
    targetSpec.addOption("radioAckTopic", OptionType.STRING).withRequired(false);
    targetSpec.addOption("statusAckTopic", OptionType.STRING).withRequired(false);
    targetSpec
        .addOption("ackFlagByteIndex", OptionType.INTEGER)
        .withDefault(DEFAULT_ACK_FLAG_BYTE_INDEX);
    targetSpec
        .addOption("ackFlagBitIndex", OptionType.INTEGER)
        .withDefault(DEFAULT_ACK_FLAG_BIT_INDEX);
    targetSpec
        .addOption("ackIdByteIndex", OptionType.INTEGER)
        .withDefault(DEFAULT_ACK_ID_BYTE_INDEX);
    targetSpec.requireOneOf("baseTopic", "commandTopic");
    targetSpec.requireOneOf("baseTopic", "ackTopic", "statusAckTopic");

    spec.addOption("targets", OptionType.LIST)
        .withElementType(OptionType.MAP)
        .withSpec(targetSpec)
        .withRequired(true);

    return spec;
  }

  @Override
  protected void doStart() {
    try {
      connectAndSubscribe();

      detailedStatus =
          commandCountingEnabled
              ? "Connected to MQTT broker and listening for FC and radio acks"
              : "Connected to MQTT broker and listening for command acks";
      eventProducer.sendInfo(detailedStatus);
      notifyStarted();
    } catch (Exception e) {
      detailedStatus = "Failed to start MQTT fanout command link: " + e.getMessage();
      eventProducer.sendWarning(detailedStatus);
      notifyFailed(e);
    }
  }

  @Override
  protected void doStop() {
    MqttUtils.doStop(client, this::notifyStopped, this::notifyFailed);
  }

  @Override
  protected void doDisable() throws Exception {
    MqttUtils.doDisable(client);
  }

  @Override
  protected void doEnable() throws Exception {
    connectAndSubscribe();
  }

  @Override
  protected Status connectionStatus() {
    return client != null && client.isConnected() ? Status.OK : Status.UNAVAIL;
  }

  @Override
  public String getDetailedStatus() {
    return detailedStatus;
  }

  @Override
  public boolean sendCommand(PreparedCommand preparedCommand) {
    byte[] binary = postprocess(preparedCommand);
    if (binary == null) {
      return false;
    }
    preparedCommand.setBinary(binary);

    String commandCode = preparedCommand.getMetaCommand().getShortDescription();
    if (commandCode == null || commandCode.isBlank()) {
      failedCommand(preparedCommand.getCommandId(), "Command shortDescription is required");
      return false;
    }

    ResolvedTargetSelection targetSelection = resolveTargets(preparedCommand);
    if (targetSelection == null) {
      return false;
    }

    int sequence = commandCountingEnabled ? nextSequence() : 0;
    DispatchState dispatch =
        new DispatchState(
            preparedCommand,
            sequence,
            targetSelection.selectedTargets(),
            commandCountingEnabled ? AckTrackingMode.COUNTED : AckTrackingMode.STATUS,
            isResetAvCommand(preparedCommand));
    String reservationError = registerDispatch(dispatch);
    if (reservationError != null) {
      failedCommand(preparedCommand.getCommandId(), reservationError);
      return false;
    }

    commandHistoryPublisher.publish(preparedCommand.getCommandId(), "Command_Id", commandCode);
    if (commandCountingEnabled) {
      commandHistoryPublisher.publish(preparedCommand.getCommandId(), "Sequence_Count", sequence);
    }
    commandHistoryPublisher.publish(
        preparedCommand.getCommandId(),
        "TX_Targets",
        String.join(",", dispatch.requestedTargetNames()));
    commandHistoryPublisher.publish(
        preparedCommand.getCommandId(), "Target_Selection", targetSelection.value());

    long missionTime = timeService.getMissionTime();
    commandHistoryPublisher.publishAck(
        preparedCommand.getCommandId(),
        CommandHistoryPublisher.CommandComplete_KEY,
        missionTime,
        AckStatus.PENDING);

    if (commandCountingEnabled) {
      for (Target target : targetSelection.selectedTargets()) {
        if (target.expectsRadioAcks()) {
          commandHistoryPublisher.publishAck(
              preparedCommand.getCommandId(),
              target.radioTxAckKey(),
              missionTime,
              AckStatus.PENDING);
          commandHistoryPublisher.publishAck(
              preparedCommand.getCommandId(),
              target.radioRxAckKey(),
              missionTime,
              AckStatus.PENDING);
        }
        commandHistoryPublisher.publishAck(
            preparedCommand.getCommandId(), target.fcAckKey(), missionTime, AckStatus.PENDING);
      }
    }

    String payload = commandCountingEnabled ? sequence + "," + commandCode : commandCode;
    MqttMessage message = new MqttMessage(payload.getBytes(StandardCharsets.UTF_8));
    int attemptedPublishes = 0;

    for (Target target : targetSelection.selectedTargets()) {
      try {
        attemptedPublishes++;
        client.publish(
            target.commandTopic(),
            message,
            null,
            new IMqttActionListener() {
              @Override
              public void onSuccess(IMqttToken asyncActionToken) {
                handlePublishSuccess(dispatch, target);
              }

              @Override
              public void onFailure(IMqttToken asyncActionToken, Throwable exception) {
                handlePublishFailure(dispatch, target, exception);
              }
            });

        dataOut(1, message.getPayload().length);
      } catch (MqttException e) {
        handlePublishFailure(dispatch, target, e);
      }
    }

    if (attemptedPublishes == 0) {
      releaseDispatch(dispatch);
      failedCommand(preparedCommand.getCommandId(), "No command targets are configured");
      return false;
    }

    return true;
  }

  @Override
  public void connectionLost(Throwable cause) {
    String message =
        cause == null || cause.getMessage() == null ? "unknown cause" : cause.getMessage();
    detailedStatus = "MQTT connection lost: " + message;
    eventProducer.sendWarning(detailedStatus);
  }

  @Override
  public void messageArrived(String topic, MqttMessage message) {
    try {
      AckRoute ackRoute = ackRouteByTopic.get(topic);
      if (ackRoute == null) {
        return;
      }

      dataIn(1, message.getPayload().length);

      if (ackRoute.channel() == AckChannel.RADIO) {
        handleRadioAck(ackRoute.target(), message);
        return;
      }

      if (ackRoute.channel() == AckChannel.STATUS) {
        handleStatusAck(ackRoute.target(), message);
        return;
      }

      handleFlightComputerAck(ackRoute.target(), message.getPayload());
    } catch (Exception e) {
      log.warn("Error handling MQTT ack on topic {}", topic, e);
      eventProducer.sendWarning(
          "Error handling MQTT ack on "
              + topic
              + ": "
              + (e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()));
    }
  }

  private void handleFlightComputerAck(Target target, byte[] payload) {
    FlightComputerAck ack = tryReadAckSequence(target, payload);
    if (ack == null) {
      return;
    }

    DispatchState dispatch = resolveDispatchForAck(target, ack.sequence(), "FC");
    if (dispatch == null) {
      return;
    }

    if (!dispatch.recordFlightComputerAck(target, ack.completionRejected())) {
      return;
    }

    commandHistoryPublisher.publishAck(
        dispatch.commandId(), target.fcAckKey(), timeService.getMissionTime(), AckStatus.OK);

    if (!dispatch.isPublishResultsFinalized()) {
      return;
    }

    if (dispatch.hasFlightComputerFailure()) {
      completeFlightComputerFailure(dispatch);
      return;
    }

    if (dispatch.shouldComplete()) {
      commandHistoryPublisher.publishAck(
          dispatch.commandId(),
          CommandHistoryPublisher.CommandComplete_KEY,
          timeService.getMissionTime(),
          AckStatus.OK);
    }

    if (dispatch.canRemove()) {
      releaseDispatch(dispatch);
    }
  }

  private void handleRadioAck(Target target, MqttMessage message) {
    AckDto ack = parseAck(target, message, "radio");
    if (ack == null) {
      return;
    }

    try {
      ack.validateCounted();
    } catch (IllegalArgumentException e) {
      eventProducer.sendWarning(
          "Invalid radio ack JSON for " + target.name() + ": " + e.getMessage());
      return;
    }

    RadioAckPhase phase = RadioAckPhase.fromStatus(ack.status);
    if (phase == null) {
      log.debug("Ignoring unsupported radio ack status {} from {}", ack.status, target.name());
      return;
    }

    DispatchState dispatch = resolveDispatchForAck(target, ack.cmd_id, "radio");
    if (dispatch == null) {
      return;
    }

    AckStatus ackStatus = toAckStatus(ack.status);
    if (!dispatch.recordRadioAck(target, phase)) {
      return;
    }

    commandHistoryPublisher.publishAck(
        dispatch.commandId(),
        target.radioAckKey(phase),
        timeService.getMissionTime(),
        ackStatus,
        ackStatus == AckStatus.OK ? null : ack.status);

    if (dispatch.canRemove()) {
      releaseDispatch(dispatch);
    }
  }

  private void handleStatusAck(Target target, MqttMessage message) {
    AckDto ack = parseAck(target, message, "command status");
    if (ack == null) {
      return;
    }

    try {
      ack.validateStatusOnly();
    } catch (IllegalArgumentException e) {
      eventProducer.sendWarning(
          "Invalid command status JSON for " + target.name() + ": " + e.getMessage());
      return;
    }

    if (!isCommandStatus(ack.status)) {
      log.debug("Ignoring unsupported command status {} from {}", ack.status, target.name());
      return;
    }

    DispatchState dispatch = uncountedDispatch;
    if (dispatch == null || !dispatch.includesTarget(target)) {
      log.debug(
          "Ignoring command status {} from {} because no dispatch is in flight",
          ack.status,
          target.name());
      return;
    }

    AckStatus ackStatus = toAckStatus(ack.status);
    if (!dispatch.recordStatusAck(target, ackStatus, ack.status)) {
      return;
    }

    if (!dispatch.isPublishResultsFinalized()) {
      return;
    }

    if (dispatch.hasStatusFailure()) {
      completeStatusFailure(dispatch);
      return;
    }

    if (dispatch.shouldComplete()) {
      commandHistoryPublisher.publishAck(
          dispatch.commandId(),
          CommandHistoryPublisher.CommandComplete_KEY,
          timeService.getMissionTime(),
          AckStatus.OK);
    }

    if (dispatch.canRemove()) {
      releaseDispatch(dispatch);
    }
  }

  private AckStatus toAckStatus(String status) {
    if (status.endsWith("NOK")) {
      return AckStatus.NOK;
    }
    if (status.endsWith("OK")) {
      return AckStatus.OK;
    }
    return AckStatus.CANCELLED;
  }

  @Override
  public void deliveryComplete(IMqttDeliveryToken token) {}

  private FlightComputerAck tryReadAckSequence(Target target, byte[] payload) {
    int maxIndex = Math.max(target.ackFlagByteIndex(), target.ackIdByteIndex());
    if (payload.length <= maxIndex) {
      log.warn(
          "Ignoring short telemetry packet on {}. Expected at least {} bytes, got {}",
          target.ackTopic(),
          maxIndex + 1,
          payload.length);
      return null;
    }

    byte flags = payload[target.ackFlagByteIndex()];
    boolean ackFlag = ((flags >> target.ackFlagBitIndex()) & 1) == 1;
    boolean completionRejected = ((flags >> DEFAULT_COMMAND_FLAG_BIT_INDEX) & 1) == 1;
    String flagBits = String.format("%8s", Integer.toBinaryString(flags & 0xFF)).replace(' ', '0');
    log.info("Received FC flags from {}: {}", target.name(), flagBits);
    if (!ackFlag) {
      return null;
    }

    return new FlightComputerAck(payload[target.ackIdByteIndex()] & 0xFF, completionRejected);
  }

  private void connectAndSubscribe() throws MqttException {
    client.setCallback(this);
    client.connect(connOpts).waitForCompletion();

    if (targets.isEmpty() || ackRouteByTopic.isEmpty()) {
      return;
    }

    String[] topics = new String[ackRouteByTopic.size()];
    int[] qos = new int[ackRouteByTopic.size()];
    int i = 0;
    for (String topic : ackRouteByTopic.keySet()) {
      topics[i] = topic;
      qos[i] = 1;
      i++;
    }
    client.subscribe(topics, qos).waitForCompletion();
  }

  private ResolvedTargetSelection resolveTargets(PreparedCommand preparedCommand) {
    boolean sendToSystemA =
        Boolean.TRUE.equals(preparedCommand.getBooleanAttribute(TARGET_SYSTEM_A_OPTION_ID));
    boolean sendToSystemB =
        Boolean.TRUE.equals(preparedCommand.getBooleanAttribute(TARGET_SYSTEM_B_OPTION_ID));

    List<Target> selectedTargets = new ArrayList<>();
    if (sendToSystemA) {
      Target target = findTarget("SystemA");
      if (target != null) {
        selectedTargets.add(target);
      }
    }
    if (sendToSystemB) {
      Target target = findTarget("SystemB");
      if (target != null) {
        selectedTargets.add(target);
      }
    }

    if (selectedTargets.isEmpty()) {
      return new ResolvedTargetSelection(TARGET_ALL, targets);
    }

    if (selectedTargets.size() == targets.size()) {
      return new ResolvedTargetSelection(TARGET_ALL, targets);
    }

    return new ResolvedTargetSelection(selectedTargets.get(0).name(), List.copyOf(selectedTargets));
  }

  private Target findTarget(String candidate) {
    for (Target target : targets) {
      if (target.matches(candidate)) {
        return target;
      }
    }
    return null;
  }

  private static synchronized void registerCommandOption() {
    YamcsServer yamcs = YamcsServer.getServer();
    if (!yamcs.hasCommandOption(TARGET_SYSTEM_A_OPTION_ID)) {
      CommandOption systemAOption =
          new CommandOption(TARGET_SYSTEM_A_OPTION_ID, "System A", CommandOptionType.BOOLEAN)
              .withHelp(
                  "Send this command only to System A. Leave unchecked to keep BOTH as default.");
      yamcs.addCommandOption(systemAOption);
    }

    if (!yamcs.hasCommandOption(TARGET_SYSTEM_B_OPTION_ID)) {
      CommandOption systemBOption =
          new CommandOption(TARGET_SYSTEM_B_OPTION_ID, "System B", CommandOptionType.BOOLEAN)
              .withHelp(
                  "Send this command only to System B. Leave unchecked to keep BOTH as default.");
      yamcs.addCommandOption(systemBOption);
    }
  }

  private void handlePublishSuccess(DispatchState dispatch, Target target) {
    DispatchProgress progress = dispatch.recordPublishSuccess(target);
    if (!progress.recorded()) {
      return;
    }

    finalizeDispatchPublish(dispatch, progress);
  }

  private void handlePublishFailure(DispatchState dispatch, Target target, Throwable error) {
    String errorMessage =
        error == null || error.getMessage() == null
            ? "Unknown publish failure"
            : error.getMessage();
    DispatchProgress progress = dispatch.recordPublishFailure(target, errorMessage);
    if (!progress.recorded()) {
      return;
    }

    if (commandCountingEnabled) {
      if (target.expectsRadioAcks()) {
        commandHistoryPublisher.publishAck(
            dispatch.commandId(),
            target.radioTxAckKey(),
            timeService.getMissionTime(),
            AckStatus.CANCELLED,
            "Uplink failed");
        commandHistoryPublisher.publishAck(
            dispatch.commandId(),
            target.radioRxAckKey(),
            timeService.getMissionTime(),
            AckStatus.CANCELLED,
            "Uplink failed");
      }
      commandHistoryPublisher.publishAck(
          dispatch.commandId(),
          target.fcAckKey(),
          timeService.getMissionTime(),
          AckStatus.CANCELLED,
          "Uplink failed");
    }

    finalizeDispatchPublish(dispatch, progress);
  }

  private void completeStatusFailure(DispatchState dispatch) {
    failedCommand(dispatch.commandId(), dispatch.statusFailureMessage());
    commandHistoryPublisher.publishAck(
        dispatch.commandId(),
        CommandHistoryPublisher.CommandComplete_KEY,
        timeService.getMissionTime(),
        dispatch.statusFailureAckStatus(),
        dispatch.statusFailureDetail());
    releaseDispatch(dispatch);
  }

  private void completeFlightComputerFailure(DispatchState dispatch) {
    if (!dispatch.markFlightComputerFailurePublished()) {
      return;
    }

    commandHistoryPublisher.publishAck(
        dispatch.commandId(),
        CommandHistoryPublisher.CommandComplete_KEY,
        timeService.getMissionTime(),
        AckStatus.NOK,
        dispatch.flightComputerFailureDetail());
  }

  private void finalizeDispatchPublish(DispatchState dispatch, DispatchProgress progress) {
    if (!progress.allPublishesResolved() || !dispatch.markPublishResultsFinalized()) {
      return;
    }

    if (dispatch.failedTargets().isEmpty()) {
      ackCommand(dispatch.commandId());
      if (dispatch.hasStatusFailure()) {
        completeStatusFailure(dispatch);
        return;
      }
      if (dispatch.hasFlightComputerFailure()) {
        completeFlightComputerFailure(dispatch);
        return;
      }
      if (dispatch.shouldComplete()) {
        commandHistoryPublisher.publishAck(
            dispatch.commandId(),
            CommandHistoryPublisher.CommandComplete_KEY,
            timeService.getMissionTime(),
            AckStatus.OK);
      }
      if (dispatch.canRemove()) {
        releaseDispatch(dispatch);
      }
      return;
    }

    String failureMessage =
        "Failed to dispatch to targets: " + String.join(", ", dispatch.failedAckNames());
    failedCommand(dispatch.commandId(), failureMessage);
    commandHistoryPublisher.publishAck(
        dispatch.commandId(),
        CommandHistoryPublisher.CommandComplete_KEY,
        timeService.getMissionTime(),
        AckStatus.CANCELLED,
        failureMessage);

    if (dispatch.isFinished()) {
      releaseDispatch(dispatch);
    }
  }

  private AckDto parseAck(Target target, MqttMessage message, String ackType) {
    String payload = new String(message.getPayload(), StandardCharsets.UTF_8).trim();
    AckDto ack;
    try {
      ack = GSON.fromJson(payload, AckDto.class);
    } catch (Exception e) {
      ack = null;
    }

    if (ack == null) {
      if (payload.isEmpty()) {
        eventProducer.sendWarning(
            "Received empty " + ackType + " ack payload for " + target.name());
        return null;
      }

      AckDto simpleAck = new AckDto();
      simpleAck.status = payload.replace("\"", "");
      return simpleAck;
    }

    return ack;
  }

  private void registerAckRoute(
      Map<String, AckRoute> ackRoutes,
      String topic,
      Target target,
      AckChannel channel,
      String topicType)
      throws ConfigurationException {
    if (topic == null || topic.isBlank()) {
      return;
    }

    AckRoute previous = ackRoutes.put(topic, new AckRoute(target, channel));
    if (previous != null) {
      throw new ConfigurationException(
          "Duplicate "
              + topicType
              + " '"
              + topic
              + "' for targets "
              + previous.target().name()
              + " and "
              + target.name());
    }
  }

  private int nextSequence() {
    while (true) {
      int current = currentCommandId.get();
      int sequence = current;
      if (sequence < FIRST_SEQUENCE || sequence > MAX_SEQUENCE) {
        sequence = FIRST_SEQUENCE;
      }

      int next = sequence >= MAX_SEQUENCE ? FIRST_SEQUENCE : sequence + 1;
      if (currentCommandId.compareAndSet(current, next)) {
        return sequence;
      }
    }
  }

  private String registerDispatch(DispatchState dispatch) {
    if (dispatch.ackTrackingMode() == AckTrackingMode.COUNTED) {
      synchronized (this) {
        if (dispatch.isResetAv() && pendingResetAvDispatch != null) {
          return "Reset AV command is still in flight; refusing to overwrite reserved ack sequence"
              + " 0";
        }

        DispatchState previous = dispatchBySequence.putIfAbsent(dispatch.sequence(), dispatch);
        if (previous != null) {
          return "Sequence "
              + dispatch.sequence()
              + " is still in flight; refusing to overwrite dispatch state";
        }

        if (dispatch.isResetAv()) {
          pendingResetAvDispatch = dispatch;
        }

        return null;
      }
    }

    synchronized (this) {
      uncountedDispatch = dispatch;
    }

    return null;
  }

  private void releaseDispatch(DispatchState dispatch) {
    if (dispatch.ackTrackingMode() == AckTrackingMode.COUNTED) {
      synchronized (this) {
        dispatchBySequence.remove(dispatch.sequence(), dispatch);
        if (pendingResetAvDispatch == dispatch) {
          pendingResetAvDispatch = null;
        }
      }
      return;
    }

    synchronized (this) {
      if (uncountedDispatch == dispatch) {
        uncountedDispatch = null;
      }
    }
  }

  private List<Target> loadTargets(YConfiguration config) {
    List<Target> loadedTargets = new ArrayList<>();
    for (YConfiguration targetConfig : config.getConfigList("targets")) {
      String name = targetConfig.getString("name");
      String ackName = targetConfig.getString("ackName", normalizeAckName(name));
      String baseTopic = targetConfig.getString("baseTopic", null);
      String commandTopic =
          targetConfig.getString("commandTopic", topicFromBase(baseTopic, "commands"));
      String ackTopic = targetConfig.getString("ackTopic", topicFromBase(baseTopic, "telemetry"));
      String statusAckTopic =
          targetConfig.getString("statusAckTopic", topicFromBase(baseTopic, "acks"));
      String radioAckTopic =
          targetConfig.getString("radioAckTopic", radioAckTopicFromBase(name, baseTopic));

      loadedTargets.add(
          new Target(
              name,
              ackName,
              commandTopic,
              ackTopic,
              statusAckTopic,
              radioAckTopic,
              targetConfig.getInt("ackFlagByteIndex", DEFAULT_ACK_FLAG_BYTE_INDEX),
              targetConfig.getInt("ackFlagBitIndex", DEFAULT_ACK_FLAG_BIT_INDEX),
              targetConfig.getInt("ackIdByteIndex", DEFAULT_ACK_ID_BYTE_INDEX)));
    }
    return List.copyOf(loadedTargets);
  }

  private String topicFromBase(String baseTopic, String suffix) {
    if (baseTopic == null || baseTopic.isBlank()) {
      return null;
    }
    return baseTopic + "/" + suffix;
  }

  private static String normalizeAckName(String name) {
    String normalized = name.toLowerCase().replaceAll("[^a-z0-9]+", "_");
    normalized = normalized.replaceAll("^_+|_+$", "");
    return switch (normalized) {
      case "systema", "system_a" -> "a";
      case "systemb", "system_b" -> "b";
      default -> normalized;
    };
  }

  private String radioAckTopicFromBase(String name, String baseTopic) {
    if (baseTopic != null && !baseTopic.isBlank()) {
      int firstSeparator = baseTopic.indexOf('/');
      if (firstSeparator > 0) {
        return baseTopic.substring(0, firstSeparator) + "/ControlStation/Radio/acks";
      }
    }

    if (name == null || name.isBlank()) {
      return null;
    }

    return name + "/ControlStation/Radio/acks";
  }

  private boolean isResetAvCommand(PreparedCommand preparedCommand) {
    String commandName = preparedCommand.getMetaCommand().getName();
    if (RESET_AV_COMMAND_NAME.equalsIgnoreCase(commandName)) {
      return true;
    }

    String commandCode = preparedCommand.getMetaCommand().getShortDescription();
    return commandCode != null && RESET_AV_COMMAND_CODE.equalsIgnoreCase(commandCode);
  }

  private DispatchState resolveDispatchForAck(Target target, int sequence, String ackSource) {
    DispatchState dispatch = dispatchBySequence.get(sequence);
    if (dispatch != null) {
      return dispatch;
    }

    if (sequence == RESET_AV_ACK_SEQUENCE) {
      DispatchState resetDispatch = pendingResetAvDispatch;
      if (resetDispatch != null && resetDispatch.includesTarget(target)) {
        log.debug(
            "Treating {} ack 0 from {} as the pending reset AV dispatch", ackSource, target.name());
        return resetDispatch;
      }
    }

    log.debug(
        "Ignoring {} ack {} from {} because no matching dispatch is in flight",
        ackSource,
        sequence,
        target.name());
    return null;
  }

  private record Target(
      String name,
      String ackName,
      String commandTopic,
      String ackTopic,
      String statusAckTopic,
      String radioAckTopic,
      int ackFlagByteIndex,
      int ackFlagBitIndex,
      int ackIdByteIndex) {

    String fcAckKey() {
      return "fc_" + ackName;
    }

    String radioAckKey(RadioAckPhase phase) {
      return switch (phase) {
        case TX -> radioTxAckKey();
        case RX -> radioRxAckKey();
      };
    }

    String radioTxAckKey() {
      return "uplink_" + ackName + "_tx";
    }

    String radioRxAckKey() {
      return "uplink_" + ackName + "_rx";
    }

    boolean expectsRadioAcks() {
      return radioAckTopic != null && !radioAckTopic.isBlank();
    }

    boolean expectsStatusAcks() {
      return statusAckTopic != null && !statusAckTopic.isBlank();
    }

    boolean matches(String candidate) {
      return name.equalsIgnoreCase(candidate) || ackName.equalsIgnoreCase(candidate);
    }
  }

  private record AckRoute(Target target, AckChannel channel) {}

  private record FlightComputerAck(int sequence, boolean completionRejected) {}

  private enum AckChannel {
    FLIGHT_COMPUTER,
    RADIO,
    STATUS
  }

  private enum AckTrackingMode {
    COUNTED,
    STATUS
  }

  private enum RadioAckPhase {
    TX,
    RX;

    static RadioAckPhase fromStatus(String status) {
      if (status == null) {
        return null;
      }
      if (status.startsWith("TX_")) {
        return TX;
      }
      if (status.startsWith("RX_")) {
        return RX;
      }
      return null;
    }
  }

  private record ResolvedTargetSelection(String value, List<Target> selectedTargets) {}

  private record DispatchProgress(boolean recorded, boolean allPublishesResolved) {}

  private static final class DispatchState {
    private final PreparedCommand preparedCommand;
    private final int sequence;
    private final AckTrackingMode ackTrackingMode;
    private final boolean resetAv;
    private final Map<String, Target> requestedTargetsByName;
    private final Set<String> expectedRadioTargets = new HashSet<>();
    private final Set<String> publishedTargets = new HashSet<>();
    private final Map<String, String> failedTargets = new HashMap<>();
    private final Set<String> flightComputerAcks = new HashSet<>();
    private final Set<String> radioTxAcks = new HashSet<>();
    private final Set<String> radioRxAcks = new HashSet<>();
    private String flightComputerFailureTargetName;
    private String flightComputerFailureDetail;
    private boolean flightComputerFailurePublished;
    private boolean statusAckReceived;
    private String statusFailureTargetName;
    private AckStatus statusFailureAckStatus;
    private String statusFailureDetail;
    private boolean publishResultsFinalized;

    private DispatchState(
        PreparedCommand preparedCommand,
        int sequence,
        Collection<Target> targets,
        AckTrackingMode ackTrackingMode,
        boolean resetAv) {
      this.preparedCommand = preparedCommand;
      this.sequence = sequence;
      this.ackTrackingMode = ackTrackingMode;
      this.resetAv = resetAv;
      this.requestedTargetsByName = new LinkedHashMap<>();
      for (Target target : targets) {
        this.requestedTargetsByName.put(target.name(), target);
        if (ackTrackingMode == AckTrackingMode.COUNTED && target.expectsRadioAcks()) {
          expectedRadioTargets.add(target.name());
        }
      }
    }

    synchronized DispatchProgress recordPublishSuccess(Target target) {
      if (!requestedTargetsByName.containsKey(target.name())
          || publishedTargets.contains(target.name())
          || failedTargets.containsKey(target.name())) {
        return new DispatchProgress(false, allPublishesResolved());
      }

      publishedTargets.add(target.name());
      return new DispatchProgress(true, allPublishesResolved());
    }

    synchronized DispatchProgress recordPublishFailure(Target target, String message) {
      if (!requestedTargetsByName.containsKey(target.name())
          || publishedTargets.contains(target.name())
          || failedTargets.containsKey(target.name())) {
        return new DispatchProgress(false, allPublishesResolved());
      }

      failedTargets.put(target.name(), message);
      return new DispatchProgress(true, allPublishesResolved());
    }

    synchronized boolean recordFlightComputerAck(Target target, boolean completionRejected) {
      if (!requestedTargetsByName.containsKey(target.name())
          || failedTargets.containsKey(target.name())) {
        return false;
      }

      if (!flightComputerAcks.add(target.name())) {
        return false;
      }

      if (completionRejected) {
        flightComputerFailureTargetName = target.name();
        flightComputerFailureDetail = "Flight computer rejected command";
      }

      return true;
    }

    synchronized boolean recordRadioAck(Target target, RadioAckPhase phase) {
      if (!expectedRadioTargets.contains(target.name())
          || failedTargets.containsKey(target.name())) {
        return false;
      }

      return switch (phase) {
        case TX -> radioTxAcks.add(target.name());
        case RX -> radioRxAcks.add(target.name());
      };
    }

    synchronized boolean recordStatusAck(Target target, AckStatus ackStatus, String message) {
      if (!requestedTargetsByName.containsKey(target.name())
          || failedTargets.containsKey(target.name())
          || hasStatusFailure()) {
        return false;
      }

      if (ackStatus == AckStatus.OK) {
        if (statusAckReceived) {
          return false;
        }
        statusAckReceived = true;
        return true;
      }

      statusFailureTargetName = target.name();
      statusFailureAckStatus = ackStatus;
      statusFailureDetail = message;
      return true;
    }

    synchronized boolean markPublishResultsFinalized() {
      if (publishResultsFinalized) {
        return false;
      }

      if (!allPublishesResolved()) {
        return false;
      }

      publishResultsFinalized = true;
      return true;
    }

    synchronized boolean shouldComplete() {
      if (ackTrackingMode == AckTrackingMode.STATUS) {
        return publishResultsFinalized
            && failedTargets.isEmpty()
            && !hasStatusFailure()
            && statusAckReceived;
      }

      return publishResultsFinalized
          && failedTargets.isEmpty()
          && !hasFlightComputerFailure()
          && flightComputerAcks.containsAll(requestedTargetsByName.keySet());
    }

    synchronized boolean isFinished() {
      if (!publishResultsFinalized) {
        return false;
      }

      return canRemove();
    }

    synchronized boolean canRemove() {
      if (!publishResultsFinalized) {
        return false;
      }

      if (ackTrackingMode == AckTrackingMode.STATUS) {
        return !failedTargets.isEmpty() || hasStatusFailure() || statusAckReceived;
      }

      Set<String> expectedFlightTargets =
          failedTargets.isEmpty() ? requestedTargetsByName.keySet() : publishedTargets;
      Set<String> expectedPublishedRadioTargets = new HashSet<>(expectedRadioTargets);
      if (!failedTargets.isEmpty()) {
        expectedPublishedRadioTargets.retainAll(publishedTargets);
      }

      return flightComputerAcks.containsAll(expectedFlightTargets)
          && radioTxAcks.containsAll(expectedPublishedRadioTargets)
          && radioRxAcks.containsAll(expectedPublishedRadioTargets);
    }

    synchronized boolean allPublishesResolved() {
      return publishedTargets.size() + failedTargets.size() == requestedTargetsByName.size();
    }

    synchronized List<String> requestedTargetNames() {
      List<String> targetNames = new ArrayList<>();
      for (Target target : requestedTargetsByName.values()) {
        targetNames.add(target.name());
      }
      return targetNames;
    }

    synchronized List<String> failedAckNames() {
      List<String> ackNames = new ArrayList<>();
      for (String targetName : failedTargets.keySet()) {
        Target target = requestedTargetsByName.get(targetName);
        ackNames.add(target == null ? targetName : target.ackName());
      }
      return ackNames;
    }

    int sequence() {
      return sequence;
    }

    AckTrackingMode ackTrackingMode() {
      return ackTrackingMode;
    }

    boolean isResetAv() {
      return resetAv;
    }

    synchronized boolean includesTarget(Target target) {
      return requestedTargetsByName.containsKey(target.name());
    }

    synchronized boolean isPublishResultsFinalized() {
      return publishResultsFinalized;
    }

    synchronized boolean hasStatusFailure() {
      return statusFailureAckStatus != null;
    }

    synchronized AckStatus statusFailureAckStatus() {
      return statusFailureAckStatus;
    }

    synchronized boolean hasFlightComputerFailure() {
      return flightComputerFailureDetail != null;
    }

    synchronized String flightComputerFailureDetail() {
      return flightComputerFailureDetail;
    }

    synchronized String flightComputerFailureMessage() {
      Target target = requestedTargetsByName.get(flightComputerFailureTargetName);
      String targetLabel = target == null ? flightComputerFailureTargetName : target.ackName();
      return "Command completion rejected by flight computer on " + targetLabel;
    }

    synchronized boolean markFlightComputerFailurePublished() {
      if (flightComputerFailurePublished) {
        return false;
      }

      flightComputerFailurePublished = true;
      return true;
    }

    synchronized String statusFailureDetail() {
      return statusFailureDetail;
    }

    synchronized String statusFailureMessage() {
      Target target = requestedTargetsByName.get(statusFailureTargetName);
      String targetLabel = target == null ? statusFailureTargetName : target.ackName();
      return "Command ack failed on " + targetLabel + ": " + statusFailureDetail;
    }

    org.yamcs.protobuf.Commanding.CommandId commandId() {
      return preparedCommand.getCommandId();
    }

    synchronized Set<String> failedTargets() {
      return Set.copyOf(failedTargets.keySet());
    }
  }

  private static final class AckDto {
    Integer cmd_id;
    String status;

    void validateCounted() {
      if (cmd_id == null) {
        throw new IllegalArgumentException("Missing required field: cmd_id");
      }
      validateStatusOnly();
    }

    void validateStatusOnly() {
      if (status == null) {
        throw new IllegalArgumentException("Missing required field: status");
      }
    }
  }

  private boolean isCommandStatus(String status) {
    return status != null && status.startsWith("ACK_");
  }
}
