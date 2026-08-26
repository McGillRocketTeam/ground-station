package org.yamcs.mrt.links;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.yamcs.xtce.DataSource;
import org.yamcs.xtce.xml.XtceStaxReader;

class OmadaBeamBridgeLinkTest {
  @Test
  void loadsLocalTelemetryParameters() throws Exception {
    try (var reader = new XtceStaxReader("src/main/yamcs/mdb/omada-beam-bridge.xml")) {
      var system = reader.readXmlDocument();

      assertEquals(36, system.getParameterCount(true));
      system
          .getParameters(true)
          .forEach(parameter -> assertEquals(DataSource.LOCAL, parameter.getDataSource()));
    }
  }
}
