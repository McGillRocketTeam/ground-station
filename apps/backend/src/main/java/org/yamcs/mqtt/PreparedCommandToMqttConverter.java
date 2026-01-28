package org.yamcs.mqtt;

import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.YConfiguration;
import org.yamcs.commanding.PreparedCommand;

/**
 * Instances of these interfaces are run on the outgoing prepared commands to transform them to MQTT messages
 */
public interface PreparedCommandToMqttConverter {
    /**
     * Called at initialisation; the config may be empty but won't be null.
     */
    void init(String yamcsInstance, String linkName, YConfiguration config);
    

    MqttMessage convert(PreparedCommand preparedCommand);
}

