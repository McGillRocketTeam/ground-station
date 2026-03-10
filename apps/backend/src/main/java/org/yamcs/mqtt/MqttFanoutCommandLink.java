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
  private static final int DEFAULT_ACK_ID_BYTE_INDEX = 3;
  private static final Gson GSON = new Gson();

  private String detailedStatus = "Not started.";
  private MqttAsyncClient client;
  private MqttConnectOptions connOpts;

  private List<Target> targets = List.of();
  private Map<String, AckRoute> ackRouteByTopic = Map.of();

  private final AtomicInteger currentCommandId = new AtomicInteger(1);
  private final Map<Integer, DispatchState> dispatchBySequence = new ConcurrentHashMap<>();

  @Override
  public void init(String yamcsInstance, String linkName, YConfiguration config)
      throws ConfigurationException {
    super.init(yamcsInstance, linkName, config);

    registerCommandOption();
    connOpts = MqttUtils.getConnectionOptions(config);
    client = MqttUtils.newClient(config);
    targets = loadTargets(config);

    Map<String, AckRoute> ackRoutes = new LinkedHashMap<>();
    for (Target target : targets) {
      registerAckRoute(ackRoutes, target.ackTopic(), target, AckChannel.FLIGHT_COMPUTER, "ackTopic");
      registerAckRoute(ackRoutes, target.radioAckTopic(), target, AckChannel.RADIO, "radioAckTopic");
    }
    ackRouteByTopic = Collections.unmodifiableMap(ackRoutes);
  }

  @Override
  public Spec getSpec() {
    Spec spec = getDefaultSpec();
    MqttUtils.addConnectionOptionsToSpec(spec);

    Spec targetSpec = new Spec();
    targetSpec.addOption("name", OptionType.STRING).withRequired(true);
    targetSpec.addOption("ackName", OptionType.STRING).withRequired(false);
    targetSpec.addOption("baseTopic", OptionType.STRING).withRequired(false);
    targetSpec.addOption("commandTopic", OptionType.STRING).withRequired(false);
    targetSpec.addOption("ackTopic", OptionType.STRING).withRequired(false);
    targetSpec.addOption("radioAckTopic", OptionType.STRING).withRequired(false);
    targetSpec.addOption("ackFlagByteIndex", OptionType.INTEGER).withDefault(DEFAULT_ACK_FLAG_BYTE_INDEX);
    targetSpec.addOption("ackFlagBitIndex", OptionType.INTEGER).withDefault(DEFAULT_ACK_FLAG_BIT_INDEX);
    targetSpec.addOption("ackIdByteIndex", OptionType.INTEGER).withDefault(DEFAULT_ACK_ID_BYTE_INDEX);
    targetSpec.requireOneOf("baseTopic", "commandTopic");
    targetSpec.requireOneOf("baseTopic", "ackTopic");

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

      detailedStatus = "Connected to MQTT broker and listening for FC and radio acks";
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

    int sequence = nextSequence();
    DispatchState dispatch =
        new DispatchState(preparedCommand, sequence, targetSelection.selectedTargets());
    DispatchState previous = dispatchBySequence.putIfAbsent(sequence, dispatch);
    if (previous != null) {
      failedCommand(
          preparedCommand.getCommandId(),
          "Sequence " + sequence + " is still in flight; refusing to overwrite dispatch state");
      return false;
    }

    commandHistoryPublisher.publish(preparedCommand.getCommandId(), "Command_Id", commandCode);
    commandHistoryPublisher.publish(preparedCommand.getCommandId(), "Sequence_Count", sequence);
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

    for (Target target : targetSelection.selectedTargets()) {
      commandHistoryPublisher.publishAck(
          preparedCommand.getCommandId(), target.uplinkAckKey(), missionTime, AckStatus.PENDING);
      if (target.expectsRadioAcks()) {
        commandHistoryPublisher.publishAck(
            preparedCommand.getCommandId(), target.radioTxAckKey(), missionTime, AckStatus.PENDING);
        commandHistoryPublisher.publishAck(
            preparedCommand.getCommandId(), target.radioRxAckKey(), missionTime, AckStatus.PENDING);
      }
      commandHistoryPublisher.publishAck(
          preparedCommand.getCommandId(), target.fcAckKey(), missionTime, AckStatus.PENDING);
    }

    String payload = sequence + "," + commandCode;
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
      dispatchBySequence.remove(sequence, dispatch);
      failedCommand(preparedCommand.getCommandId(), "No command targets are configured");
      return false;
    }

    return true;
  }

  @Override
  public void connectionLost(Throwable cause) {
    detailedStatus = "MQTT connection lost: " + cause.getMessage();
    eventProducer.sendWarning(detailedStatus);
  }

  @Override
  public void messageArrived(String topic, MqttMessage message) {
    AckRoute ackRoute = ackRouteByTopic.get(topic);
    if (ackRoute == null) {
      return;
    }

    dataIn(1, message.getPayload().length);

    if (ackRoute.channel() == AckChannel.RADIO) {
      handleRadioAck(ackRoute.target(), message);
      return;
    }

    handleFlightComputerAck(ackRoute.target(), message.getPayload());
  }

  private void handleFlightComputerAck(Target target, byte[] payload) {
    Integer sequence = tryReadAckSequence(target, payload);
    if (sequence == null) {
      return;
    }

    DispatchState dispatch = dispatchBySequence.get(sequence);
    if (dispatch == null) {
      log.debug("Ignoring FC ack {} from {} because no dispatch is in flight", sequence, target.name());
      return;
    }

    if (!dispatch.recordFlightComputerAck(target)) {
      return;
    }

    commandHistoryPublisher.publishAck(
        dispatch.commandId(), target.fcAckKey(), timeService.getMissionTime(), AckStatus.OK);

    if (dispatch.shouldComplete()) {
      commandHistoryPublisher.publishAck(
          dispatch.commandId(),
          CommandHistoryPublisher.CommandComplete_KEY,
          timeService.getMissionTime(),
          AckStatus.OK);
    }

    if (dispatch.canRemove()) {
      dispatchBySequence.remove(sequence, dispatch);
    }
  }

  private void handleRadioAck(Target target, MqttMessage message) {
    AckDto ack;
    try {
      ack = GSON.fromJson(new String(message.getPayload(), StandardCharsets.UTF_8), AckDto.class);
    } catch (Exception e) {
      eventProducer.sendWarning(
          "Error parsing radio ack JSON for " + target.name() + ": " + e.getMessage());
      return;
    }

    if (ack == null) {
      eventProducer.sendWarning("Received empty radio ack JSON for " + target.name());
      return;
    }

    try {
      ack.validate();
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

    DispatchState dispatch = dispatchBySequence.get(ack.cmd_id);
    if (dispatch == null) {
      log.debug(
          "Ignoring radio ack {} for sequence {} from {} because no dispatch is in flight",
          ack.status,
          ack.cmd_id,
          target.name());
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
      dispatchBySequence.remove(dispatch.sequence(), dispatch);
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
  public void deliveryComplete(IMqttDeliveryToken token) {
  }

  private Integer tryReadAckSequence(Target target, byte[] payload) {
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
    if (!ackFlag) {
      return null;
    }

    return payload[target.ackIdByteIndex()] & 0xFF;
  }

  private void connectAndSubscribe() throws MqttException {
    client.setCallback(this);
    client.connect(connOpts).waitForCompletion();

    if (targets.isEmpty()) {
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
              .withHelp("Send this command only to System A. Leave unchecked to keep BOTH as default.");
      yamcs.addCommandOption(systemAOption);
    }

    if (!yamcs.hasCommandOption(TARGET_SYSTEM_B_OPTION_ID)) {
      CommandOption systemBOption =
          new CommandOption(TARGET_SYSTEM_B_OPTION_ID, "System B", CommandOptionType.BOOLEAN)
              .withHelp("Send this command only to System B. Leave unchecked to keep BOTH as default.");
      yamcs.addCommandOption(systemBOption);
    }
  }

  private void handlePublishSuccess(DispatchState dispatch, Target target) {
    DispatchProgress progress = dispatch.recordPublishSuccess(target);
    if (!progress.recorded()) {
      return;
    }

    commandHistoryPublisher.publishAck(
        dispatch.commandId(), target.uplinkAckKey(), timeService.getMissionTime(), AckStatus.OK);

    finalizeDispatchPublish(dispatch, progress);
  }

  private void handlePublishFailure(DispatchState dispatch, Target target, Throwable error) {
    DispatchProgress progress = dispatch.recordPublishFailure(target, error.getMessage());
    if (!progress.recorded()) {
      return;
    }

    String message = error.getMessage() == null ? error.toString() : error.getMessage();
    commandHistoryPublisher.publishAck(
        dispatch.commandId(),
        target.uplinkAckKey(),
        timeService.getMissionTime(),
        AckStatus.NOK,
        message);
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

    finalizeDispatchPublish(dispatch, progress);
  }

  private void finalizeDispatchPublish(DispatchState dispatch, DispatchProgress progress) {
    if (!progress.allPublishesResolved() || !dispatch.markPublishResultsFinalized()) {
      return;
    }

    if (dispatch.failedTargets().isEmpty()) {
      ackCommand(dispatch.commandId());
      if (dispatch.shouldComplete()) {
        commandHistoryPublisher.publishAck(
            dispatch.commandId(),
            CommandHistoryPublisher.CommandComplete_KEY,
            timeService.getMissionTime(),
            AckStatus.OK);
      }
      if (dispatch.canRemove()) {
        dispatchBySequence.remove(dispatch.sequence(), dispatch);
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
      dispatchBySequence.remove(dispatch.sequence(), dispatch);
    }
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
    int sequence = currentCommandId.getAndUpdate(value -> value >= 255 ? 1 : value + 1);
    return sequence;
  }

  private List<Target> loadTargets(YConfiguration config) {
    List<Target> loadedTargets = new ArrayList<>();
    for (YConfiguration targetConfig : config.getConfigList("targets")) {
      String name = targetConfig.getString("name");
      String ackName = targetConfig.getString("ackName", normalizeAckName(name));
      String baseTopic = targetConfig.getString("baseTopic", null);
      String commandTopic = targetConfig.getString("commandTopic", topicFromBase(baseTopic, "commands"));
      String ackTopic = targetConfig.getString("ackTopic", topicFromBase(baseTopic, "telemetry"));
      String radioAckTopic =
          targetConfig.getString("radioAckTopic", radioAckTopicFromBase(name, baseTopic));

      loadedTargets.add(
          new Target(
              name,
              ackName,
              commandTopic,
              ackTopic,
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
    return normalized.replaceAll("^_+|_+$", "");
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

  private record Target(
      String name,
      String ackName,
      String commandTopic,
      String ackTopic,
      String radioAckTopic,
      int ackFlagByteIndex,
      int ackFlagBitIndex,
      int ackIdByteIndex) {

    String uplinkAckKey() {
      return "uplink_" + ackName;
    }

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

    boolean matches(String candidate) {
      return name.equalsIgnoreCase(candidate) || ackName.equalsIgnoreCase(candidate);
    }
  }

  private record AckRoute(Target target, AckChannel channel) {}

  private enum AckChannel {
    FLIGHT_COMPUTER,
    RADIO
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

  private record DispatchProgress(boolean recorded, boolean allPublishesResolved) {
  }

  private static final class DispatchState {
    private final PreparedCommand preparedCommand;
    private final int sequence;
    private final Map<String, Target> requestedTargetsByName;
    private final Set<String> expectedRadioTargets = new HashSet<>();
    private final Set<String> publishedTargets = new HashSet<>();
    private final Map<String, String> failedTargets = new HashMap<>();
    private final Set<String> flightComputerAcks = new HashSet<>();
    private final Set<String> radioTxAcks = new HashSet<>();
    private final Set<String> radioRxAcks = new HashSet<>();
    private boolean publishResultsFinalized;

    private DispatchState(PreparedCommand preparedCommand, int sequence, Collection<Target> targets) {
      this.preparedCommand = preparedCommand;
      this.sequence = sequence;
      this.requestedTargetsByName = new LinkedHashMap<>();
      for (Target target : targets) {
        this.requestedTargetsByName.put(target.name(), target);
        if (target.expectsRadioAcks()) {
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

    synchronized boolean recordFlightComputerAck(Target target) {
      if (!requestedTargetsByName.containsKey(target.name()) || failedTargets.containsKey(target.name())) {
        return false;
      }
      return flightComputerAcks.add(target.name());
    }

    synchronized boolean recordRadioAck(Target target, RadioAckPhase phase) {
      if (!expectedRadioTargets.contains(target.name()) || failedTargets.containsKey(target.name())) {
        return false;
      }

      return switch (phase) {
        case TX -> radioTxAcks.add(target.name());
        case RX -> radioRxAcks.add(target.name());
      };
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
      return publishResultsFinalized
          && failedTargets.isEmpty()
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

    void validate() {
      if (cmd_id == null) {
        throw new IllegalArgumentException("Missing required field: cmd_id");
      }
      if (status == null) {
        throw new IllegalArgumentException("Missing required field: status");
      }
    }
  }
}
