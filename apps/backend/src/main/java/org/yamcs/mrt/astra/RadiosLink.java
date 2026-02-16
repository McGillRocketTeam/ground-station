package org.yamcs.mrt.astra;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.eclipse.paho.client.mqttv3.MqttAsyncClient;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.ConfigurationException;
import org.yamcs.YConfiguration;
import org.yamcs.YamcsServer;
import org.yamcs.client.Acknowledgment;
import org.yamcs.cmdhistory.Attribute;
import org.yamcs.cmdhistory.CommandHistoryPublisher;
import org.yamcs.cmdhistory.CommandHistoryPublisher.AckStatus;
import org.yamcs.commanding.PreparedCommand;
import org.yamcs.mrt.DefaultMqttToTmPacketConverter;
import org.yamcs.mrt.MqttToTmPacketConverter;
import org.yamcs.parameter.UInt32Value;
import org.yamcs.protobuf.YamcsInstance;
import org.yamcs.protobuf.Commanding.CommandId;

public class RadiosLink extends AstraSubLink {
	MqttToTmPacketConverter tmConverter;
	private String deviceName;
	private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

	// Command ID counter (1-255) and pending commands map
	private final AtomicInteger commandCountCounter = new AtomicInteger(1);
	private final ConcurrentHashMap<Integer, PreparedCommand> pendingCommands = new ConcurrentHashMap<>();

	public RadiosLink(MqttAsyncClient client) {
		super(client);
	}

	@Override
	public void init(String yamcsInstance, String linkName, YConfiguration config)
			throws ConfigurationException {
		super.init(yamcsInstance, linkName, config);

		this.deviceName = linkName.split("/")[1];

		tmConverter = new DefaultMqttToTmPacketConverter();
		tmConverter.init(yamcsInstance, linkName, config);
	}

	// @Override
	// public boolean sendCommand(PreparedCommand preparedCommand) {
	// String cmdId = preparedCommand.getMetaCommand().getShortDescription();
	//
	// int seqNum = commandCountCounter.getAndIncrement();
	// if (seqNum > 255) {
	// commandCountCounter.set(1);
	// seqNum = 1;
	// }
	//
	// this.commandHistoryPublisher.publish(preparedCommand.getCommandId(),
	// "Command_Id", cmdId);
	// this.commandHistoryPublisher.publish(preparedCommand.getCommandId(),
	// "Sequence_Count", seqNum);
	//
	// pendingCommands.put(seqNum, preparedCommand);
	//
	// String cmdPayload = seqNum + "," + cmdId;
	//
	// MqttMessage msg = new MqttMessage(cmdPayload.getBytes());
	//
	// try {
	// client.publish(this.deviceName + "/commands", msg);
	//
	// long missionTime = this.timeService.getMissionTime();
	//
	// this.commandHistoryPublisher.publishAck(
	// preparedCommand.getCommandId(),
	// Acknowledgment.SENT,
	// missionTime,
	// AckStatus.OK);
	//
	// this.commandHistoryPublisher.publishAck(
	// preparedCommand.getCommandId(),
	// "Acknowledge_Radio_RX",
	// missionTime,
	// AckStatus.PENDING);
	//
	// } catch (MqttException e) {
	// eventProducer.sendDistress(e.getLocalizedMessage());
	// e.printStackTrace();
	// return false;
	// }
	//
	// return true;
	// }
	//
	// @Override
	// public void handleAck(Number cmdId, String status) {
	// System.out.println("GOT ACK FOR cmdId: " + cmdId + " status: " + status);
	//
	// String ackType = status.substring(0, 2);
	// long missionTime = this.timeService.getMissionTime();
	//
	// PreparedCommand preparedCommand = pendingCommands.get(cmdId.intValue());
	// if (preparedCommand != null) {
	// AckStatus ackStatus;
	// if (status.contains("OK")) {
	// ackStatus = AckStatus.OK;
	// } else if (status.contains("BAD")) {
	// ackStatus = AckStatus.NOK;
	// } else {
	// ackStatus = AckStatus.CANCELLED;
	// }
	//
	// this.commandHistoryPublisher.publishAck(
	// preparedCommand.getCommandId(),
	// "Acknowledge_Radio_" + ackType,
	// missionTime,
	// ackStatus);
	//
	// if (ackType == "RX" && ackStatus == AckStatus.OK) {
	// this.commandHistoryPublisher.publishAck(
	// preparedCommand.getCommandId(),
	// "Acknowledge_Radio_TX",
	// missionTime,
	// AckStatus.PENDING);
	// }
	// } else {
	// System.out.println("No pending command found for cmdId: " + cmdId);
	// }
	// }
	//
	// private void handleFCAck(int commandAckId) {
	// PreparedCommand command = pendingCommands.get(commandAckId);
	// if (command == null) {
	// eventProducer.sendCritical(
	// "Recieved ACK for id \"" + commandAckId + "\" but no such command was found
	// in the ground station.");
	// }
	//
	// this.commandHistoryPublisher.publishAck(
	// command.getCommandId(),
	// CommandHistoryPublisher.CommandComplete_KEY,
	// this.timeService.getMissionTime(),
	// AckStatus.OK);
	// }

	@Override
	public void handleMqttMessage(MqttMessage message) {
		dataIn(1, message.getPayload().length);

		// my friend encoded this in cpp, and for him
		// he set the flag at bit index #1 (2nd from the right)
		// can you extract it as a boolean
		byte flags = message.getPayload()[2];
		boolean ackFlag = ((flags >> 1) & 1) == 1;
		if (ackFlag) {
			byte commandAckIdByte = message.getPayload()[3];
			int commandAckId = commandAckIdByte & 0xFF;
			// handleFCAck(commandAckId);
		}

		for (var tmPacket : tmConverter.convert(message)) {

			tmPacket = packetPreprocessor.process(tmPacket);
			if (tmPacket != null) {
				super.processPacket(tmPacket);
			}
		}

	}

}
