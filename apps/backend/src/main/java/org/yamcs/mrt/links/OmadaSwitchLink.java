package org.yamcs.mrt.links;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
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
import org.yamcs.cmdhistory.CommandHistoryPublisher;
import org.yamcs.cmdhistory.CommandHistoryPublisher.AckStatus;
import org.yamcs.commanding.ArgumentValue;
import org.yamcs.commanding.PreparedCommand;
import org.yamcs.mdb.MdbFactory;
import org.yamcs.parameter.AggregateValue;
import org.yamcs.parameter.ArrayValue;
import org.yamcs.parameter.ParameterValue;
import org.yamcs.parameter.Value;
import org.yamcs.protobuf.Yamcs.Value.Type;
import org.yamcs.tctm.AbstractTcTmParamLink;
import org.yamcs.utils.ValueUtility;
import org.yamcs.xtce.Argument;
import org.yamcs.xtce.Parameter;
import org.yamcs.xtce.util.AggregateMemberNames;

/** Publishes an Omada switch and controls whether its ports are enabled. */
public class OmadaSwitchLink extends AbstractTcTmParamLink {
  static final int MAX_PORTS = 20;
  private static final Gson GSON = new Gson();
  private static final int HTTP_TIMEOUT_MILLIS = 8_000;
  private static final AggregateMemberNames PORT_MEMBERS =
      AggregateMemberNames.get(
          new String[] {
            "port",
            "name",
            "type",
            "connected_status",
            "link_status",
            "link_speed",
            "duplex",
            "disabled",
            "support_poe",
            "poe_mode",
            "poe_active",
            "poe_status",
            "pd_class",
            "power_w",
            "voltage_v",
            "current_ma",
            "client_count",
            "client_names",
            "client_macs"
          });
  private static final List<String> PARAMETER_NAMES =
      List.of(
          "mac_address",
          "device_name",
          "model",
          "model_version",
          "serial_number",
          "firmware_version",
          "device_status",
          "connected",
          "port_count",
          "used_port_count",
          "poe_power_used_w",
          "ports");

  private final Map<String, Parameter> parameters = new HashMap<>();
  private String endpoint;
  private String omadacId;
  private String siteId;
  private String switchMac;
  private String clientId;
  private String clientSecret;
  private int portCount;
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
    switchMac = normalizeMac(config.getString("switchMac"));
    clientId = config.getString("clientId");
    clientSecret = config.getString("clientSecret");
    portCount = config.getInt("portCount");
    pollIntervalSeconds = config.getInt("pollIntervalSeconds", 2);
    if (portCount < 1 || portCount > MAX_PORTS) {
      throw new ConfigurationException("portCount must be between 1 and " + MAX_PORTS);
    }

    if (!config.getBoolean("verifyTls", true)) {
      insecureSslSocketFactory = createInsecureSslSocketFactory();
    }
    var mdb = MdbFactory.getInstance(yamcsInstance);
    String parameterBase = "/" + linkName + "/";
    for (String parameterName : PARAMETER_NAMES) {
      Parameter parameter = mdb.getParameter(parameterBase + parameterName);
      if (parameter == null) {
        throw new ConfigurationException(
            "MDB does not have Omada parameter " + parameterBase + parameterName);
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
    spec.addOption("switchMac", OptionType.STRING).withRequired(true);
    spec.addOption("portCount", OptionType.INTEGER).withRequired(true);
    spec.addOption("clientId", OptionType.STRING).withRequired(true);
    spec.addOption("clientSecret", OptionType.STRING).withRequired(true).withSecret(true);
    spec.addOption("pollIntervalSeconds", OptionType.INTEGER).withDefault(2);
    spec.addOption("verifyTls", OptionType.BOOLEAN).withDefault(true);
    return spec;
  }

  @Override
  protected void initTm(String instance, YConfiguration config) {
    // This combined link only uses Yamcs parameter and command channels.
  }

  @Override
  public boolean isTmPacketDataLinkImplemented() {
    return false;
  }

  @Override
  protected void doStart() {
    executor = Executors.newSingleThreadScheduledExecutor();
    executor.scheduleWithFixedDelay(this::poll, 0, pollIntervalSeconds, TimeUnit.SECONDS);
    notifyStarted();
  }

  @Override
  protected void doStop() {
    if (executor != null) {
      executor.shutdownNow();
    }
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

  @Override
  public boolean sendCommand(PreparedCommand preparedCommand) {
    String qualifiedName = preparedCommand.getMetaCommand().getQualifiedName();
    if (qualifiedName == null || !qualifiedName.equals("/" + linkName + "/set_port_status")) {
      return false;
    }

    try {
      int port = argumentAsInt(preparedCommand, "port");
      int portStatus = argumentAsInt(preparedCommand, "status");
      if (port < 1 || port > portCount) {
        throw new IOException(
            "Port " + port + " is outside this switch's 1-" + portCount + " range");
      }
      if (portStatus != 0 && portStatus != 1) {
        throw new IOException("status must be OFF or ON");
      }

      JsonObject body = new JsonObject();
      body.addProperty("status", portStatus);
      requestAuthenticated(
          "PUT",
          apiBase() + "/switches/" + encodePathSegment(switchMac) + "/ports/" + port + "/status",
          body);
      ackCommand(preparedCommand.getCommandId());
      commandHistoryPublisher.publishAck(
          preparedCommand.getCommandId(),
          CommandHistoryPublisher.CommandComplete_KEY,
          getCurrentTime(),
          AckStatus.OK);
      if (executor != null) {
        executor.execute(this::poll);
      }
    } catch (Exception e) {
      log.warn("Omada port status command failed for {}: {}", switchMac, e.getMessage());
      failedCommand(preparedCommand.getCommandId(), e.getMessage());
    }
    return true;
  }

  private void poll() {
    try {
      JsonArray details =
          resultArray(
              requestAuthenticated("GET", apiBase() + "/switches/ports/switch-detail", null));
      JsonObject detail = findSwitch(details, switchMac);
      JsonObject poeEnvelope =
          requestAuthenticated(
              "GET", apiBase() + "/switches/ports/poe-info?page=1&pageSize=1000", null);
      JsonObject page = object(poeEnvelope, "result");
      JsonArray rows = page == null ? new JsonArray() : array(page, "data");
      JsonObject agileEnvelope =
          requestAuthenticated(
              "GET", apiBase() + "/switches/es/" + encodePathSegment(switchMac), null);
      List<PortInfo> ports =
          parsePorts(rows, detail, object(agileEnvelope, "result"), switchMac, portCount);
      publish(detail, ports);

      Integer statusCategory = integer(detail, "statusCategory");
      boolean connected = statusCategory != null && statusCategory == 1;
      status = connected ? Status.OK : Status.UNAVAIL;
      detailedStatus =
          connected
              ? "Polling Omada switch " + switchMac + " at " + endpoint
              : "Omada controller reachable; switch " + switchMac + " is disconnected";
    } catch (Exception e) {
      status = Status.UNAVAIL;
      detailedStatus = "Omada switch poll failed; retrying: " + e.getMessage();
      log.warn("Omada poll failed for {}: {}", switchMac, e.getMessage());
    }
  }

  private void publish(JsonObject detail, List<PortInfo> ports) {
    long now = getCurrentTime();
    List<ParameterValue> values = new ArrayList<>();
    addString(values, now, "mac_address", switchMac);
    addString(values, now, "device_name", string(detail, "name"));
    addString(values, now, "model", string(detail, "model"));
    addString(values, now, "model_version", string(detail, "modelVersion"));
    addString(values, now, "serial_number", string(detail, "sn"));
    addString(values, now, "firmware_version", string(detail, "firmwareVersion"));

    int deviceStatus = integer(detail, "status") == null ? -1 : integer(detail, "status");
    addEnumerated(values, now, "device_status", deviceStatus, deviceStatusLabel(deviceStatus));
    boolean connected = Integer.valueOf(1).equals(integer(detail, "statusCategory"));
    addBoolean(values, now, "connected", connected);
    addUint32(values, now, "port_count", portCount);
    addUint32(
        values,
        now,
        "used_port_count",
        (int) ports.stream().filter(port -> port.linkStatus() == 1).count());
    addDouble(values, now, "poe_power_used_w", ports.stream().mapToDouble(PortInfo::power).sum());
    add(values, now, "ports", portArray(ports));
    parameterCount.addAndGet(values.size());
    parameterSink.updateParameters(now, "omada-switch", sequenceNumber++, values);
  }

  private ArrayValue portArray(List<PortInfo> ports) {
    Map<Integer, PortInfo> portsByNumber = new HashMap<>();
    for (PortInfo port : ports) {
      portsByNumber.put(port.port(), port);
    }

    ArrayValue array = new ArrayValue(new int[] {MAX_PORTS}, Type.AGGREGATE);
    for (int index = 0; index < MAX_PORTS; index++) {
      int portNumber = index + 1;
      PortInfo port = portsByNumber.getOrDefault(portNumber, PortInfo.unknown(portNumber));
      AggregateValue value = new AggregateValue(PORT_MEMBERS);
      value.setMemberValue("port", ValueUtility.getUint32Value(port.port()));
      value.setMemberValue("name", ValueUtility.getStringValue(port.name()));
      value.setMemberValue(
          "type", ValueUtility.getEnumeratedValue(port.type(), portTypeLabel(port.type())));
      value.setMemberValue(
          "connected_status",
          ValueUtility.getEnumeratedValue(
              port.connectedStatus(), connectedStatusLabel(port.connectedStatus())));
      value.setMemberValue(
          "link_status",
          ValueUtility.getEnumeratedValue(port.linkStatus(), linkStatusLabel(port.linkStatus())));
      value.setMemberValue(
          "link_speed",
          ValueUtility.getEnumeratedValue(port.linkSpeed(), linkSpeedLabel(port.linkSpeed())));
      value.setMemberValue(
          "duplex", ValueUtility.getEnumeratedValue(port.duplex(), duplexLabel(port.duplex())));
      value.setMemberValue("disabled", ValueUtility.getBooleanValue(port.disabled()));
      value.setMemberValue("support_poe", ValueUtility.getBooleanValue(port.supportPoe()));
      value.setMemberValue(
          "poe_mode",
          ValueUtility.getEnumeratedValue(port.poeMode(), poeModeLabel(port.poeMode())));
      value.setMemberValue("poe_active", ValueUtility.getBooleanValue(port.poeActive()));
      value.setMemberValue("poe_status", ValueUtility.getDoubleValue(port.poeStatus()));
      value.setMemberValue("pd_class", ValueUtility.getStringValue(port.pdClass()));
      value.setMemberValue("power_w", ValueUtility.getDoubleValue(port.power()));
      value.setMemberValue("voltage_v", ValueUtility.getDoubleValue(port.voltage()));
      value.setMemberValue("current_ma", ValueUtility.getDoubleValue(port.current()));
      value.setMemberValue("client_count", ValueUtility.getUint32Value(port.clientCount()));
      value.setMemberValue("client_names", ValueUtility.getStringValue(port.clientNames()));
      value.setMemberValue("client_macs", ValueUtility.getStringValue(port.clientMacs()));
      array.setElementValue(new int[] {index}, value);
    }
    return array;
  }

  static List<PortInfo> parsePorts(
      JsonArray rows, JsonObject detail, JsonObject agileDetail, String switchMac, int portCount) {
    Map<Integer, List<String>> clientNames = new HashMap<>();
    Map<Integer, List<String>> clientMacs = new HashMap<>();
    Map<Integer, Integer> portStatuses = new HashMap<>();
    JsonArray clients = array(detail, "clientList");
    if (clients != null) {
      for (JsonElement element : clients) {
        JsonObject client = element.getAsJsonObject();
        Integer port = integer(client, "port");
        if (port == null) continue;
        clientNames
            .computeIfAbsent(port, ignored -> new ArrayList<>())
            .add(orEmpty(string(client, "name")));
        clientMacs
            .computeIfAbsent(port, ignored -> new ArrayList<>())
            .add(orEmpty(string(client, "mac")));
      }
    }

    JsonArray agilePorts = array(agileDetail, "portList");
    if (agilePorts != null) {
      for (JsonElement element : agilePorts) {
        JsonObject agilePort = element.getAsJsonObject();
        Integer port = integer(agilePort, "port");
        Integer portStatus = integer(agilePort, "status");
        if (port != null && portStatus != null) portStatuses.put(port, portStatus);
      }
    }

    List<PortInfo> ports = new ArrayList<>();
    if (rows == null) return ports;
    for (JsonElement element : rows) {
      JsonObject row = element.getAsJsonObject();
      if (!normalizeMac(orEmpty(string(row, "switchMac"))).equals(normalizeMac(switchMac)))
        continue;
      Integer port = integer(row, "port");
      if (port == null || port < 1 || port > portCount) continue;
      JsonObject portStatus = object(row, "portStatus");
      List<String> names = clientNames.getOrDefault(port, List.of());
      List<String> macs = clientMacs.getOrDefault(port, List.of());
      ports.add(
          new PortInfo(
              port,
              orEmpty(string(row, "portName")),
              intOr(row, "type", -1),
              intOr(row, "connectedStatus", -1),
              intOr(portStatus, "linkStatus", -1),
              intOr(row, "linkSpeed", -1),
              intOr(row, "duplex", -1),
              portStatuses.containsKey(port)
                  ? portStatuses.get(port) == 0
                  : boolOr(row, "disable", false),
              boolOr(row, "supportPoe", false),
              intOr(row, "poe", -1),
              boolOr(portStatus, "poe", false),
              doubleOr(row, "poeStatus", -1),
              orEmpty(string(row, "pdClass")),
              doubleOr(row, "power", 0),
              doubleOr(row, "voltage", 0),
              doubleOr(row, "current", 0),
              names.size(),
              String.join(", ", names),
              String.join(", ", macs)));
    }
    return ports;
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
    JsonObject result = object(envelope, "result");
    String token = string(result, "accessToken");
    if (token == null || token.isBlank())
      throw new IOException("Omada token response has no accessToken");
    int expiresIn = intOr(result, "expiresIn", 7200);
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
    connection.setRequestProperty("User-Agent", "yamcs-omada-switch-link/1.0");
    if (token != null) connection.setRequestProperty("Authorization", "AccessToken=" + token);
    if (body != null) {
      connection.setRequestProperty("Content-Type", "application/json");
      connection.setDoOutput(true);
    }
    if (connection instanceof HttpsURLConnection https && insecureSslSocketFactory != null) {
      https.setSSLSocketFactory(insecureSslSocketFactory);
      https.setHostnameVerifier((hostname, session) -> true);
    }
    if (body != null) {
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
    return parseResponse(method, path, requestBody, statusCode, responseBytes);
  }

  private JsonObject parseResponse(
      String method, String path, byte[] requestBody, int statusCode, byte[] responseBytes)
      throws IOException {
    String responseBody = new String(responseBytes, StandardCharsets.UTF_8);
    dataOut(1, requestBody.length);
    dataIn(1, responseBytes.length);
    if (statusCode < 200 || statusCode >= 300) {
      throw new IOException("Omada returned HTTP " + statusCode + " for " + method + " " + path);
    }
    JsonObject json = GSON.fromJson(responseBody, JsonObject.class);
    if (json == null) throw new IOException("Omada returned an empty JSON response for " + path);
    return json;
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

  private static void requireSuccess(JsonObject envelope, String path) throws IOException {
    int code = errorCode(envelope);
    if (code != 0) {
      throw new IOException(
          "Omada API error " + code + " for " + path + ": " + orEmpty(string(envelope, "msg")));
    }
  }

  private static int errorCode(JsonObject envelope) {
    Integer code = integer(envelope, "errorCode");
    return code == null ? -1 : code;
  }

  private static JsonArray resultArray(JsonObject envelope) {
    JsonArray result = array(envelope, "result");
    return result == null ? new JsonArray() : result;
  }

  private static JsonObject findSwitch(JsonArray details, String switchMac) {
    for (JsonElement element : details) {
      JsonObject detail = element.getAsJsonObject();
      if (normalizeMac(orEmpty(string(detail, "mac"))).equals(normalizeMac(switchMac)))
        return detail;
    }
    return new JsonObject();
  }

  private void add(List<ParameterValue> values, long time, String name, Value value) {
    ParameterValue parameterValue = new ParameterValue(parameters.get(name));
    parameterValue.setGenerationTime(time);
    parameterValue.setAcquisitionTime(time);
    parameterValue.setEngValue(value);
    values.add(parameterValue);
  }

  private void addString(List<ParameterValue> values, long time, String name, String value) {
    add(values, time, name, ValueUtility.getStringValue(orEmpty(value)));
  }

  private void addUint32(List<ParameterValue> values, long time, String name, int value) {
    add(values, time, name, ValueUtility.getUint32Value(value));
  }

  private void addDouble(List<ParameterValue> values, long time, String name, double value) {
    add(values, time, name, ValueUtility.getDoubleValue(value));
  }

  private void addBoolean(List<ParameterValue> values, long time, String name, boolean value) {
    add(values, time, name, ValueUtility.getBooleanValue(value));
  }

  private void addEnumerated(
      List<ParameterValue> values, long time, String name, int value, String label) {
    add(values, time, name, ValueUtility.getEnumeratedValue(value, label));
  }

  private static JsonObject object(JsonObject parent, String name) {
    if (parent == null) return null;
    JsonElement value = parent.get(name);
    return value == null || !value.isJsonObject() ? null : value.getAsJsonObject();
  }

  private static JsonArray array(JsonObject parent, String name) {
    if (parent == null) return null;
    JsonElement value = parent.get(name);
    return value == null || !value.isJsonArray() ? null : value.getAsJsonArray();
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

  private static double doubleOr(JsonObject object, String name, double fallback) {
    if (object == null) return fallback;
    JsonElement value = object.get(name);
    return value == null || value.isJsonNull() ? fallback : value.getAsDouble();
  }

  private static boolean boolOr(JsonObject object, String name, boolean fallback) {
    if (object == null) return fallback;
    JsonElement value = object.get(name);
    return value == null || value.isJsonNull() ? fallback : value.getAsBoolean();
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

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  private static int argumentAsInt(PreparedCommand command, String name) throws IOException {
    for (Map.Entry<Argument, ArgumentValue> entry : command.getArgAssignment().entrySet()) {
      if (!entry.getKey().getName().equals(name)) continue;
      Value value = entry.getValue().getEngValue();
      if (value == null) value = entry.getValue().getRawValue();
      if (value != null) return Math.toIntExact(value.getSint64Value());
      break;
    }
    throw new IOException("Missing command argument " + name);
  }

  private static String poeModeLabel(int value) {
    return switch (value) {
      case 0 -> "OFF";
      case 1 -> "ON";
      default -> "UNKNOWN";
    };
  }

  private static String linkStatusLabel(int value) {
    return switch (value) {
      case 0 -> "DOWN";
      case 1 -> "UP";
      default -> "UNKNOWN";
    };
  }

  private static String connectedStatusLabel(int value) {
    return switch (value) {
      case 0 -> "CONNECTED";
      case 1 -> "DISCONNECTED";
      case 2 -> "DISABLED";
      default -> "UNKNOWN";
    };
  }

  private static String portTypeLabel(int value) {
    return switch (value) {
      case 1 -> "COPPER";
      case 2 -> "COMBO";
      case 3 -> "SFP";
      default -> "UNKNOWN";
    };
  }

  private static String linkSpeedLabel(int value) {
    return switch (value) {
      case 0 -> "AUTO";
      case 1 -> "10_MBPS";
      case 2 -> "100_MBPS";
      case 3 -> "1_GBPS";
      case 4 -> "10_GBPS";
      default -> "UNKNOWN";
    };
  }

  private static String duplexLabel(int value) {
    return switch (value) {
      case 0 -> "AUTO";
      case 1 -> "HALF";
      case 2 -> "FULL";
      default -> "UNKNOWN";
    };
  }

  private static String deviceStatusLabel(int value) {
    return switch (value) {
      case 0 -> "DISCONNECTED";
      case 1 -> "DISCONNECTED_MIGRATING";
      case 10 -> "PROVISIONING";
      case 11 -> "CONFIGURING";
      case 12 -> "UPGRADING";
      case 13 -> "REBOOTING";
      case 14 -> "CONNECTED";
      case 16 -> "CONNECTED_MIGRATING";
      case 20 -> "PENDING";
      case 22 -> "ADOPTING";
      case 24 -> "ADOPT_FAILED";
      case 26 -> "MANAGED_BY_OTHERS";
      case 30 -> "HEARTBEAT_MISSED";
      case 32 -> "HEARTBEAT_MISSED_MIGRATING";
      case 40 -> "ISOLATED";
      case 41 -> "ISOLATED_MIGRATING";
      case 50 -> "SLICE_CONFIGURING";
      default -> "UNKNOWN";
    };
  }

  record PortInfo(
      int port,
      String name,
      int type,
      int connectedStatus,
      int linkStatus,
      int linkSpeed,
      int duplex,
      boolean disabled,
      boolean supportPoe,
      int poeMode,
      boolean poeActive,
      double poeStatus,
      String pdClass,
      double power,
      double voltage,
      double current,
      int clientCount,
      String clientNames,
      String clientMacs) {
    static PortInfo unknown(int port) {
      return new PortInfo(
          port, "", -1, -1, -1, -1, -1, false, false, -1, false, -1, "", 0, 0, 0, 0, "", "");
    }
  }
}
