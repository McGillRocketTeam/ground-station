package org.yamcs.mrt.utils;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.eclipse.paho.client.mqttv3.*;

public class MqttManager implements MqttCallback {
  private static MqttManager instance;
  private MqttClient client;
  private final String brokerUrl = "tcp://192.168.0.9:1883";
  private final Map<String, MqttTopicHandler> handlers = new ConcurrentHashMap<>();

  private MqttManager() {
    try {
      client = new MqttClient(brokerUrl, MqttClient.generateClientId());
      client.setCallback(this);
      MqttConnectOptions options = new MqttConnectOptions();
      options.setCleanSession(true);
      client.connect(options);
    } catch (MqttException e) {
      e.printStackTrace();
    }
  }

  public static synchronized MqttManager getInstance() {
    if (instance == null) {
      instance = new MqttManager();
    }
    return instance;
  }

  public void subscribe(String topic, MqttTopicHandler handler) throws MqttException {
    handlers.put(topic, handler);
    client.subscribe(topic);
  }

  @Override
  public void messageArrived(String topic, MqttMessage message) {
    // Find the handler for this topic and delegate the work
    if (handlers.containsKey(topic)) {
      handlers.get(topic).handleMqtt(topic, message);
    }
  }

  @Override
  public void connectionLost(Throwable cause) {
    /* Handle Reconnect */
  }

  @Override
  public void deliveryComplete(IMqttDeliveryToken token) {}
}
