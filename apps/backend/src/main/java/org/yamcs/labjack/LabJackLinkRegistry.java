package org.yamcs.labjack;

public final class LabJackLinkRegistry {
  private static volatile LabJackLink current;

  private LabJackLinkRegistry() {}

  public static LabJackLink get() {
    return current;
  }

  public static void set(LabJackLink link) {
    current = link;
  }

  public static void clear(LabJackLink link) {
    if (current == link) {
      current = null;
    }
  }
}
