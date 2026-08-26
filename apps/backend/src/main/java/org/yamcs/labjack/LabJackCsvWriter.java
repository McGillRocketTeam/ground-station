package org.yamcs.labjack;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import org.yamcs.logging.Log;

/**
 * Writes the full-rate local CSV record of every LabJack scan. This is deliberately independent of
 * the YAMCS publishing rate: even when the realtime/archive path is decimated for IO-latency
 * reasons, the CSV keeps every sample for post-test analysis.
 *
 * <p>Decoding is delegated to {@link LabJackPacket} so the CSV and the wire format can never
 * disagree. IO errors are logged (and disable further writes) rather than thrown, so a disk hiccup
 * can't kill the acquisition thread.
 */
public class LabJackCsvWriter {
  private static final Log log = new Log(LabJackCsvWriter.class);
  private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ISO_LOCAL_TIME;

  private final File file;
  private BufferedWriter writer;
  private boolean healthy = false;

  public LabJackCsvWriter() {
    String name =
        "labj_" + new SimpleDateFormat("yyyy-MM-dd--HH-mm-ss").format(new Date()) + ".csv";
    this.file = new File(LabJackConfig.CSV_DIR + File.separator + name);
  }

  /** Creates the directory + file and writes the header row. */
  public void open() {
    try {
      File parent = file.getParentFile();
      if (parent != null) {
        parent.mkdirs();
      }
      boolean isNew = !file.exists();
      writer = new BufferedWriter(new FileWriter(file, true));
      if (isNew) {
        writeHeader();
      }
      healthy = true;
      log.info("LabJack CSV: " + file.getAbsolutePath());
    } catch (IOException e) {
      log.error(
          "Could not open LabJack CSV file " + file.getAbsolutePath() + ": " + e.getMessage());
      healthy = false;
    }
  }

  private void writeHeader() throws IOException {
    StringBuilder sb = new StringBuilder("Reception Time,");
    for (int i = LabJackConfig.ANALOG_PIN_START; i <= LabJackConfig.ANALOG_PIN_END; i++) {
      sb.append("AIN").append(i).append(",");
    }
    for (int i = 0; i < LabJackConfig.NUM_DIGITAL_PINS; i++) {
      sb.append("DIO").append(i);
      if (i < LabJackConfig.NUM_DIGITAL_PINS - 1) {
        sb.append(",");
      }
    }
    writer.write(sb.toString());
    writer.newLine();
  }

  /** Appends one row for the given packet. No-op if the writer is unhealthy. */
  public void writeRow(long receptionTimeMillis, byte[] packet) {
    if (!healthy) {
      return;
    }
    StringBuilder row = new StringBuilder();
    row.append(
            Instant.ofEpochMilli(receptionTimeMillis)
                .atZone(ZoneId.systemDefault())
                .toLocalTime()
                .format(TIME_FMT))
        .append(",");

    float[] analog = LabJackPacket.readAnalog(packet);
    for (float v : analog) {
      row.append(v).append(",");
    }
    int[] dio = LabJackPacket.readDigitalBits(packet);
    for (int n = 0; n < dio.length; n++) {
      row.append(dio[n]);
      if (n < dio.length - 1) {
        row.append(",");
      }
    }

    try {
      writer.write(row.toString());
      writer.newLine();
    } catch (IOException e) {
      log.error("LabJack CSV write failed, disabling CSV: " + e.getMessage());
      healthy = false;
    }
  }

  public void flush() {
    if (writer == null) {
      return;
    }
    try {
      writer.flush();
    } catch (IOException e) {
      log.warn("LabJack CSV flush failed: " + e.getMessage());
    }
  }

  public void close() {
    if (writer == null) {
      return;
    }
    try {
      writer.flush();
      writer.close();
    } catch (IOException e) {
      log.warn("LabJack CSV close failed: " + e.getMessage());
    } finally {
      healthy = false;
    }
  }
}
