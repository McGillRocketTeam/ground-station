package org.yamcs.mrt.links;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;
import org.yamcs.xtce.ArrayParameterType;
import org.yamcs.xtce.DataSource;
import org.yamcs.xtce.xml.XtceStaxReader;

class OmadaSwitchLinkTest {
  @Test
  void loadsReusableLocalParametersAndCommand() throws Exception {
    try (var reader = new XtceStaxReader("src/main/yamcs/mdb/omada-switch.xml")) {
      var system = reader.readXmlDocument();

      assertEquals(12, system.getParameterCount(true));
      system
          .getParameters(true)
          .forEach(parameter -> assertEquals(DataSource.LOCAL, parameter.getDataSource()));
      var ports = system.getParameter("ports");
      assertNotNull(ports);
      assertTrue(ports.getParameterType() instanceof ArrayParameterType);
      assertNotNull(system.getMetaCommand("set_port_status"));
      assertEquals(2, system.getMetaCommand("set_port_status").getArgumentList().size());
    }
  }

  @Test
  void filtersPortsAndAttachesClientsForOneSwitch() {
    var rows =
        JsonParser.parseString(
                """
                [
                  {"port":1,"switchMac":"AA-BB-CC-DD-EE-FF","portName":"Camera","type":1,
                   "connectedStatus":0,"linkSpeed":3,"duplex":2,"disable":false,"supportPoe":true,
                   "poe":1,"poeStatus":1,"pdClass":"4","power":8.5,"voltage":53.1,"current":160,
                   "portStatus":{"linkStatus":1,"poe":true}},
                  {"port":2,"switchMac":"11-22-33-44-55-66"}
                ]
                """)
            .getAsJsonArray();
    var detail =
        JsonParser.parseString(
                """
                {"clientList":[{"port":1,"name":"Pad camera","mac":"00-11-22-33-44-55"}]}
                """)
            .getAsJsonObject();
    var agileDetail =
        JsonParser.parseString(
                """
                {"portList":[{"port":1,"status":0}]}
                """)
            .getAsJsonObject();

    var ports = OmadaSwitchLink.parsePorts(rows, detail, agileDetail, "AA:BB:CC:DD:EE:FF", 20);

    assertEquals(1, ports.size());
    assertEquals(1, ports.get(0).port());
    assertEquals("Camera", ports.get(0).name());
    assertEquals(1, ports.get(0).clientCount());
    assertEquals("Pad camera", ports.get(0).clientNames());
    assertEquals(8.5, ports.get(0).power());
    assertTrue(ports.get(0).disabled());
  }
}
