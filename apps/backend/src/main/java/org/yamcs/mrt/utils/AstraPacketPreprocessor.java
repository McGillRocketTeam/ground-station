package org.yamcs.mrt.utils;

import org.yamcs.ConfigurationException;
import org.yamcs.TmPacket;
import org.yamcs.YConfiguration;
import org.yamcs.mdb.MdbFactory;
import org.yamcs.tctm.AbstractPacketPreprocessor;
import org.yamcs.utils.TimeEncoding;
import org.yamcs.xtce.SequenceContainer;

public class AstraPacketPreprocessor extends AbstractPacketPreprocessor {

  // where from the packet to read the 4 bytes sequence count
  final int seqCountOffset = 0;

  // Optional. If unset Yamcs will attempt to determine it in other ways
  SequenceContainer rootContainer;

  public AstraPacketPreprocessor(String yamcsInstance, YConfiguration config) {
    super(yamcsInstance, config);

    var rootContainerName = config.getString("rootContainer", null);
    if (rootContainerName != null) {
      var mdb = MdbFactory.getInstance(yamcsInstance);
      rootContainer = mdb.getSequenceContainer(rootContainerName);
      if (rootContainer == null) {
        throw new ConfigurationException(
            "MDB does not have a sequence container named '" + rootContainerName + "'");
      }
    }
  }

  @Override
  public TmPacket process(TmPacket tmPacket) {
    byte[] packet = tmPacket.getPacket();

    int seqCount = 0;
    if (seqCountOffset >= 0) {
      if (packet.length < seqCountOffset + 2) {
        eventProducer.sendWarning(
            ETYPE_CORRUPTED_PACKET, "Packet too short to extract sequence count");
        seqCount = -1;
      } else {
        seqCount = getLittleEndianInt16(packet);
      }
    }

    tmPacket.setGenerationTime(TimeEncoding.getWallclockTime());

    tmPacket.setSequenceCount(seqCount);
    tmPacket.setRootContainer(rootContainer);
    return tmPacket;
  }

  private int getLittleEndianInt16(byte[] data) {
    if (data == null || data.length < 2) {
      throw new IllegalArgumentException("Byte array must have at least 2 bytes");
    }

    // & 0xFF converts signed byte to unsigned int
    int low = data[0] & 0xFF;
    int high = data[1] & 0xFF;

    // Shift high byte 8 bits to the left and combine with low byte
    return (high << 8) | low;
  }
}
