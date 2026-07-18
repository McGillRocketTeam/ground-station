package org.yamcs.mrt.links;

import org.yamcs.ConfigurationException;
import org.yamcs.YConfiguration;
import org.yamcs.commanding.PreparedCommand;

public class AstraGenericTmLink extends AbstractAstraGenericTmTcLink {
  private static final int PACKET_ID_BYTES = 2;

  private String systemName;

  @Override
  public void init(String instance, String name, YConfiguration config) throws ConfigurationException {
    super.init(instance, name, config);
    systemName = extractSystemName(name);
  }

  @Override
  public boolean sendCommand(PreparedCommand preparedCommand) {
    return false;
  }

  @Override
  public boolean isTcDataLinkImplemented() {
    return false;
  }

  @Override
  protected synchronized boolean shouldProcessTelemetryPayload(byte[] payload) {
    if (payload.length < PACKET_ID_BYTES) {
      return true;
    }

    int packetId = readPacketId(payload);
    return FlightComputerPacketDedupRegistry.shouldProcess(systemName, packetId);
  }

  static int readPacketId(byte[] payload) {
    return (payload[1] & 0xFF) << 8 | (payload[0] & 0xFF);
  }

  static String extractSystemName(String linkName) {
    String[] parts = linkName.split("/");
    if (parts.length < 1 || parts[0].isBlank()) {
      throw new IllegalArgumentException("Link name must start with the system name: " + linkName);
    }
    return parts[0];
  }
}
