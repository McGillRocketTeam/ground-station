package org.yamcs.mrt.links;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.yamcs.tctm.Link;
import org.yamcs.xtce.xml.XtceStaxReader;

class WifiAntennaLinkTest {

  @Test
  void loadsAllParametersInPortalSubsystems() throws Exception {
    try (var reader = new XtceStaxReader("src/main/yamcs/mdb/wifi-antenna.xml")) {
      var spaceSystem = reader.readXmlDocument();

      assertEquals(52, spaceSystem.getParameterCount(true));
      assertEquals(6, spaceSystem.getSubSystems().size());
      assertTrue(spaceSystem.getParameters().isEmpty());
    }
  }

  @Test
  void staysUnavailableWhileWaitingForFirstConnection() {
    WifiAntennaLink link = new WifiAntennaLink();

    link.handlePollingFailure(new IOException("Connection refused"));

    assertEquals(Link.Status.UNAVAIL, link.connectionStatus());
    assertTrue(link.getDetailedStatus().contains("continuing to poll"));
  }

  @Test
  void becomesFailedIfPollingBreaksAfterConnectionWasEstablished() {
    WifiAntennaLink link = new WifiAntennaLink();
    link.markConnectedForTest();

    link.handlePollingFailure(new IOException("Connection reset"));

    assertEquals(Link.Status.FAILED, link.connectionStatus());
    assertTrue(link.getDetailedStatus().contains("API poll failed"));
  }
}
