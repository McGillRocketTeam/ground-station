package org.yamcs.mrt.links;

import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.YConfiguration;
import org.yamcs.mrt.utils.MqttManager;
import org.yamcs.mrt.utils.MqttTopicHandler;
import org.yamcs.tctm.AbstractTmDataLink;

public class AstraGenericTmLink extends AbstractTmDataLink implements MqttTopicHandler {

  // Local State
  private String baseTopic;

  private Status status = Status.UNAVAIL;
  private String detailedStatus = "";

  @Override
  public void init(String instance, String name, YConfiguration config) {
    MqttManager manager = MqttManager.getInstance();
    this.baseTopic = name;

    try {
      manager.subscribe(baseTopic + "/telemetry", this);
      manager.subscribe(baseTopic + "/status", this);
      manager.subscribe(baseTopic + "/detail", this);
    } catch (MqttException e) {
      e.printStackTrace();
    }

    super.init(instance, name, config);
  }

  @Override
  public void doStart() {
    notifyStarted();
  }

  @Override
  public void doStop() {
    notifyStopped();
  }

  @Override
  public Status connectionStatus() {
    return this.status;
  }

  @Override
  public Status getLinkStatus() {
    return this.status;
  }

  @Override
  public String getDetailedStatus() {
    return this.detailedStatus;
  }

  @Override
  public void handleMqtt(String topic, MqttMessage message) {

    log.info(topic + " " + new String(message.getPayload()));
    if (topic.equals(baseTopic + "/telemetry")) {

    } else if (topic.equals(baseTopic + "/detail")) {
      String payload = new String(message.getPayload());
      this.detailedStatus = payload;
    } else if (topic.equals(baseTopic + "/status")) {
      String payload = new String(message.getPayload());
      Status newStatus =
          switch (payload) {
            case "OK" -> Status.OK;
            case "FAILED" -> Status.FAILED;
            case "DISABLED" -> Status.DISABLED;
            case "UNAVAIL" -> Status.UNAVAIL;
            default -> Status.UNAVAIL;
          };

      log.info(topic + " " + new String(message.getPayload()) + " " + newStatus);
      this.status = newStatus;
    }
  }
}
