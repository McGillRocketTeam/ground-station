package org.yamcs.mrt.links;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
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

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/** Publishes OpenWrt router health and active uplink throughput from the LuCI ubus API. */
public class WifiRouterLink extends AbstractParameterDataLink {
  private static final String ANONYMOUS_SESSION = "00000000000000000000000000000000";
  private static final Gson GSON = new Gson();
  private static final int HTTP_TIMEOUT_MILLIS = 5_000;
  private static final List<String> PARAMETER_NAMES =
      List.of(
          "Router/uptime_seconds", "Router/local_time", "Router/load_1m", "Router/load_5m",
          "Router/load_15m", "Router/memory_total_bytes", "Router/memory_free_bytes",
          "Router/memory_available_bytes", "Router/memory_cached_bytes", "Wan/up", "Wan/protocol",
          "Wan/ipv4_address", "Wan/ipv6_address", "Wan/default_gateway", "Wan/dns_servers",
          "Wan/logical_device", "Wan/physical_device", "Wan/uplink_type", "Interface/up", "Interface/carrier",
          "Interface/speed_mbps", "Interface/duplex", "Interface/mtu", "Interface/mac_address",
          "Interface/rx_bytes", "Interface/tx_bytes", "Interface/rx_packets", "Interface/tx_packets",
          "Interface/rx_errors", "Interface/tx_errors", "Interface/rx_dropped", "Interface/tx_dropped",
          "Traffic/rx_mbps", "Traffic/tx_mbps", "Traffic/rx_utilization_percent",
          "Traffic/tx_utilization_percent", "Traffic/rx_peak_1m_mbps", "Traffic/tx_peak_1m_mbps",
          "Traffic/rx_average_1m_mbps", "Traffic/tx_average_1m_mbps",
          "Traffic/rx_average_5m_mbps", "Traffic/tx_average_5m_mbps",
          "Traffic/rx_above_warning_percent_5m", "Traffic/tx_above_warning_percent_5m",
          "Traffic/rx_above_saturation_percent_5m", "Traffic/tx_above_saturation_percent_5m",
          "Traffic/rx_saturated", "Traffic/tx_saturated", "Traffic/bottlenecked");

  private final Map<String, Parameter> parameters = new HashMap<>();
  private final ArrayDeque<ThroughputSample> history = new ArrayDeque<>();
  private String endpoint;
  private String username;
  private String password;
  private String session;
  private String physicalDevice;
  private long previousRx = -1;
  private long previousTx = -1;
  private long previousNanos;
  private double linkSpeedMbps;
  private double warningMbps;
  private double saturationMbps;
  private int pollIntervalSeconds;
  private int discoveryCounter;
  private volatile Status status = Status.UNAVAIL;
  private volatile String detailedStatus = "Not started.";
  private ScheduledExecutorService executor;
  private int sequenceNumber;

  @Override
  public void init(String yamcsInstance, String linkName, YConfiguration config)
      throws ConfigurationException {
    super.init(yamcsInstance, linkName, config);
    endpoint = config.getString("endpoint");
    username = config.getString("username");
    password = config.getString("password");
    pollIntervalSeconds = config.getInt("pollIntervalSeconds", 2);
    linkSpeedMbps = config.getDouble("linkSpeedMbps", 100);
    warningMbps = config.getDouble("warningThresholdMbps", 80);
    saturationMbps = config.getDouble("saturationThresholdMbps", 90);

    var mdb = MdbFactory.getInstance(yamcsInstance);
    String base = "/" + linkName + "/";
    for (String name : PARAMETER_NAMES) {
      Parameter parameter = mdb.getParameter(base + name);
      if (parameter == null) {
        throw new ConfigurationException("MDB does not have WifiRouter parameter " + base + name);
      }
      parameters.put(name, parameter);
    }
  }

  @Override
  public Spec getSpec() {
    var spec = getDefaultSpec();
    spec.addOption("endpoint", OptionType.STRING).withRequired(true);
    spec.addOption("username", OptionType.STRING).withRequired(true);
    spec.addOption("password", OptionType.STRING).withRequired(true).withSecret(true);
    spec.addOption("pollIntervalSeconds", OptionType.INTEGER).withDefault(2);
    spec.addOption("linkSpeedMbps", OptionType.FLOAT).withDefault(100.0);
    spec.addOption("warningThresholdMbps", OptionType.FLOAT).withDefault(80.0);
    spec.addOption("saturationThresholdMbps", OptionType.FLOAT).withDefault(90.0);
    return spec;
  }

  @Override
  protected void doStart() {
    executor = Executors.newSingleThreadScheduledExecutor();
    executor.scheduleWithFixedDelay(this::poll, 0, pollIntervalSeconds, TimeUnit.SECONDS);
    notifyStarted();
  }

  @Override
  protected void doStop() {
    if (executor != null) executor.shutdownNow();
    notifyStopped();
  }

  @Override
  protected Status connectionStatus() {
    return status;
  }

  @Override
  public String getDetailedStatus() {
    return detailedStatus;
  }

  private void poll() {
    try {
      ensureAuthenticated();
      JsonObject interfaces =
          callWithReauthentication("network.interface", "dump", new JsonObject());
      JsonObject wan = selectUplink(interfaces);
      String discovered = wan == null ? null : string(wan, "device");
      if (discovered == null && wan != null) discovered = string(wan, "l3_device");
      if (physicalDevice == null || !physicalDevice.equals(discovered) || discoveryCounter++ >= 30) {
        resetBaseline(discovered);
        discoveryCounter = 0;
      }

      JsonObject device = new JsonObject();
      if (physicalDevice != null) {
        JsonObject deviceArgs = new JsonObject();
        deviceArgs.addProperty("name", physicalDevice);
        device = callWithReauthentication("network.device", "status", deviceArgs);
      }
      JsonObject system = callWithReauthentication("system", "info", new JsonObject());
      publish(system, wan, device, getCurrentTime(), System.nanoTime());
      status = Status.OK;
      detailedStatus = wan == null
          ? "Polling OpenWrt router at " + endpoint + "; no active internet uplink"
          : "Polling OpenWrt uplink " + string(wan, "interface") + " on device "
              + physicalDevice + " at " + endpoint;
    } catch (Exception e) {
      session = null;
      status = Status.UNAVAIL;
      detailedStatus = "OpenWrt router unavailable; retrying: " + e.getMessage();
    }
  }

  private void ensureAuthenticated() throws IOException {
    if (session != null) return;
    JsonObject credentials = new JsonObject();
    credentials.addProperty("username", username);
    credentials.addProperty("password", password);
    JsonObject response = rpc(ANONYMOUS_SESSION, "session", "login", credentials);
    session = string(response, "ubus_rpc_session");
    if (session == null) throw new IOException("ubus login response did not include a session");
  }

  private JsonObject callWithReauthentication(String object, String method, JsonObject args)
      throws IOException {
    try {
      return rpc(session, object, method, args);
    } catch (UbusPermissionException e) {
      session = null;
      ensureAuthenticated();
      return rpc(session, object, method, args);
    }
  }

  private JsonObject rpc(String token, String object, String method, JsonObject args)
      throws IOException {
    JsonObject request = new JsonObject();
    request.addProperty("jsonrpc", "2.0");
    request.addProperty("id", 1);
    request.addProperty("method", "call");
    JsonArray params = new JsonArray();
    params.add(token);
    params.add(object);
    params.add(method);
    params.add(args);
    request.add("params", params);
    byte[] body = GSON.toJson(request).getBytes(StandardCharsets.UTF_8);

    HttpURLConnection connection = (HttpURLConnection) URI.create(endpoint).toURL().openConnection();
    connection.setConnectTimeout(HTTP_TIMEOUT_MILLIS);
    connection.setReadTimeout(HTTP_TIMEOUT_MILLIS);
    connection.setRequestMethod("POST");
    connection.setRequestProperty("Content-Type", "application/json");
    connection.setRequestProperty("User-Agent", "yamcs-wifi-router-link/1.0");
    connection.setDoOutput(true);
    try (OutputStream output = connection.getOutputStream()) {
      output.write(body);
    }
    int responseCode = connection.getResponseCode();
    InputStream stream = responseCode >= 400 ? connection.getErrorStream() : connection.getInputStream();
    if (stream == null) throw new IOException("ubus returned no response body");
    String responseBody;
    try (stream) {
      responseBody = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
    }
    dataIn(1, responseBody.length());
    if (responseCode != 200) throw new IOException("ubus returned HTTP " + responseCode);

    JsonObject envelope = GSON.fromJson(responseBody, JsonObject.class);
    JsonObject error = object(envelope, "error");
    if (error != null) {
      int code = error.has("code") ? error.get("code").getAsInt() : 0;
      String message = string(error, "message");
      if (code == -32002) {
        throw new UbusPermissionException(
            "ubus access denied for " + object + "." + method
                + "; grant the login read access in /etc/config/rpcd");
      }
      throw new IOException("ubus JSON-RPC error " + code + ": " + message);
    }
    JsonArray result = envelope == null ? null : envelope.getAsJsonArray("result");
    if (result == null || result.isEmpty()) throw new IOException("ubus response has no result");
    int code = result.get(0).getAsInt();
    if (code == 6) throw new UbusPermissionException("ubus permission denied");
    if (code != 0) throw new IOException("ubus call failed with code " + code);
    return result.size() > 1 && result.get(1).isJsonObject()
        ? result.get(1).getAsJsonObject()
        : new JsonObject();
  }

  private void publish(JsonObject system, JsonObject wan, JsonObject device, long time, long nanos) {
    List<ParameterValue> values = new ArrayList<>();
    JsonObject memory = object(system, "memory");
    JsonObject statistics = object(device, "statistics");
    addLong(values, time, "Router/uptime_seconds", number(system, "uptime"));
    addLong(values, time, "Router/local_time", number(system, "localtime"));
    JsonArray load = array(system, "load");
    if (load != null) {
      if (load.size() > 0) addDouble(values, time, "Router/load_1m", load.get(0).getAsDouble() / 65536);
      if (load.size() > 1) addDouble(values, time, "Router/load_5m", load.get(1).getAsDouble() / 65536);
      if (load.size() > 2) addDouble(values, time, "Router/load_15m", load.get(2).getAsDouble() / 65536);
    }
    addLong(values, time, "Router/memory_total_bytes", number(memory, "total"));
    addLong(values, time, "Router/memory_free_bytes", number(memory, "free"));
    addLong(values, time, "Router/memory_available_bytes", number(memory, "available"));
    addLong(values, time, "Router/memory_cached_bytes", number(memory, "cached"));
    addBoolean(values, time, "Wan/up", wan == null ? false : bool(wan, "up"));
    addString(values, time, "Wan/protocol", string(wan, "proto"));
    addString(values, time, "Wan/ipv4_address", firstAddress(wan, "ipv4-address"));
    addString(values, time, "Wan/ipv6_address", firstAddress(wan, "ipv6-address"));
    addString(values, time, "Wan/default_gateway", defaultGateway(wan));
    addString(values, time, "Wan/dns_servers", joined(wan, "dns-server"));
    addString(values, time, "Wan/logical_device", string(wan, "l3_device"));
    addString(values, time, "Wan/physical_device", physicalDevice);
    UplinkType uplinkType = classifyUplink(wan);
    add(values, time, "Wan/uplink_type",
        ValueUtility.getEnumeratedValue(uplinkType.code(), uplinkType.name()));
    addBoolean(values, time, "Interface/up", bool(device, "up"));
    addBoolean(values, time, "Interface/carrier", bool(device, "carrier"));
    addLong(values, time, "Interface/speed_mbps", number(device, "speed"));
    addString(values, time, "Interface/duplex", string(device, "duplex"));
    addLong(values, time, "Interface/mtu", number(device, "mtu"));
    addString(values, time, "Interface/mac_address", string(device, "macaddr"));
    for (String field : List.of("rx_bytes", "tx_bytes", "rx_packets", "tx_packets", "rx_errors",
        "tx_errors", "rx_dropped", "tx_dropped")) {
      addLong(values, time, "Interface/" + field, number(statistics, field));
    }

    Long rx = number(statistics, "rx_bytes");
    Long tx = number(statistics, "tx_bytes");
    ThroughputSample sample = calculateThroughput(previousRx, previousTx, rx, tx, previousNanos, nanos);
    previousRx = rx == null ? -1 : rx;
    previousTx = tx == null ? -1 : tx;
    previousNanos = nanos;
    if (sample != null) {
      history.addLast(sample);
      while (!history.isEmpty() && nanos - history.getFirst().nanos() > TimeUnit.MINUTES.toNanos(5)) {
        history.removeFirst();
      }
      addTraffic(values, time, sample, nanos);
    }
    if (!values.isEmpty()) updateParameters(time, "wifi-router", sequenceNumber++, values);
  }

  static ThroughputSample calculateThroughput(
      long previousRx, long previousTx, Long rx, Long tx, long previousNanos, long nanos) {
    if (rx == null || tx == null || previousRx < 0 || previousTx < 0 || previousNanos == 0
        || rx < previousRx || tx < previousTx || nanos <= previousNanos) return null;
    double elapsed = (nanos - previousNanos) / 1_000_000_000.0;
    return new ThroughputSample(nanos, (rx - previousRx) * 8 / elapsed / 1_000_000,
        (tx - previousTx) * 8 / elapsed / 1_000_000);
  }

  static JsonObject selectUplink(JsonObject dump) {
    JsonArray interfaces = array(dump, "interface");
    JsonObject selected = null;
    long selectedMetric = Long.MAX_VALUE;
    if (interfaces != null) {
      for (JsonElement element : interfaces) {
        JsonObject candidate = element.getAsJsonObject();
        if (!Boolean.TRUE.equals(bool(candidate, "up"))) continue;
        JsonArray routes = array(candidate, "route");
        if (routes == null) continue;
        for (JsonElement routeElement : routes) {
          JsonObject route = routeElement.getAsJsonObject();
          Long mask = number(route, "mask");
          String target = string(route, "target");
          if (mask == null || mask != 0 || !("0.0.0.0".equals(target) || "::".equals(target))) {
            continue;
          }
          Long routeMetric = number(route, "metric");
          Long interfaceMetric = number(candidate, "metric");
          long metric = routeMetric != null ? routeMetric : interfaceMetric != null ? interfaceMetric : 0;
          if (selected == null || metric < selectedMetric) {
            selected = candidate;
            selectedMetric = metric;
          }
        }
      }
    }
    return selected;
  }

  static UplinkType classifyUplink(JsonObject uplink) {
    if (uplink == null) return UplinkType.NONE;
    String interfaceName = string(uplink, "interface");
    String device = string(uplink, "device");
    String protocol = string(uplink, "proto");
    String logicalIdentity = interfaceName == null ? "" : interfaceName.toLowerCase();
    String identity = String.join(" ", logicalIdentity,
        device == null ? "" : device, protocol == null ? "" : protocol).toLowerCase();
    if (logicalIdentity.contains("modem") || logicalIdentity.contains("cellular")
        || logicalIdentity.contains("lte") || logicalIdentity.contains("3g")
        || logicalIdentity.contains("4g") || logicalIdentity.contains("5g")) {
      return UplinkType.CELLULAR;
    }
    if (logicalIdentity.contains("wwan") || logicalIdentity.contains("repeater")
        || identity.contains("sta")) {
      return UplinkType.REPEATER;
    }
    if (identity.contains("tether")) return UplinkType.TETHERING;
    if (identity.contains("modem") || identity.contains("cellular") || identity.contains("lte")
        || identity.contains("3g") || identity.contains("4g") || identity.contains("5g")) {
      return UplinkType.CELLULAR;
    }
    if (identity.contains("wan") || identity.contains("eth")) return UplinkType.ETHERNET;
    return UplinkType.UNKNOWN;
  }

  private void addTraffic(List<ParameterValue> values, long time, ThroughputSample current, long nanos) {
    List<ThroughputSample> minute = history.stream()
        .filter(sample -> nanos - sample.nanos() <= TimeUnit.MINUTES.toNanos(1)).toList();
    addDouble(values, time, "Traffic/rx_mbps", current.rxMbps());
    addDouble(values, time, "Traffic/tx_mbps", current.txMbps());
    addDouble(values, time, "Traffic/rx_utilization_percent", current.rxMbps() / linkSpeedMbps * 100);
    addDouble(values, time, "Traffic/tx_utilization_percent", current.txMbps() / linkSpeedMbps * 100);
    addDouble(values, time, "Traffic/rx_peak_1m_mbps", max(minute, true));
    addDouble(values, time, "Traffic/tx_peak_1m_mbps", max(minute, false));
    addDouble(values, time, "Traffic/rx_average_1m_mbps", average(minute, true));
    addDouble(values, time, "Traffic/tx_average_1m_mbps", average(minute, false));
    addDouble(values, time, "Traffic/rx_average_5m_mbps", average(history, true));
    addDouble(values, time, "Traffic/tx_average_5m_mbps", average(history, false));
    addDouble(values, time, "Traffic/rx_above_warning_percent_5m", above(history, true, warningMbps));
    addDouble(values, time, "Traffic/tx_above_warning_percent_5m", above(history, false, warningMbps));
    double rxSaturation = above(history, true, saturationMbps);
    double txSaturation = above(history, false, saturationMbps);
    addDouble(values, time, "Traffic/rx_above_saturation_percent_5m", rxSaturation);
    addDouble(values, time, "Traffic/tx_above_saturation_percent_5m", txSaturation);
    boolean fullWindow = nanos - history.getFirst().nanos()
        >= TimeUnit.MINUTES.toNanos(5) - TimeUnit.SECONDS.toNanos(pollIntervalSeconds);
    boolean rxSaturated = sustained(history, true, saturationMbps, nanos)
        || fullWindow && rxSaturation > 20;
    boolean txSaturated = sustained(history, false, saturationMbps, nanos)
        || fullWindow && txSaturation > 20;
    addBoolean(values, time, "Traffic/rx_saturated", rxSaturated);
    addBoolean(values, time, "Traffic/tx_saturated", txSaturated);
    addBoolean(values, time, "Traffic/bottlenecked", rxSaturated || txSaturated);
  }

  static boolean sustained(Iterable<ThroughputSample> samples, boolean rx, double threshold, long now) {
    long earliest = now;
    for (ThroughputSample sample : samples) {
      double value = rx ? sample.rxMbps() : sample.txMbps();
      if (value > threshold) earliest = Math.min(earliest, sample.nanos());
      else earliest = now;
    }
    return now - earliest >= TimeUnit.SECONDS.toNanos(10);
  }

  private static double average(Iterable<ThroughputSample> samples, boolean rx) {
    double total = 0; int count = 0;
    for (var sample : samples) { total += rx ? sample.rxMbps() : sample.txMbps(); count++; }
    return count == 0 ? 0 : total / count;
  }

  private static double max(Iterable<ThroughputSample> samples, boolean rx) {
    double max = 0;
    for (var sample : samples) max = Math.max(max, rx ? sample.rxMbps() : sample.txMbps());
    return max;
  }

  private static double above(Iterable<ThroughputSample> samples, boolean rx, double threshold) {
    int count = 0; int matching = 0;
    for (var sample : samples) { count++; if ((rx ? sample.rxMbps() : sample.txMbps()) > threshold) matching++; }
    return count == 0 ? 0 : matching * 100.0 / count;
  }

  private void resetBaseline(String device) {
    physicalDevice = device;
    previousRx = previousTx = -1;
    previousNanos = 0;
    history.clear();
  }

  private void addString(List<ParameterValue> values, long time, String name, String value) {
    if (value != null) add(values, time, name, ValueUtility.getStringValue(value));
  }
  private void addLong(List<ParameterValue> values, long time, String name, Long value) {
    if (value != null) add(values, time, name, ValueUtility.getUint64Value(value));
  }
  private void addDouble(List<ParameterValue> values, long time, String name, double value) {
    add(values, time, name, ValueUtility.getDoubleValue(value));
  }
  private void addBoolean(List<ParameterValue> values, long time, String name, Boolean value) {
    if (value != null) add(values, time, name, ValueUtility.getBooleanValue(value));
  }
  private void add(List<ParameterValue> values, long time, String name, Value value) {
    var pv = new ParameterValue(parameters.get(name));
    pv.setGenerationTime(time); pv.setAcquisitionTime(time); pv.setEngValue(value); values.add(pv);
  }

  private static JsonObject object(JsonObject parent, String name) {
    JsonElement value = parent == null ? null : parent.get(name);
    return value != null && value.isJsonObject() ? value.getAsJsonObject() : null;
  }
  private static JsonArray array(JsonObject parent, String name) {
    JsonElement value = parent == null ? null : parent.get(name);
    return value != null && value.isJsonArray() ? value.getAsJsonArray() : null;
  }
  private static String string(JsonObject object, String name) {
    JsonElement value = object == null ? null : object.get(name);
    return value == null || value.isJsonNull() ? null : value.getAsString();
  }
  private static Long number(JsonObject object, String name) {
    JsonElement value = object == null ? null : object.get(name);
    return value == null || value.isJsonNull() ? null : value.getAsLong();
  }
  private static Boolean bool(JsonObject object, String name) {
    JsonElement value = object == null ? null : object.get(name);
    return value == null || value.isJsonNull() ? null : value.getAsBoolean();
  }
  private static String firstAddress(JsonObject wan, String name) {
    JsonArray addresses = array(wan, name);
    return addresses == null || addresses.isEmpty() ? null : string(addresses.get(0).getAsJsonObject(), "address");
  }
  private static String defaultGateway(JsonObject wan) {
    JsonArray routes = array(wan, "route");
    if (routes == null) return null;
    for (JsonElement route : routes) {
      JsonObject value = route.getAsJsonObject();
      if (number(value, "mask") != null && number(value, "mask") == 0) return string(value, "nexthop");
    }
    return null;
  }
  private static String joined(JsonObject object, String name) {
    JsonArray values = array(object, name);
    if (values == null) return null;
    List<String> strings = new ArrayList<>();
    values.forEach(value -> strings.add(value.getAsString()));
    return String.join(", ", strings);
  }

  record ThroughputSample(long nanos, double rxMbps, double txMbps) {}
  enum UplinkType {
    NONE(0),
    ETHERNET(1),
    REPEATER(2),
    TETHERING(3),
    CELLULAR(4),
    UNKNOWN(5);

    private final int code;

    UplinkType(int code) {
      this.code = code;
    }

    int code() {
      return code;
    }
  }
  private static final class UbusPermissionException extends IOException {
    UbusPermissionException(String message) { super(message); }
  }
}
