package org.yamcs.mqtt;

import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.TmPacket;
import org.yamcs.YConfiguration;

/**
 * Instances of this interfaces are run on the incoming MQTT messages to transform them to TM packets
 */
public interface MqttToTmPacketConverter {
    /**
     * Called at initialisation; the config may be empty but won't be null.
     */
    void init(String yamcsInstance, String linkName, YConfiguration config);

    /**
     * Converts an incoming MQTT message to an iterable collection of TmPacket objects.
     * <p>
     * The implementation is responsible for setting the reception time and the data part of each TmPacket. Other fields
     * in the TmPacket are optional and can be left unpopulated.
     * <p>
     * The returned {@code Iterable} may yield no elements if the message cannot be converted.
     * 
     * @param message
     *            the MQTT message to be converted
     * @return an {@code Iterable} of TmPacket objects, possibly empty
     */
    Iterable<TmPacket> convert(MqttMessage message);
}
