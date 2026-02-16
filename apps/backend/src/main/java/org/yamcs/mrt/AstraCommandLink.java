package org.yamcs.mrt;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

import org.yamcs.ConfigurationException;
import org.yamcs.Spec;
import org.yamcs.YConfiguration;
import org.yamcs.cmdhistory.CommandHistoryPublisher.AckStatus;
import org.yamcs.commanding.PreparedCommand;
import org.yamcs.mrt.utils.DeviceFrequencyManager;
import org.yamcs.mrt.utils.MetadataDto;
import org.yamcs.tctm.AbstractTcDataLink;

import com.google.gson.Gson;

import org.eclipse.paho.client.mqttv3.*;

/**
 * This class is responsible for listing to command
 * events on MQTT or triggers via YAMCS and displatching
 * them to the proper MQTT channels. It's also responsible
 * for listening to acks for those commands.
 *
 * Listens to commands on topic <code>commands/send</code>.
 * Inserts those commands into the command history in YAMCS
 * and forwards them to the appropriate radios.
 *
 * Listens for acks on <code>#/acks</code>. Acks use the following shape:
 *
 * <pre>
 * {
 *	"cmd_id": int,
 *	"status": string
 * }
 * </pre>
 *
 * @author Léo Mindlin
 */
public class AstraCommandLink extends AbstractTcDataLink {
    private String instance;
    private String name;
    private YConfiguration config;
    private String detailedStatus;

    private MqttAsyncClient client;
    private MqttConnectOptions connOpts;

    private DeviceFrequencyManager deviceManager = new DeviceFrequencyManager();

    // Each command is sent with a numeric id (0-255) used when it's acknowledged.
    // We assume that there will never be more than 255 commands in the air at one
    // time. We store each command and the devices it was sent to.
    private final AtomicInteger currentCommandId = new AtomicInteger(1);

    private Map<Integer, ArrayList<String>> commandToDeviceMap = new HashMap<>();
    private Map<Integer, PreparedCommand> commandToPreparedMap = new HashMap<>();

    @Override
    public void init(String instance, String name, YConfiguration config) throws ConfigurationException {
        super.init(instance, name, config);
        this.instance = instance;
        this.name = name;
        this.config = config;
        this.detailedStatus = "Not started.";

        this.connOpts = MqttUtils.getConnectionOptions(config);
        this.client = MqttUtils.newClient(config);
    }

    @Override
    public Spec getSpec() {
        var spec = getDefaultSpec();
        MqttUtils.addConnectionOptionsToSpec(spec);
        return spec;
    }

    @Override
    protected void doStart() {
        try {
            client.setCallback(new MqttCallback() {
                @Override
                public void connectionLost(Throwable cause) {

                    eventProducer.sendWarning(
                            "MQTT connection lost: " + cause.getMessage());
                }

                @Override
                public void messageArrived(String topic, MqttMessage message) {
                    handleMqttMessage(topic, message);
                }

                @Override
                public void deliveryComplete(IMqttDeliveryToken token) {
                }
            });

            client.connect(connOpts).waitForCompletion();
            String[] topics = { "*/acks", "*/metadata", "commands/send" };
            int[] qos = { 1, 1 };
            client.subscribe(topics, qos).waitForCompletion();

            detailedStatus = "Connected to MQTT broker, listening for commands";

            eventProducer.sendInfo(detailedStatus);
            notifyStarted();

        } catch (Exception e) {
            detailedStatus = "Failed to start AstraCommandLink: " + e.getMessage();
            eventProducer.sendWarning(detailedStatus);
            notifyFailed(e);
        }
    }

    @Override
    protected void doStop() {
        try {
            client.disconnect().waitForCompletion();
        } catch (Exception e) {
            eventProducer.sendWarning("Error disconnecting MQTT: " + e.getMessage());
        }
        notifyStopped();
    }

    @Override
    public String getDetailedStatus() {
        return detailedStatus;
    }

    @Override
    protected org.yamcs.tctm.Link.Status connectionStatus() {
        return client.isConnected() ? Status.OK : Status.UNAVAIL;
    };

    private void handleMqttMessage(String topic, MqttMessage message) {
        try {
            dataIn(1, message.getPayload().length);

            if ("commands/send".equalsIgnoreCase(topic))
                handleIncomingCommand(message);

            String[] parts = topic.split("/");
            if (parts.length < 2)
                return;

            String deviceName = parts[0]; // e.g., radio-pad-a
            String subTopic = parts[1]; // metadata or telemetry or ack

            if ("acks".equalsIgnoreCase(subTopic))
                handleAck(deviceName, message);
            else if ("metadata".equalsIgnoreCase(subTopic))
                handleMetadata(deviceName, message);

        } catch (Exception e) {
            eventProducer.sendWarning(
                    "Error handling message on topic " + topic + ": " + e.getMessage());
        }
    }

    @Override
    public boolean sendCommand(PreparedCommand preparedCommand) {
        // Commands are sent as a simple CSV string
        // <cmd-id>,<cmd-name>
        String cmdId = preparedCommand.getMetaCommand().getShortDescription();

        int seqNum = currentCommandId.getAndIncrement();
        if (seqNum > 255) {
            currentCommandId.set(1);
            seqNum = 1;
        }

        this.commandHistoryPublisher.publish(preparedCommand.getCommandId(), "Command_Id", cmdId);
        this.commandHistoryPublisher.publish(preparedCommand.getCommandId(), "Sequence_Count", seqNum);

        commandToPreparedMap.put(seqNum, preparedCommand);

        String cmdPayload = seqNum + "," + cmdId;
        MqttMessage msg = new MqttMessage(cmdPayload.getBytes());

        Collection<String> devices = deviceManager.getAllSelectedDevices();
        int successCount = 0;

        for (var device : devices) {
            try {
                client.publish(device + "/commands", msg, null, new IMqttActionListener() {
                    @Override
                    public void onSuccess(IMqttToken asyncActionToken) {
                        ackCommand(preparedCommand.getCommandId());
                    }

                    @Override
                    public void onFailure(IMqttToken asyncActionToken, Throwable exception) {
                        log.warn("Failed to send command", exception);
                        failedCommand(preparedCommand.getCommandId(), exception.toString());
                    }
                });

                dataOut(1, cmdPayload.length());

                successCount++;
            } catch (MqttException e) {
                log.warn("Failed to send command {}", e);
            }
        }

        return true;
    };

    private void handleIncomingCommand(MqttMessage message) {

    }

    private void handleMetadata(String deviceName, MqttMessage message) {
        byte[] payload = message.getPayload();
        // Retained empty payload means device gone (Last Will)
        if (payload == null || payload.length == 0) {
            deviceManager.removeDevice(deviceName);
            return;
        }

        try {
            String jsonString = new String(payload, StandardCharsets.UTF_8);
            MetadataDto metadata = new Gson().fromJson(jsonString, MetadataDto.class);
            if (metadata == null) {
                throw new IllegalArgumentException("Metadata payload is null");
            }

            metadata.validate();

        } catch (Exception e) {
            eventProducer.sendDistress(
                    "Error metadata ack JSON for " + deviceName + ": " + e.getMessage());
        }

    }

    private void handleAck(String deviceName, MqttMessage message) {
        byte[] payload = message.getPayload();

        try {
            String jsonString = new String(payload, StandardCharsets.UTF_8);

            AckDto ack = new Gson().fromJson(jsonString, AckDto.class);
            if (ack == null) {
                throw new IllegalArgumentException("ACK payload is null");
            }

            ack.validate();

            PreparedCommand command = commandToPreparedMap.get(ack.cmd_id);

            AckStatus ackStatus;
            if (ack.status.contains("OK")) {
                ackStatus = AckStatus.OK;
            } else if (ack.status.contains("NOK")) {
                ackStatus = AckStatus.NOK;
            } else {
                ackStatus = AckStatus.CANCELLED;
            }

            commandHistoryPublisher.publishAck(
                    command.getCommandId(),
                    deviceName + "",
                    timeService.getMissionTime(),
                    ackStatus);

        } catch (Exception e) {
            eventProducer.sendDistress(
                    "Error parsing ack JSON for " + deviceName + ": " + e.getMessage());
        }
    }

    private static final class AckDto {
        Number cmd_id;
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
