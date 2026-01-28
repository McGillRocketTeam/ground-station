package org.yamcs.mqtt;

import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.YConfiguration;

/**
 * Instances of this interface are run on the outgoing TC frames to transform them to MQTT messages
 */
public interface FrameToMqttConverter {
    /**
     * Called at initialisation; the config may be empty but won't be null.
     */
    void init(String yamcsInstance, String linkName, YConfiguration config);

    MqttMessage convert(byte[] frameData);
}

