package org.yamcs.mqtt;

import java.util.Collections;
import java.util.List;

import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.YConfiguration;
import org.yamcs.YamcsServer;
import org.yamcs.logging.Log;
import org.yamcs.time.TimeService;

public class LeafMqttToFrameConverter implements MqttToFrameConverter {
    TimeService timeService;
    Log log;

    @Override
    public void init(String yamcsInstance, String linkName, YConfiguration config) {
        this.timeService = YamcsServer.getTimeService(yamcsInstance);
        this.log = new Log(this.getClass(), yamcsInstance);
    }

    @Override
    public List<RawFrame> convert(MqttMessage message) {
        try {
            var leafMsg = LeafMqttToTmPacketConverter.parseLeafMessage(message);
            System.out.println("leafMsg: " + leafMsg);
            return Collections.singletonList(new RawFrame(leafMsg.ert(), leafMsg.data()));
        } catch (Exception e) {
            log.warn("Cannot parse message {}: {}", message, e.toString());
            return Collections.emptyList();
        }
    }
}
