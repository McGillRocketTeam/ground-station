package org.yamcs.mrt.links;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.yamcs.xtce.xml.XtceStaxReader;

import com.google.gson.JsonParser;

class WifiRouterLinkTest {
  @Test
  void loadsRouterParameters() throws Exception {
    try (var reader = new XtceStaxReader("src/main/yamcs/mdb/wifi-router.xml")) {
      var system = reader.readXmlDocument();
      assertEquals(49, system.getParameterCount(true));
      assertEquals(4, system.getSubSystems().size());
    }
  }

  @Test
  void calculatesIndependentFullDuplexRates() {
    var sample = WifiRouterLink.calculateThroughput(1_000, 2_000, 25_001_000L, 2_002_000L,
        1_000_000_000L, 3_000_000_000L);
    assertEquals(100.0, sample.rxMbps(), 0.001);
    assertEquals(8.0, sample.txMbps(), 0.001);
  }

  @Test
  void discardsCounterResets() {
    assertNull(WifiRouterLink.calculateThroughput(1_000, 2_000, 10L, 20L, 1, 2));
  }

  @Test
  void selectsLowestMetricActiveDefaultRoute() throws Exception {
    var dump = JsonParser.parseString("""
        {"interface":[
          {"interface":"wan","up":false,"device":"eth0.2","metric":10,
           "route":[{"target":"0.0.0.0","mask":0}]},
          {"interface":"tethering","up":true,"device":"usb0","metric":30,
           "route":[{"target":"0.0.0.0","mask":0}]},
          {"interface":"wwan","up":true,"device":"sta1","metric":20,
           "route":[{"target":"0.0.0.0","mask":0}]}
        ]}
        """).getAsJsonObject();

    var selected = WifiRouterLink.selectUplink(dump);

    assertEquals("wwan", selected.get("interface").getAsString());
    assertEquals("sta1", selected.get("device").getAsString());
  }

  @Test
  void classifiesGlInetUplinkModes() {
    assertEquals(WifiRouterLink.UplinkType.NONE, WifiRouterLink.classifyUplink(null));
    assertEquals(WifiRouterLink.UplinkType.ETHERNET, uplink("wan", "eth0.2"));
    assertEquals(WifiRouterLink.UplinkType.REPEATER, uplink("wwan", "sta1"));
    assertEquals(WifiRouterLink.UplinkType.TETHERING, uplink("tethering", "usb0"));
    assertEquals(WifiRouterLink.UplinkType.CELLULAR, uplink("modem_1_1_2", "wwan0"));
    assertEquals(WifiRouterLink.UplinkType.UNKNOWN, uplink("custom", "tun0"));
  }

  @Test
  void selectsNoUplinkWhenRouterHasNoDefaultRoute() {
    var dump = JsonParser.parseString("""
        {"interface":[{"interface":"lan","up":true,"device":"br-lan","route":[]}]}
        """).getAsJsonObject();

    assertNull(WifiRouterLink.selectUplink(dump));
  }

  @Test
  void requiresTenSecondsOfContinuousSaturation() {
    long now = TimeUnit.SECONDS.toNanos(12);
    var saturated = List.of(new WifiRouterLink.ThroughputSample(0, 91, 1),
        new WifiRouterLink.ThroughputSample(TimeUnit.SECONDS.toNanos(11), 92, 1));
    assertTrue(WifiRouterLink.sustained(saturated, true, 90, now));
    assertFalse(WifiRouterLink.sustained(saturated, false, 90, now));
  }

  @Test
  void briefSpikeIsNotSustained() {
    long now = TimeUnit.SECONDS.toNanos(12);
    var samples = List.of(new WifiRouterLink.ThroughputSample(0, 91, 1),
        new WifiRouterLink.ThroughputSample(TimeUnit.SECONDS.toNanos(2), 20, 1),
        new WifiRouterLink.ThroughputSample(TimeUnit.SECONDS.toNanos(12), 92, 1));
    assertFalse(WifiRouterLink.sustained(samples, true, 90, now));
  }

  private static WifiRouterLink.UplinkType uplink(String interfaceName, String device) {
    var value = new com.google.gson.JsonObject();
    value.addProperty("interface", interfaceName);
    value.addProperty("device", device);
    return WifiRouterLink.classifyUplink(value);
  }
}
