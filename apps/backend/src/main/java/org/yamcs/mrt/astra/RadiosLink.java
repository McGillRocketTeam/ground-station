package org.yamcs.mrt.astra;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import org.eclipse.paho.client.mqttv3.MqttAsyncClient;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.ConfigurationException;
import org.yamcs.YConfiguration;
import org.yamcs.YamcsServer;
import org.yamcs.mrt.AstraCommandLink;
import org.yamcs.mrt.DefaultMqttToTmPacketConverter;
import org.yamcs.mrt.MqttToTmPacketConverter;
import org.yamcs.tctm.Link;

public class RadiosLink extends AstraSubLink {
  MqttToTmPacketConverter tmConverter;
  private String deviceName;
  private String deviceFrequency;
  private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

  public RadiosLink(MqttAsyncClient client, String frequency) {
    super(client);
    this.deviceFrequency = frequency;
  }

  @Override
  public void init(String yamcsInstance, String linkName, YConfiguration config)
      throws ConfigurationException {
    super.init(yamcsInstance, linkName, config);

    this.deviceName = linkName.split("/")[1];

    tmConverter = new DefaultMqttToTmPacketConverter();
    tmConverter.init(yamcsInstance, linkName, config);
  }

  @Override
  public void handleMqttMessage(MqttMessage message) {
    dataIn(1, message.getPayload().length);

    // This is the only point where we can access the binary packet
    // In order to pass acks along to toe AstraCommandLinkClass
    byte flags = message.getPayload()[2];
    boolean ackFlag = ((flags >> 1) & 1) == 1;
    if (ackFlag) {
      byte commandAckIdByte = message.getPayload()[3];
      int commandAckId = commandAckIdByte & 0xFF;

      var links =
          YamcsServer.getServer().getInstance(this.getYamcsInstance()).getLinkManager().getLinks();
      for (Link link : links) {
        if (link instanceof AstraCommandLink) {
          ((AstraCommandLink) link).handleFCAck(commandAckId, deviceFrequency, deviceName);
        }
      }
    }

    dataIn(1, message.getPayload().length);
    for (var tmPacket : tmConverter.convert(message)) {
      tmPacket = packetPreprocessor.process(tmPacket);
      if (tmPacket != null) {
        super.processPacket(tmPacket);
      }
    }
  }
}
