package org.yamcs.mrt.astra;

import org.eclipse.paho.client.mqttv3.MqttAsyncClient;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.ConfigurationException;
import org.yamcs.YConfiguration;
import org.yamcs.mrt.DefaultMqttToTmPacketConverter;
import org.yamcs.mrt.MqttToTmPacketConverter;

public class ThermocoupleLink extends AstraSubLink {
	MqttToTmPacketConverter tmConverter;

	public ThermocoupleLink(MqttAsyncClient client, String frequency) {
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
