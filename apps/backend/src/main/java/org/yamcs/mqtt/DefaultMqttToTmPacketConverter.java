package org.yamcs.mqtt;

import java.util.Collections;
import java.util.List;

import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.TmPacket;
import org.yamcs.YConfiguration;
import org.yamcs.YamcsServer;
import org.yamcs.time.TimeService;

/**
 * Default MQTT packet converter - it uses the message payload as the TM packet: one mqtt message = one tm packet
 * <p>
 * It sets the
 */
public class DefaultMqttToTmPacketConverter implements MqttToTmPacketConverter {
    TimeService timeService;

    @Override
    public void init(String yamcsInstance, String linkName, YConfiguration config) {
        this.timeService = YamcsServer.getTimeService(yamcsInstance);

    }

    @Override
    public List<TmPacket> convert(MqttMessage message) {
        byte[] data = message.getPayload();
        var packet = new TmPacket(timeService.getMissionTime(), data);
        return Collections.singletonList(packet);
    }
}
