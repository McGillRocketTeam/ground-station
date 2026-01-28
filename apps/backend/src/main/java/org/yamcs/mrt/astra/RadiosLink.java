package org.yamcs.mrt.astra;

import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.ConfigurationException;
import org.yamcs.YConfiguration;
import org.yamcs.commanding.PreparedCommand;
import org.yamcs.mrt.DefaultMqttToTmPacketConverter;
import org.yamcs.mrt.MqttToTmPacketConverter;

public class RadiosLink extends AstraSubLink {
	MqttToTmPacketConverter tmConverter;

	@Override
	public void init(String yamcsInstance, String linkName, YConfiguration config) throws ConfigurationException {
		super.init(yamcsInstance, linkName, config);

		tmConverter = new DefaultMqttToTmPacketConverter();
		tmConverter.init(yamcsInstance, linkName, config);
	}

	@Override
	public boolean sendCommand(PreparedCommand preparedCommand) {
		// TODO Auto-generated method stub
		throw new UnsupportedOperationException("Unimplemented method 'sendCommand'");
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
