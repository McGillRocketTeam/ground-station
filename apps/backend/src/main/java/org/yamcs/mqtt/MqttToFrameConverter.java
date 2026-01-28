package org.yamcs.mqtt;

import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.YConfiguration;
import org.yamcs.time.Instant;

/**
 * Instances of this interfaces are run on the incoming MQTT messages to transform them to CCSDS TM frames
 */
public interface MqttToFrameConverter {
    /**
     * Called at initialisation; the config may be empty but won't be null.
     */
    void init(String yamcsInstance, String linkName, YConfiguration config);

    Iterable<RawFrame> convert(MqttMessage message);
}


record RawFrame(Instant ert, byte[] data) {
}