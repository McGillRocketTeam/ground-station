package org.yamcs.labjack2;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import org.yamcs.labjack.LabJackPacket;
import org.yamcs.logging.Log;

public class LabJackCsvWriterV2 {
  private static final Log log = new Log(LabJackCsvWriterV2.class);
  private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ISO_LOCAL_TIME;

  private final File file;
  private BufferedWriter writer;
  private boolean healthy;

  public LabJackCsvWriterV2() {
    String name =
        "labj_" + new SimpleDateFormat("yyyy-MM-dd--HH-mm-ss").format(new Date()) + ".csv";
    file = new File(LabJackConfigV2.CSV_DIR + File.separator + name);
  }

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
    for (int i = LabJackConfigV2.ANALOG_PIN_START; i <= LabJackConfigV2.ANALOG_PIN_END; i++) {
      sb.append("AIN").append(i).append(",");
    }
    for (int i = 0; i < LabJackConfigV2.NUM_DIGITAL_PINS; i++) {
      sb.append("DIO").append(i);
      if (i < LabJackConfigV2.NUM_DIGITAL_PINS - 1) {
        sb.append(",");
      }
    }
    writer.write(sb.toString());
    writer.newLine();
  }

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
    for (float value : analog) {
      row.append(value).append(",");
    }

    int[] dio = LabJackPacket.readDigitalBits(packet);
    for (int i = 0; i < dio.length; i++) {
      row.append(dio[i]);
      if (i < dio.length - 1) {
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
