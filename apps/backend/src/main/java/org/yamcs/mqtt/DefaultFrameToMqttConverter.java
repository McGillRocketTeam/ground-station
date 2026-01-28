package org.yamcs.mqtt;

import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.YConfiguration;

public class DefaultFrameToMqttConverter implements FrameToMqttConverter {

    @Override
    public void init(String yamcsInstance, String linkName, YConfiguration config) {
    }

    @Override
    public MqttMessage convert(byte[] frameData) {
        return new MqttMessage(frameData);
    }

}
