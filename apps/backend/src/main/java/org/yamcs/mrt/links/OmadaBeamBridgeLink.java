package org.yamcs.mrt.links;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
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

/** Publishes Omada Beam Bridge identity, radio, and point-to-point connection telemetry. */
public class OmadaBeamBridgeLink extends AbstractParameterDataLink {
  private static final Gson GSON = new Gson();
  private static final int HTTP_TIMEOUT_MILLIS = 8_000;
  private static final List<String> PARAMETER_NAMES =
      List.of(
          "mac_address",
          "device_name",
          "role",
          "ip_address",
          "model",
          "firmware_version",
          "status",
          "connected",
          "bridge_connected",
          "peer_mac_address",
          "peer_device_name",
          "peer_ip_address",
          "channel",
          "channel_width",
          "radio_mode",
          "channel_util_percent",
          "rx_util_percent",
          "tx_util_percent",
          "interference_util_percent",
          "max_tx_rate_mbps",
          "tx_power_dbm",
          "signal_dbm",
          "snr_db",
          "tx_rate_mbps",
          "rx_rate_mbps",
          "tx_packets",
          "rx_packets",
          "tx_bytes",
          "rx_bytes",
          "tx_error_percent",
          "tx_dropped_percent",
          "rx_error_percent",
          "rx_dropped_percent",
          "cpu_percent",
          "memory_percent",
          "uptime_seconds");

  private final Map<String, Parameter> parameters = new HashMap<>();
  private String endpoint;
  private String omadacId;
  private String siteId;
  private String apMac;
  private String peerMac;
  private BridgeRole role;
  private String clientId;
  private String clientSecret;
  private int pollIntervalSeconds;
  private SSLSocketFactory insecureSslSocketFactory;
  private ScheduledExecutorService executor;
  private volatile String accessToken;
  private volatile long accessTokenExpiresAtMillis;
  private volatile Status status = Status.UNAVAIL;
  private volatile String detailedStatus = "Not started.";
  private int sequenceNumber;

  @Override
  public void init(String yamcsInstance, String linkName, YConfiguration config)
      throws ConfigurationException {
    super.init(yamcsInstance, linkName, config);
    endpoint = stripTrailingSlash(config.getString("endpoint"));
    omadacId = config.getString("omadacId");
    siteId = config.getString("siteId");
    apMac = normalizeMac(config.getString("apMac"));
    peerMac = normalizeMac(config.getString("peerMac"));
    try {
      role = BridgeRole.valueOf(config.getString("role").toUpperCase(Locale.ROOT));
    } catch (IllegalArgumentException e) {
      throw new ConfigurationException("role must be MAIN_AP or CLIENT_AP", e);
    }
    clientId = config.getString("clientId");
    clientSecret = config.getString("clientSecret");
    pollIntervalSeconds = config.getInt("pollIntervalSeconds", 2);
    if (!config.getBoolean("verifyTls", true)) {
      insecureSslSocketFactory = createInsecureSslSocketFactory();
    }

    var mdb = MdbFactory.getInstance(yamcsInstance);
    String parameterBase = "/" + linkName + "/";
    for (String parameterName : PARAMETER_NAMES) {
      Parameter parameter = mdb.getParameter(parameterBase + parameterName);
      if (parameter == null) {
        throw new ConfigurationException(
            "MDB does not have Omada Beam Bridge parameter " + parameterBase + parameterName);
      }
      parameters.put(parameterName, parameter);
    }
  }

  @Override
  public Spec getSpec() {
    var spec = getDefaultSpec();
    spec.addOption("endpoint", OptionType.STRING).withRequired(true);
    spec.addOption("omadacId", OptionType.STRING).withRequired(true);
    spec.addOption("siteId", OptionType.STRING).withRequired(true);
    spec.addOption("apMac", OptionType.STRING).withRequired(true);
    spec.addOption("peerMac", OptionType.STRING).withRequired(true);
    spec.addOption("role", OptionType.STRING).withRequired(true);
    spec.addOption("clientId", OptionType.STRING).withRequired(true);
    spec.addOption("clientSecret", OptionType.STRING).withRequired(true).withSecret(true);
    spec.addOption("pollIntervalSeconds", OptionType.INTEGER).withDefault(2);
    spec.addOption("verifyTls", OptionType.BOOLEAN).withDefault(true);
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
      String mainMac = role == BridgeRole.MAIN_AP ? apMac : peerMac;
      String clientMac = role == BridgeRole.CLIENT_AP ? apMac : peerMac;
      JsonObject overview = result(requestAuthenticated("GET", apPath(apMac), null));
      JsonObject peerOverview = result(requestAuthenticated("GET", apPath(peerMac), null));
      JsonObject mainMesh =
          result(requestAuthenticated("GET", apPath(mainMac) + "/mesh/statistics", null));
      JsonObject clientMesh =
          result(requestAuthenticated("GET", apPath(clientMac) + "/mesh/statistics", null));
      JsonObject radios = result(requestAuthenticated("GET", apPath(mainMac) + "/radios", null));

      JsonObject ownMesh = role == BridgeRole.MAIN_AP ? mainMesh : clientMesh;
      JsonObject channel = object(radios, "wp5g");
      JsonObject traffic = object(radios, "radioTraffic5g");
      JsonObject wirelessUplink = object(clientMesh, "wirelessUplink");
      boolean bridgeConnected =
          Integer.valueOf(1).equals(integer(clientMesh, "statusCategory"))
              && wirelessUplink != null;
      publish(
          new Snapshot(
              overview, peerOverview, ownMesh, channel, traffic, wirelessUplink, bridgeConnected));

      boolean controllerConnected = Integer.valueOf(1).equals(integer(ownMesh, "statusCategory"));
      status = controllerConnected ? Status.OK : Status.UNAVAIL;
      detailedStatus =
          controllerConnected
              ? role.label
                  + " "
                  + apMac
                  + (bridgeConnected ? " is linked" : " is awaiting its peer")
              : role.label + " " + apMac + " is disconnected from the Omada controller";
    } catch (Exception e) {
      status = Status.UNAVAIL;
      detailedStatus = "Omada Beam Bridge poll failed; retrying: " + e.getMessage();
      log.warn("Omada Beam Bridge poll failed for {}: {}", apMac, e.getMessage());
    }
  }

  private void publish(Snapshot snapshot) {
    long now = getCurrentTime();
    List<ParameterValue> values = new ArrayList<>();
    addString(values, now, "mac_address", apMac);
    addString(values, now, "device_name", string(snapshot.overview, "name"));
    addEnumerated(values, now, "role", role.value, role.label);
    addString(values, now, "ip_address", string(snapshot.overview, "ip"));
    addString(values, now, "model", string(snapshot.overview, "showModel"));
    addString(values, now, "firmware_version", string(snapshot.overview, "firmwareVersion"));
    int deviceStatus = intOr(snapshot.ownMesh, "status", -1);
    addEnumerated(values, now, "status", deviceStatus, statusLabel(deviceStatus));
    addBoolean(
        values,
        now,
        "connected",
        Integer.valueOf(1).equals(integer(snapshot.ownMesh, "statusCategory")));
    addBoolean(values, now, "bridge_connected", snapshot.bridgeConnected);
    addString(values, now, "peer_mac_address", peerMac);
    addString(values, now, "peer_device_name", string(snapshot.peerOverview, "name"));
    addString(values, now, "peer_ip_address", string(snapshot.peerOverview, "ip"));
    addString(values, now, "channel", string(snapshot.channel, "actualChannel"));
    addString(values, now, "channel_width", string(snapshot.channel, "bandWidth"));
    addString(values, now, "radio_mode", string(snapshot.channel, "rdMode"));
    int rxUtil = intOr(snapshot.channel, "rxUtil", 0);
    int txUtil = intOr(snapshot.channel, "txUtil", 0);
    int interferenceUtil = intOr(snapshot.channel, "interUtil", 0);
    addUint32(
        values,
        now,
        "channel_util_percent",
        integer(snapshot.channel, "busyUtil") == null
            ? Math.min(100, rxUtil + txUtil + interferenceUtil)
            : intOr(snapshot.channel, "busyUtil", 0));
    addUint32(values, now, "rx_util_percent", rxUtil);
    addUint32(values, now, "tx_util_percent", txUtil);
    addUint32(values, now, "interference_util_percent", interferenceUtil);
    addUint32(values, now, "max_tx_rate_mbps", intOr(snapshot.channel, "maxTxRate", 0));
    addSint32(values, now, "tx_power_dbm", intOr(snapshot.channel, "txPower", 0));
    addSint32(values, now, "signal_dbm", intOr(snapshot.wirelessUplink, "rssi", -127));
    addSint32(values, now, "snr_db", intOr(snapshot.wirelessUplink, "snr", 0));
    addUint32(values, now, "tx_rate_mbps", intOr(snapshot.wirelessUplink, "txRateInt", 0));
    addUint32(values, now, "rx_rate_mbps", intOr(snapshot.wirelessUplink, "rxRateInt", 0));
    long txPackets = longOr(snapshot.traffic, "txPkts", 0);
    long rxPackets = longOr(snapshot.traffic, "rxPkts", 0);
    addUint64(values, now, "tx_packets", txPackets);
    addUint64(values, now, "rx_packets", rxPackets);
    addUint64(
        values,
        now,
        "tx_bytes",
        longOr(snapshot.wirelessUplink, "upBytes", longOr(snapshot.traffic, "tx", 0)));
    addUint64(
        values,
        now,
        "rx_bytes",
        longOr(snapshot.wirelessUplink, "downBytes", longOr(snapshot.traffic, "rx", 0)));
    addDouble(
        values,
        now,
        "tx_error_percent",
        percentage(longOr(snapshot.traffic, "txErrPkts", 0), txPackets));
    addDouble(
        values,
        now,
        "tx_dropped_percent",
        percentage(longOr(snapshot.traffic, "txDropPkts", 0), txPackets));
    addDouble(
        values,
        now,
        "rx_error_percent",
        percentage(longOr(snapshot.traffic, "rxErrPkts", 0), rxPackets));
    addDouble(
        values,
        now,
        "rx_dropped_percent",
        percentage(longOr(snapshot.traffic, "rxDropPkts", 0), rxPackets));
    addUint32(values, now, "cpu_percent", intOr(snapshot.overview, "cpuUtil", 0));
    addUint32(values, now, "memory_percent", intOr(snapshot.overview, "memUtil", 0));
    addUint64(values, now, "uptime_seconds", longOr(snapshot.overview, "uptimeLong", 0));
    parameterCount.addAndGet(values.size());
    updateParameters(now, "omada-beam-bridge", sequenceNumber++, values);
  }

  private JsonObject requestAuthenticated(String method, String path, JsonObject body)
      throws IOException, InterruptedException {
    ensureAuthenticated();
    JsonObject response = request(method, path, body, accessToken);
    if (errorCode(response) == -44116) {
      accessToken = null;
      ensureAuthenticated();
      response = request(method, path, body, accessToken);
    }
    requireSuccess(response, path);
    return response;
  }

  private synchronized void ensureAuthenticated() throws IOException, InterruptedException {
    if (accessToken != null && System.currentTimeMillis() < accessTokenExpiresAtMillis) return;
    if (clientId.isBlank() || clientSecret.isBlank()) {
      throw new IOException("OMADA_CLIENT_ID and OMADA_CLIENT_SECRET are not configured");
    }
    JsonObject credentials = new JsonObject();
    credentials.addProperty("omadacId", omadacId);
    credentials.addProperty("client_id", clientId);
    credentials.addProperty("client_secret", clientSecret);
    JsonObject envelope =
        request(
            "POST", "/openapi/authorize/token?grant_type=client_credentials", credentials, null);
    requireSuccess(envelope, "/openapi/authorize/token");
    JsonObject authResult = result(envelope);
    String token = string(authResult, "accessToken");
    if (token == null || token.isBlank()) {
      throw new IOException("Omada token response has no accessToken");
    }
    int expiresIn = intOr(authResult, "expiresIn", 7200);
    accessToken = token;
    accessTokenExpiresAtMillis = System.currentTimeMillis() + Math.max(30, expiresIn - 60) * 1000L;
  }

  private JsonObject request(String method, String path, JsonObject body, String token)
      throws IOException, InterruptedException {
    byte[] requestBody =
        body == null ? new byte[0] : GSON.toJson(body).getBytes(StandardCharsets.UTF_8);
    HttpURLConnection connection =
        (HttpURLConnection) URI.create(endpoint + path).toURL().openConnection();
    connection.setConnectTimeout(HTTP_TIMEOUT_MILLIS);
    connection.setReadTimeout(HTTP_TIMEOUT_MILLIS);
    connection.setRequestMethod(method);
    connection.setRequestProperty("Accept", "application/json");
    connection.setRequestProperty("User-Agent", "yamcs-omada-beam-bridge-link/1.0");
    if (token != null) connection.setRequestProperty("Authorization", "AccessToken=" + token);
    if (connection instanceof HttpsURLConnection https && insecureSslSocketFactory != null) {
      https.setSSLSocketFactory(insecureSslSocketFactory);
      https.setHostnameVerifier((hostname, session) -> true);
    }
    if (body != null) {
      connection.setRequestProperty("Content-Type", "application/json");
      connection.setDoOutput(true);
      try (OutputStream output = connection.getOutputStream()) {
        output.write(requestBody);
      }
    }
    int statusCode = connection.getResponseCode();
    InputStream stream =
        statusCode >= HttpURLConnection.HTTP_BAD_REQUEST
            ? connection.getErrorStream()
            : connection.getInputStream();
    byte[] responseBytes = new byte[0];
    if (stream != null) {
      try (stream) {
        responseBytes = stream.readAllBytes();
      }
    }
    dataOut(1, requestBody.length);
    dataIn(1, responseBytes.length);
    if (statusCode < 200 || statusCode >= 300) {
      throw new IOException("Omada returned HTTP " + statusCode + " for " + method + " " + path);
    }
    JsonObject json =
        GSON.fromJson(new String(responseBytes, StandardCharsets.UTF_8), JsonObject.class);
    if (json == null) throw new IOException("Omada returned an empty JSON response for " + path);
    return json;
  }

  private String apPath(String mac) {
    return apiBase() + "/aps/" + encodePathSegment(mac);
  }

  private String apiBase() {
    return "/openapi/v1/" + encodePathSegment(omadacId) + "/sites/" + encodePathSegment(siteId);
  }

  private static SSLSocketFactory createInsecureSslSocketFactory() throws ConfigurationException {
    try {
      TrustManager[] trustAll =
          new TrustManager[] {
            new X509TrustManager() {
              @Override
              public X509Certificate[] getAcceptedIssuers() {
                return new X509Certificate[0];
              }

              @Override
              public void checkClientTrusted(X509Certificate[] chain, String authType) {}

              @Override
              public void checkServerTrusted(X509Certificate[] chain, String authType) {}
            }
          };
      SSLContext context = SSLContext.getInstance("TLS");
      context.init(null, trustAll, new SecureRandom());
      return context.getSocketFactory();
    } catch (GeneralSecurityException e) {
      throw new ConfigurationException("Cannot configure Omada TLS", e);
    }
  }

  private void add(List<ParameterValue> values, long time, String name, Value value) {
    ParameterValue parameterValue = new ParameterValue(parameters.get(name));
    parameterValue.setGenerationTime(time);
    parameterValue.setAcquisitionTime(time);
    parameterValue.setEngValue(value);
    values.add(parameterValue);
  }

  private void addString(List<ParameterValue> values, long time, String name, String value) {
    add(values, time, name, ValueUtility.getStringValue(value == null ? "" : value));
  }

  private void addBoolean(List<ParameterValue> values, long time, String name, boolean value) {
    add(values, time, name, ValueUtility.getBooleanValue(value));
  }

  private void addUint32(List<ParameterValue> values, long time, String name, int value) {
    add(values, time, name, ValueUtility.getUint32Value(Math.max(0, value)));
  }

  private void addUint64(List<ParameterValue> values, long time, String name, long value) {
    add(values, time, name, ValueUtility.getUint64Value(Math.max(0, value)));
  }

  private void addSint32(List<ParameterValue> values, long time, String name, int value) {
    add(values, time, name, ValueUtility.getSint32Value(value));
  }

  private void addDouble(List<ParameterValue> values, long time, String name, double value) {
    add(values, time, name, ValueUtility.getDoubleValue(value));
  }

  private void addEnumerated(
      List<ParameterValue> values, long time, String name, int value, String label) {
    add(values, time, name, ValueUtility.getEnumeratedValue(value, label));
  }

  private static JsonObject result(JsonObject envelope) {
    JsonObject value = object(envelope, "result");
    return value == null ? new JsonObject() : value;
  }

  private static JsonObject object(JsonObject parent, String name) {
    if (parent == null) return null;
    JsonElement value = parent.get(name);
    return value == null || !value.isJsonObject() ? null : value.getAsJsonObject();
  }

  private static String string(JsonObject object, String name) {
    if (object == null) return null;
    JsonElement value = object.get(name);
    return value == null || value.isJsonNull() ? null : value.getAsString();
  }

  private static Integer integer(JsonObject object, String name) {
    if (object == null) return null;
    JsonElement value = object.get(name);
    return value == null || value.isJsonNull() ? null : value.getAsInt();
  }

  private static int intOr(JsonObject object, String name, int fallback) {
    Integer value = integer(object, name);
    return value == null ? fallback : value;
  }

  private static long longOr(JsonObject object, String name, long fallback) {
    if (object == null) return fallback;
    JsonElement value = object.get(name);
    return value == null || value.isJsonNull() ? fallback : value.getAsLong();
  }

  private static double percentage(long count, long total) {
    return total <= 0 ? 0 : count * 100.0 / total;
  }

  private static void requireSuccess(JsonObject envelope, String path) throws IOException {
    int code = errorCode(envelope);
    if (code != 0) {
      throw new IOException(
          "Omada API error " + code + " for " + path + ": " + string(envelope, "msg"));
    }
  }

  private static int errorCode(JsonObject envelope) {
    Integer code = integer(envelope, "errorCode");
    return code == null ? -1 : code;
  }

  private static String normalizeMac(String mac) {
    return mac.trim().replace(':', '-').toUpperCase(Locale.ROOT);
  }

  private static String stripTrailingSlash(String value) {
    return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
  }

  private static String encodePathSegment(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
  }

  private static String statusLabel(int value) {
    return switch (value) {
      case 0 -> "DISCONNECTED";
      case 10 -> "PROVISIONING";
      case 11 -> "CONFIGURING";
      case 12 -> "UPGRADING";
      case 13 -> "REBOOTING";
      case 14 -> "CONNECTED";
      case 15 -> "CONNECTED_WIRELESS";
      case 20, 21 -> "PENDING";
      case 22, 23 -> "ADOPTING";
      case 24, 25 -> "ADOPT_FAILED";
      case 26, 27 -> "MANAGED_BY_OTHERS";
      case 30, 31, 32, 33 -> "HEARTBEAT_MISSED";
      case 40, 41 -> "ISOLATED";
      case 50 -> "SLICE_CONFIGURING";
      default -> "UNKNOWN";
    };
  }

  private enum BridgeRole {
    MAIN_AP(1, "MAIN_AP"),
    CLIENT_AP(2, "CLIENT_AP");

    private final int value;
    private final String label;

    BridgeRole(int value, String label) {
      this.value = value;
      this.label = label;
    }
  }

  private record Snapshot(
      JsonObject overview,
      JsonObject peerOverview,
      JsonObject ownMesh,
      JsonObject channel,
      JsonObject traffic,
      JsonObject wirelessUplink,
      boolean bridgeConnected) {}
}
