package org.yamcs.mrt.astra;

import org.eclipse.paho.client.mqttv3.MqttAsyncClient;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.ConfigurationException;
import org.yamcs.YConfiguration;
import org.yamcs.cmdhistory.CommandHistoryPublisher.AckStatus;
import org.yamcs.commanding.PreparedCommand;
import org.yamcs.mrt.DefaultMqttToTmPacketConverter;
import org.yamcs.mrt.MqttToTmPacketConverter;

public class RadiosLink extends AstraSubLink {
	MqttToTmPacketConverter tmConverter;

	public RadiosLink(MqttAsyncClient client) {
		super(client);
	}

	@Override
	public void init(String yamcsInstance, String linkName, YConfiguration config)
			throws ConfigurationException {
		super.init(yamcsInstance, linkName, config);

		tmConverter = new DefaultMqttToTmPacketConverter();
		tmConverter.init(yamcsInstance, linkName, config);
	}

	@Override
	public boolean sendCommand(PreparedCommand preparedCommand) {
		// this is the short code the FC expects to recieve. I.e. po, pi, etc.
		String cmdCode = preparedCommand.getMetaCommand().getShortDescription();

		// where id is 1-255
		// <id>,<cmdCode>
		String cmdPayload = "12" + "," + cmdCode;

		MqttMessage msg = new MqttMessage(cmdPayload.getBytes());

		try {
			client.publish("radio-controlstation-a/commands", msg);

			this.commandHistoryPublisher.publishAck(
					preparedCommand.getCommandId(),
					"Sent",
					this.timeService.getMissionTime(),
					AckStatus.OK);

		} catch (MqttException e) {
			eventProducer.sendDistress(e.getLocalizedMessage());
			e.printStackTrace();
			return false;
		}

		return true;
	}

	@Override
	public void handleAck(Number cmdId, String status) {
		System.out.println("GOT ACK FOR cmdId: " + cmdId + " status: " + status);
		// commandHistoryPublisher.publishAck(cmdId, key, time, state, message,
	}

	@Override
	public void handleMqttMessage(MqttMessage message) {
		dataIn(1, message.getPayload().length);

		for (var tmPacket : tmConverter.convert(message)) {
			tmPacket = packetPreprocessor.process(tmPacket);
			if (tmPacket != null) {
				super.processPacket(tmPacket);
			}
		}

	}

}
