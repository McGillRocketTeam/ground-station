package org.yamcs.mqtt;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import org.eclipse.paho.client.mqttv3.IMqttActionListener;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttAsyncClient;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.yamcs.YConfiguration;
import org.yamcs.cmdhistory.CommandHistoryPublisher;
import org.yamcs.cmdhistory.CommandHistoryPublisher.AckStatus;
import org.yamcs.commanding.PreparedCommand;
import org.yamcs.logging.Log;
import org.yamcs.protobuf.Commanding.CommandId;
import org.yamcs.time.TimeService;
import org.yamcs.xtce.MetaCommand;

class MqttFanoutCommandLinkTest {

  private static final long MISSION_TIME = 42_000L;

  private CapturingTimeoutLink link;
  private CommandHistoryPublisher commandHistoryPublisher;

  @BeforeEach
  void setUp() throws Exception {
    commandHistoryPublisher = mock(CommandHistoryPublisher.class);
    link = new CapturingTimeoutLink();
    link.configureForTest(config(), commandHistoryPublisher, () -> MISSION_TIME);

    MqttAsyncClient mqttClient = mock(MqttAsyncClient.class);
    doAnswer(
            invocation -> {
              IMqttActionListener listener = invocation.getArgument(3);
              listener.onSuccess(null);
              return mock(IMqttDeliveryToken.class);
            })
        .when(mqttClient)
        .publish(anyString(), any(MqttMessage.class), isNull(), any(IMqttActionListener.class));
    replaceMqttClient(link, mqttClient);
  }

  @AfterEach
  void tearDown() throws Exception {
    replaceMqttClient(link, null);
  }

  @Test
  void resetAvTimeoutPublishesFailureAndAllowsAnotherReset() {
    PreparedCommand firstReset = resetAvCommand(1);
    assertTrue(link.sendCommand(firstReset));
    assertEquals(MqttFanoutCommandLink.FC_ACK_TIMEOUT_SECONDS, link.timeoutDelay);
    assertEquals(TimeUnit.SECONDS, link.timeoutUnit);
    Runnable firstTimeout = link.timeoutTask;
    assertNotNull(firstTimeout);

    assertFalse(link.sendCommand(resetAvCommand(2)));

    firstTimeout.run();

    verify(commandHistoryPublisher)
        .publishAck(
            eq(firstReset.getCommandId()),
            eq("fc_a"),
            eq(MISSION_TIME),
            eq(AckStatus.NOK),
            contains("timed out after 15 seconds"));
    verify(commandHistoryPublisher)
        .publishAck(
            eq(firstReset.getCommandId()),
            eq(CommandHistoryPublisher.CommandComplete_KEY),
            eq(MISSION_TIME),
            eq(AckStatus.NOK),
            contains("timed out after 15 seconds on a"));

    assertTrue(link.sendCommand(resetAvCommand(3)));
  }

  @Test
  void completedFlightComputerAckMakesScheduledTimeoutANoOp() {
    PreparedCommand reset = resetAvCommand(1);
    assertTrue(link.sendCommand(reset));
    Runnable timeout = link.timeoutTask;

    link.messageArrived(
        "SystemA/Rocket/FlightComputer/telemetry",
        new MqttMessage(new byte[] {0x00, 0x00, 0x02, 0x01}));
    timeout.run();

    verify(commandHistoryPublisher, never())
        .publishAck(
            eq(reset.getCommandId()), eq("fc_a"), eq(MISSION_TIME), eq(AckStatus.NOK), anyString());
    assertTrue(link.sendCommand(resetAvCommand(2)));
  }

  private static YConfiguration config() {
    return YConfiguration.wrap(
        Map.of(
            "brokers",
            List.of("tcp://localhost:1883"),
            "autoReconnect",
            false,
            "connectionTimeoutSecs",
            1,
            "keepAliveSecs",
            60,
            "commandCountingEnabled",
            true,
            "targets",
            List.of(
                Map.of(
                    "name",
                    "SystemA",
                    "baseTopic",
                    "SystemA/Rocket/FlightComputer",
                    "radioAckTopics",
                    List.of()))));
  }

  private static PreparedCommand resetAvCommand(int sequenceNumber) {
    CommandId commandId =
        CommandId.newBuilder()
            .setGenerationTime(MISSION_TIME)
            .setOrigin("test")
            .setSequenceNumber(sequenceNumber)
            .setCommandName("/FlightComputer/reset_av")
            .build();
    MetaCommand metaCommand = new MetaCommand("reset_av");
    metaCommand.setQualifiedName("/FlightComputer/reset_av");
    metaCommand.setShortDescription("rs");

    PreparedCommand command = new PreparedCommand(commandId);
    command.setMetaCommand(metaCommand);
    command.setBinary(new byte[] {0x01});
    command.disablePostprocessing(true);
    return command;
  }

  private static void replaceMqttClient(MqttFanoutCommandLink link, MqttAsyncClient client)
      throws Exception {
    Field clientField = MqttFanoutCommandLink.class.getDeclaredField("client");
    clientField.setAccessible(true);
    MqttAsyncClient originalClient = (MqttAsyncClient) clientField.get(link);
    if (originalClient != null) {
      originalClient.close();
    }
    clientField.set(link, client);
  }

  private static final class CapturingTimeoutLink extends MqttFanoutCommandLink {
    private Runnable timeoutTask;
    private long timeoutDelay;
    private TimeUnit timeoutUnit;

    private void configureForTest(
        YConfiguration config,
        CommandHistoryPublisher historyPublisher,
        TimeService testTimeService)
        throws Exception {
      configure(config);
      commandHistoryPublisher = historyPublisher;
      timeService = testTimeService;
      log = new Log(getClass(), "mqtt-fanout-test");
      log.setContext("FlightComputerCommands");
    }

    @Override
    ScheduledFuture<?> scheduleFlightComputerAckTimeout(
        Runnable task, long delay, TimeUnit timeUnit) {
      timeoutTask = task;
      timeoutDelay = delay;
      timeoutUnit = timeUnit;
      return mock(ScheduledFuture.class);
    }
  }
}
