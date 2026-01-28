package org.yamcs.mqtt;

import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.YConfiguration;
import org.yamcs.commanding.PreparedCommand;

public class DefaultPreparedCommandToMqttConverter implements PreparedCommandToMqttConverter {

    @Override
    public void init(String yamcsInstance, String linkName, YConfiguration config) {
    }

    @Override
    public MqttMessage convert(PreparedCommand preparedCommand) {
        return new MqttMessage(preparedCommand.getBinary());
    }

}
