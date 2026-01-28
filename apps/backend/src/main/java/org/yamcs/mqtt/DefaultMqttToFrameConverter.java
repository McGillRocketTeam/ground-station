package org.yamcs.mqtt;

import java.util.Collections;

import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.YConfiguration;
import org.yamcs.YamcsServer;
import org.yamcs.time.TimeService;

public class DefaultMqttToFrameConverter implements MqttToFrameConverter {
    TimeService timeService;

    @Override
    public void init(String yamcsInstance, String linkName, YConfiguration config) {
        this.timeService = YamcsServer.getTimeService(yamcsInstance);
    }

    @Override
    public Iterable<RawFrame> convert(MqttMessage message) {
        byte[] data = message.getPayload();
        var frame = new RawFrame(timeService.getHresMissionTime(), data);
        return Collections.singletonList(frame);
    }

}
