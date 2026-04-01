package org.yamcs.mrt.utils;

import org.eclipse.paho.client.mqttv3.MqttMessage;

public interface MqttTopicHandler {
  void handleMqtt(String topic, MqttMessage message);
}
