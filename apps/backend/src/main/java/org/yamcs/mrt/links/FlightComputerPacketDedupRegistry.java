package org.yamcs.mrt.links;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

final class FlightComputerPacketDedupRegistry {
  private static final int HALF_SEQUENCE_RANGE = 0x8000;
  private static final int MAX_OLD_PACKET_WINDOW = 10;
  private static final Map<String, Integer> LAST_ACCEPTED_PACKET_IDS = new ConcurrentHashMap<>();

  private FlightComputerPacketDedupRegistry() {}

  static boolean shouldProcess(String systemName, int packetId) {
    boolean[] accepted = new boolean[1];
    LAST_ACCEPTED_PACKET_IDS.compute(
        systemName,
        (key, currentPacketId) -> {
          if (currentPacketId == null || isNewerPacketId(packetId, currentPacketId)) {
            accepted[0] = true;
            return packetId;
          }

          accepted[0] = false;
          return currentPacketId;
        });
    return accepted[0];
  }

  static void clear() {
    LAST_ACCEPTED_PACKET_IDS.clear();
  }

  static boolean isNewerPacketId(int candidatePacketId, int currentPacketId) {
    int delta = (candidatePacketId - currentPacketId) & 0xFFFF;
    if (delta == 0) {
      return false;
    }

    if (delta < HALF_SEQUENCE_RANGE) {
      return true;
    }

    int backwardDelta = (currentPacketId - candidatePacketId) & 0xFFFF;
    return backwardDelta > MAX_OLD_PACKET_WINDOW;
  }
}
