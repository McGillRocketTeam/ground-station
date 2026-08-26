package org.yamcs.labjack;

public interface LabJackLink {
  void writeDigitalPin(int pinNum, int state);
}
