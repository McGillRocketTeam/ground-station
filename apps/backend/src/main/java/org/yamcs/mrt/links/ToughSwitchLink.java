package org.yamcs.mrt.links;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
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
import org.yamcs.tctm.AbstractParameterDataLink;
import org.yamcs.utils.ValueUtility;
import org.yamcs.xtce.Parameter;

public class ToughSwitchLink extends AbstractParameterDataLink {
  private static final int POLL_INTERVAL_SECONDS = 1;
  private static final int CONNECT_TIMEOUT_MILLIS = 5_000;
  private static final int READ_TIMEOUT_MILLIS = 5_000;
  private static final String USER_AGENT =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:152.0) Gecko/20100101 Firefox/152.0";
  private static final String PARAMETER_BASE = "/EGSE/Pad/ToughSwitch/";
  private static final Gson GSON = new Gson();

  private String ipAddress;
  private String username;
  private String password;
  private final Map<String, Parameter> parameters = new HashMap<>();
  private int sequenceNumber;
  private volatile Status status = Status.UNAVAIL;
  private volatile String detailedStatus = "Not started.";
  private volatile String sessionCookie;
  private ScheduledExecutorService executor;

  @Override
  public void init(String yamcsInstance, String linkName, YConfiguration config)
      throws ConfigurationException {
    super.init(yamcsInstance, linkName, config);
    ipAddress = config.getString("ipAddress");
    username = config.getString("username");
    password = config.getString("password");

    var mdb = MdbFactory.getInstance(yamcsInstance);
    for (String parameterName : parameterNames()) {
      Parameter parameter = mdb.getParameter(PARAMETER_BASE + parameterName);
      if (parameter == null) {
        throw new ConfigurationException(
            "MDB does not have ToughSwitch parameter " + PARAMETER_BASE + parameterName);
      }
      parameters.put(parameterName, parameter);
    }
  }

  @Override
  public Spec getSpec() {
    var spec = getDefaultSpec();
    spec.addOption("ipAddress", OptionType.STRING).withRequired(true);
    spec.addOption("username", OptionType.STRING).withRequired(true);
    spec.addOption("password", OptionType.STRING).withRequired(true);
    return spec;
  }

  @Override
  protected void collectSystemParameters(long time, List<ParameterValue> list) {
    super.collectSystemParameters(time, list);
  }

  @Override
  protected void doStart() {
    executor = Executors.newSingleThreadScheduledExecutor();
    executor.scheduleWithFixedDelay(
        this::refreshStatus, 0, POLL_INTERVAL_SECONDS, TimeUnit.SECONDS);
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

  private void refreshStatus() {
    try {
      if (sessionCookie == null) {
        login();
      }

      String encodedStats =
          request(
              "/stats?_=" + System.currentTimeMillis(),
              "GET",
              null,
              true,
              Map.of(
                  "Accept", "application/json, text/javascript, */*; q=0.01",
                  "X-Requested-With", "XMLHttpRequest",
                  "Referer", baseUrl() + "/index.cgi"));
      dataIn(1, encodedStats.length());

      String statsJson = decodeStatsBody(encodedStats);
      log.debug("ToughSwitch stats JSON from {}: {}", ipAddress, statsJson);
      publishStats(statsJson);

      status = Status.OK;
      detailedStatus = "Authenticated and polling ToughSwitch at " + ipAddress;
    } catch (Exception e) {
      sessionCookie = null;
      status = Status.FAILED;
      detailedStatus = "ToughSwitch poll failed for " + ipAddress + ": " + e.getMessage();
      log.warn(detailedStatus, e);
    }
  }

  private void login() throws Exception {
    bootstrapSessionCookie();

    if (sessionCookie == null || sessionCookie.isBlank()) {
      log.warn("ToughSwitch login page did not provide a session cookie; trying login POST anyway");
    }

    String boundary = "----yamcs-toughswitch-boundary" + System.currentTimeMillis();
    String body =
        "--"
            + boundary
            + "\r\n"
            + "Content-Disposition: form-data; name=\"uri\"\r\n\r\n"
            + " \r\n"
            + "--"
            + boundary
            + "\r\n"
            + "Content-Disposition: form-data; name=\"username\"\r\n\r\n"
            + username
            + "\r\n"
            + "--"
            + boundary
            + "\r\n"
            + "Content-Disposition: form-data; name=\"password\"\r\n\r\n"
            + password
            + "\r\n"
            + "--"
            + boundary
            + "--\r\n";

    try {
      loginPost("/login.cgi", body, boundary);
    } catch (IOException e) {
      log.warn("ToughSwitch login POST /login.cgi failed; trying POST /: {}", e.getMessage());
      loginPost("/", body, boundary);
    }

    if (sessionCookie == null || sessionCookie.isBlank()) {
      throw new IOException("ToughSwitch did not provide a session cookie");
    }
  }

  private void loginPost(String path, String body, String boundary) throws Exception {
    request(
        path,
        "POST",
        body,
        true,
        Map.of(
            "Accept",
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Cache-Control",
            "max-age=0",
            "Content-Type",
            "multipart/form-data; boundary=" + boundary,
            "Origin",
            baseUrl(),
            "Referer",
            baseUrl() + "/login.cgi",
            "Upgrade-Insecure-Requests",
            "1"));
  }

  private void bootstrapSessionCookie() {
    for (String path : List.of("/login.cgi", "/index.cgi", "/")) {
      try {
        request(
            path,
            "GET",
            null,
            false,
            Map.of(
                "Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Cache-Control", "max-age=0",
                "Referer", baseUrl() + path,
                "Upgrade-Insecure-Requests", "1"));
      } catch (IOException e) {
        log.warn("ToughSwitch session bootstrap {} failed: {}", path, e.getMessage());
      } catch (Exception e) {
        log.warn("ToughSwitch session bootstrap {} failed", path, e);
      }

      if (sessionCookie != null && !sessionCookie.isBlank()) {
        return;
      }
    }
  }

  private String request(
      String path, String method, String body, boolean includeCookie, Map<String, String> headers)
      throws Exception {
    URL url = new URL(baseUrl() + path);
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
    connection.setInstanceFollowRedirects(false);
    connection.setConnectTimeout(CONNECT_TIMEOUT_MILLIS);
    connection.setReadTimeout(READ_TIMEOUT_MILLIS);
    connection.setRequestMethod(method);
    connection.setRequestProperty("User-Agent", USER_AGENT);
    connection.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
    connection.setRequestProperty("Connection", "keep-alive");

    if (includeCookie && sessionCookie != null && !sessionCookie.isBlank()) {
      connection.setRequestProperty("Cookie", sessionCookie);
    }

    log.debug(
        "ToughSwitch request {} {} includeCookie={} hasSessionCookie={}",
        method,
        url,
        includeCookie,
        sessionCookie != null && !sessionCookie.isBlank());

    for (var entry : headers.entrySet()) {
      connection.setRequestProperty(entry.getKey(), entry.getValue());
    }

    if (body != null) {
      byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
      connection.setDoOutput(true);
      connection.setRequestProperty("Content-Length", String.valueOf(bytes.length));
      try (OutputStream output = connection.getOutputStream()) {
        output.write(bytes);
      }
    }

    int responseCode = connection.getResponseCode();
    String cookie = extractCookie(connection);
    log.debug(
        "ToughSwitch response {} {} -> HTTP {}, Set-Cookie={}",
        method,
        url,
        responseCode,
        cookie == null ? "<none>" : cookie);
    if (cookie != null && !cookie.isBlank()) {
      sessionCookie = cookie;
    }

    InputStream stream =
        responseCode >= HttpURLConnection.HTTP_BAD_REQUEST
            ? connection.getErrorStream()
            : connection.getInputStream();
    String responseBody = "";
    if (stream != null) {
      try (InputStream input = stream) {
        responseBody = new String(input.readAllBytes(), StandardCharsets.UTF_8);
      }
    }

    if (responseCode != HttpURLConnection.HTTP_OK
        && responseCode != HttpURLConnection.HTTP_MOVED_TEMP) {
      throw new IOException(
          "ToughSwitch returned HTTP "
              + responseCode
              + " for "
              + method
              + " "
              + url
              + ": "
              + responseBody);
    }

    return responseBody;
  }

  private String baseUrl() {
    return "http://" + ipAddress;
  }

  private void publishStats(String statsJson) {
    JsonObject root = GSON.fromJson(statsJson, JsonObject.class);
    long now = getCurrentTime();
    List<ParameterValue> values = new ArrayList<>();

    addString(values, now, "now", stringValue(root, "now"));
    addUint64(values, now, "uptime", longValue(root, "uptime"));

    JsonObject management = objectValue(root, "management");
    if (management != null) {
      addUint32(values, now, "management_up", longValue(management, "up"));
      addUint32(values, now, "management_speed", longValue(management, "speed"));
    }

    JsonObject stats = objectValue(root, "stats");
    if (stats != null) {
      for (int port = 1; port <= 8; port++) {
        JsonObject portStats = objectValue(stats, String.valueOf(port));
        if (portStats == null) {
          continue;
        }

        String prefix = "port" + port + "_";
        addUint32(values, now, prefix + "poe", longValue(portStats, "poe"));
        addUint32(values, now, prefix + "port_status", longValue(portStats, "portStatus"));
        addUint32(values, now, prefix + "port_speed", longValue(portStats, "portSpeed"));
        addUint32(values, now, prefix + "link_status", longValue(portStats, "linkStatus"));
        addUint32(values, now, prefix + "duplex", longValue(portStats, "duplex"));
        addUint32(values, now, prefix + "has_vlans", longValue(portStats, "hasVlans"));
        addString(values, now, prefix + "stp_state", stringValue(portStats, "stpState"));

        JsonObject counters = objectValue(portStats, "stats");
        if (counters != null) {
          addUint64(values, now, prefix + "tx_bytes", longValue(counters, "TxByte"));
          addUint64(values, now, prefix + "rx_good_bytes", longValue(counters, "RxGoodByte"));
        }
      }
    }

    if (!values.isEmpty()) {
      updateParameters(now, "toughswitch", sequenceNumber++, values);
    }
  }

  private void addUint32(List<ParameterValue> values, long time, String name, Long value) {
    if (value == null) {
      return;
    }
    ParameterValue pv = new ParameterValue(parameters.get(name));
    pv.setGenerationTime(time);
    pv.setAcquisitionTime(time);
    pv.setEngValue(ValueUtility.getUint32Value(value.intValue()));
    values.add(pv);
  }

  private void addUint64(List<ParameterValue> values, long time, String name, Long value) {
    if (value == null) {
      return;
    }
    ParameterValue pv = new ParameterValue(parameters.get(name));
    pv.setGenerationTime(time);
    pv.setAcquisitionTime(time);
    pv.setEngValue(ValueUtility.getUint64Value(value));
    values.add(pv);
  }

  private void addString(List<ParameterValue> values, long time, String name, String value) {
    if (value == null) {
      return;
    }
    ParameterValue pv = new ParameterValue(parameters.get(name));
    pv.setGenerationTime(time);
    pv.setAcquisitionTime(time);
    pv.setEngValue(ValueUtility.getStringValue(value));
    values.add(pv);
  }

  private static JsonObject objectValue(JsonObject object, String name) {
    JsonElement value = object.get(name);
    return value == null || !value.isJsonObject() ? null : value.getAsJsonObject();
  }

  private static String stringValue(JsonObject object, String name) {
    JsonElement value = object.get(name);
    return value == null || value.isJsonNull() ? null : value.getAsString();
  }

  private static Long longValue(JsonObject object, String name) {
    JsonElement value = object.get(name);
    if (value == null || value.isJsonNull()) {
      return null;
    }
    if (value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()) {
      String stringValue = value.getAsString();
      return stringValue.isBlank() ? null : Long.parseLong(stringValue);
    }
    return value.getAsLong();
  }

  private static List<String> parameterNames() {
    List<String> names = new ArrayList<>();
    names.add("uptime");
    names.add("now");
    names.add("management_up");
    names.add("management_speed");
    for (int port = 1; port <= 8; port++) {
      String prefix = "port" + port + "_";
      names.add(prefix + "poe");
      names.add(prefix + "port_status");
      names.add(prefix + "port_speed");
      names.add(prefix + "link_status");
      names.add(prefix + "duplex");
      names.add(prefix + "has_vlans");
      names.add(prefix + "stp_state");
      names.add(prefix + "tx_bytes");
      names.add(prefix + "rx_good_bytes");
    }
    return names;
  }

  private static String decodeStatsBody(String body) {
    String trimmed = body.trim();
    if (trimmed.startsWith("{")) {
      return trimmed;
    }

    return new String(
        Base64.getDecoder().decode(stripDataUrlPrefix(trimmed)), StandardCharsets.UTF_8);
  }

  private static String stripDataUrlPrefix(String value) {
    String prefix = "data:application/octet-stream;base64,";
    return value.startsWith(prefix) ? value.substring(prefix.length()) : value;
  }

  private static String extractCookie(HttpURLConnection connection) {
    Map<String, List<String>> headers = connection.getHeaderFields();
    if (headers == null) {
      return null;
    }

    List<String> setCookies = headers.get("Set-Cookie");
    if (setCookies == null) {
      setCookies = headers.get("set-cookie");
    }
    if (setCookies == null) {
      return null;
    }

    StringBuilder builder = new StringBuilder();
    for (String value : setCookies) {
      if (value == null) {
        continue;
      }

      String cookie = value.split(";", 2)[0].trim();
      if (!cookie.isBlank()) {
        if (!builder.isEmpty()) {
          builder.append("; ");
        }
        builder.append(cookie);
      }
    }

    return builder.isEmpty() ? null : builder.toString();
  }
}
