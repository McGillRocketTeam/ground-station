package org.yamcs.mrt.links;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.yamcs.xtce.DataSource;
import org.yamcs.xtce.xml.XtceStaxReader;

class ToughSwitchLinkTest {
  @Test
  void loadsLocalParametersInSubsystems() throws Exception {
    try (var reader = new XtceStaxReader("src/main/yamcs/mdb/toughswitch.xml")) {
      var system = reader.readXmlDocument();

      assertEquals(76, system.getParameterCount(true));
      assertEquals(10, system.getSubSystems().size());
      assertNotNull(system.getSubsystem("DeviceInformation"));
      assertNotNull(system.getSubsystem("Management"));
      for (int port = 1; port <= 8; port++) {
        assertNotNull(system.getSubsystem("Port" + port));
      }
      system
          .getParameters(true)
          .forEach(parameter -> assertEquals(DataSource.LOCAL, parameter.getDataSource()));
    }
  }
}
