package org.yamcs.mrt.links;

import com.fazecast.jSerialComm.SerialPort;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.yamcs.ConfigurationException;
import org.yamcs.Spec;
import org.yamcs.Spec.OptionType;
import org.yamcs.YConfiguration;
import org.yamcs.mdb.MdbFactory;
import org.yamcs.parameter.ParameterValue;
import org.yamcs.parameter.Value;
import org.yamcs.tctm.AbstractParameterDataLink;
import org.yamcs.utils.ValueUtility;
import org.yamcs.xtce.Parameter;

/** Reconnecting serial telemetry link for a Featherweight Ground Station V2. */
public class FeatherweightLink extends AbstractParameterDataLink implements Runnable {
  private static final int DEFAULT_BAUD_RATE = 115_200;
  private static final int MAX_PACKET_BYTES = 2_048;

  private final Map<String, Parameter> parameters = new HashMap<>();
  private volatile Status status = Status.UNAVAIL;
  private volatile String detailedStatus = "Not started.";
  private volatile boolean running;
  private String device;
  private int baudRate;
  private long reconnectDelayMillis;
  private boolean requireValidCrc;
  private Thread readerThread;
  private SerialPort serialPort;
  private int sequenceNumber;

  @Override
  public void init(String yamcsInstance, String linkName, YConfiguration config)
      throws ConfigurationException {
    super.init(yamcsInstance, linkName, config);
    device = config.getString("device");
    baudRate = config.getInt("baudRate", DEFAULT_BAUD_RATE);
    reconnectDelayMillis = config.getLong("reconnectDelayMillis", 1_000);
    requireValidCrc = config.getBoolean("requireValidCrc", true);
  }

  @Override
  public Spec getSpec() {
    Spec spec = getDefaultSpec();
    spec.addOption("device", OptionType.STRING).withRequired(true);
    spec.addOption("baudRate", OptionType.INTEGER).withDefault(DEFAULT_BAUD_RATE);
    spec.addOption("reconnectDelayMillis", OptionType.INTEGER).withDefault(1_000);
    spec.addOption("requireValidCrc", OptionType.BOOLEAN).withDefault(true);
    return spec;
  }

  @Override
  protected void doStart() {
    running = true;
    readerThread = new Thread(this, getClass().getSimpleName() + "-reader");
    readerThread.setDaemon(true);
    readerThread.start();
    notifyStarted();
  }

  @Override
  protected void doStop() {
    running = false;
    closePort();
    if (readerThread != null) {
      readerThread.interrupt();
      try {
        readerThread.join(2_000);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    }
    notifyStopped();
  }

  @Override
  public void run() {
    while (running) {
      try {
        openPort();
        readPackets();
      } catch (Exception | LinkageError e) {
        if (running) {
          status = Status.UNAVAIL;
          detailedStatus =
              "Featherweight serial link unavailable at " + device + ": " + e.getMessage();
          log.warn(detailedStatus);
        }
      } finally {
        closePort();
      }

      if (running) {
        try {
          TimeUnit.MILLISECONDS.sleep(reconnectDelayMillis);
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          return;
        }
      }
    }
  }

  private void openPort() {
    SerialPort port = SerialPort.getCommPort(device);
    port.setComPortParameters(baudRate, 8, SerialPort.ONE_STOP_BIT, SerialPort.NO_PARITY);
    port.setFlowControl(SerialPort.FLOW_CONTROL_DISABLED);
    port.setComPortTimeouts(SerialPort.TIMEOUT_READ_SEMI_BLOCKING, 1_000, 0);
    if (!port.openPort()) {
      throw new IllegalStateException("could not open port");
    }
    serialPort = port;
    status = Status.OK;
    detailedStatus = "Reading Featherweight telemetry from " + device + " at " + baudRate + " baud";
    log.info(detailedStatus);
  }

  private void readPackets() throws Exception {
    ByteArrayOutputStream packet = null;
    int crcDigitsRemaining = -1;
    byte[] crcMarker = "CRC:".getBytes(StandardCharsets.US_ASCII);
    int markerIndex = 0;

    while (running && serialPort != null && serialPort.isOpen()) {
      int current = serialPort.getInputStream().read();
      if (current < 0) continue;
      dataIn(0, 1);

      if (current == '@') {
        packet = new ByteArrayOutputStream();
        packet.write(current);
        crcDigitsRemaining = -1;
        markerIndex = 0;
        continue;
      }
      if (packet == null) continue; // Discard binary FWT packets and serial noise.

      packet.write(current);
      if (packet.size() > MAX_PACKET_BYTES) {
        packet = null;
        continue;
      }

      if (crcDigitsRemaining < 0) {
        if (current == crcMarker[markerIndex]) markerIndex++;
        else markerIndex = current == crcMarker[0] ? 1 : 0;
        if (markerIndex == crcMarker.length) crcDigitsRemaining = 4;
      } else if (isHex(current)) {
        if (--crcDigitsRemaining == 0) {
          handlePacket(packet.toString(StandardCharsets.US_ASCII));
          packet = null;
        }
      }
    }
    if (running) throw new IllegalStateException("port closed");
  }

  private void handlePacket(String raw) {
    FeatherweightParser.Packet packet = FeatherweightParser.parse(raw);
    if (packet == null) {
      log.debug("Ignoring unrecognized Featherweight packet: {}", raw);
      return;
    }
    if (requireValidCrc && !packet.crcValid()) {
      log.warn("Ignoring {} packet with invalid serial CRC", packet.type());
      return;
    }

    long now = getCurrentTime();
    List<ParameterValue> values = new ArrayList<>();
    add(values, now, "packet_type", packet.type());
    add(values, now, "raw_packet", packet.raw());
    for (Map.Entry<String, Object> entry : packet.values().entrySet()) {
      add(values, now, entry.getKey(), entry.getValue());
    }
    updateParameters(now, "featherweight", sequenceNumber++, values);
  }

  private void add(List<ParameterValue> values, long time, String name, Object rawValue) {
    Parameter parameter =
        parameters.computeIfAbsent(
            name,
            key -> MdbFactory.getInstance(yamcsInstance).getParameter("/" + linkName + "/" + key));
    if (parameter == null) {
      log.warn("MDB does not have Featherweight parameter /{}/{}", linkName, name);
      return;
    }

    Value value;
    if (rawValue instanceof Boolean bool) value = ValueUtility.getBooleanValue(bool);
    else if (rawValue instanceof Double number) value = ValueUtility.getDoubleValue(number);
    else if (rawValue instanceof Number number)
      value = ValueUtility.getSint64Value(number.longValue());
    else value = ValueUtility.getStringValue(String.valueOf(rawValue));

    ParameterValue parameterValue = new ParameterValue(parameter);
    parameterValue.setGenerationTime(time);
    parameterValue.setAcquisitionTime(time);
    parameterValue.setEngValue(value);
    values.add(parameterValue);
  }

  private synchronized void closePort() {
    if (serialPort != null) {
      serialPort.closePort();
      serialPort = null;
    }
  }

  private static boolean isHex(int value) {
    return (value >= '0' && value <= '9')
        || (value >= 'a' && value <= 'f')
        || (value >= 'A' && value <= 'F');
  }

  @Override
  protected Status connectionStatus() {
    return status;
  }

  @Override
  public String getDetailedStatus() {
    return detailedStatus;
  }
}
