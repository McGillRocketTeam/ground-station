package org.yamcs.mrt.links;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
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

public class WifiAntennaLink extends AbstractParameterDataLink {
  private static final int POLL_INTERVAL_SECONDS = 1;
  private static final int CONNECT_TIMEOUT_MILLIS = 5_000;
  private static final int READ_TIMEOUT_MILLIS = 5_000;
  private static final Gson GSON = new Gson();
  private static final List<ParameterBinding> PARAMETER_BINDINGS =
      List.of(
          string("wanConnType", "Wan/connection_type"),
          string("wanMacAddr", "Wan/mac_address"),
          string("wanIpAddress", "Wan/ip_address"),
          string("wanSubnetMask", "Wan/subnet_mask"),
          string("wanDefaultGateway", "Wan/default_gateway"),
          string("wanDnsServer", "Wan/dns_server"),
          string("wanIpv6Address", "Wan/ipv6_address"),
          string("wanIpv6DnsServer", "Wan/ipv6_dns_server"),
          string("wanIpv6DefaultGateway", "Wan/ipv6_default_gateway"),
          string("lanMacAddr", "Lan/mac_address"),
          string("lanIpAddress", "Lan/ip_address"),
          string("lanSubnetMask", "Lan/subnet_mask"),
          string("lanIpv6Address", "Lan/ipv6_address"),
          string("lanPort1", "Lan/port_1_status"),
          string("lanPort0", "Lan/port_0_status"),
          string("wanPort1", "Lan/wan_port_1_status"),
          string("sysTime", "DeviceInformation/system_time"),
          string("sysRunTime", "DeviceInformation/uptime"),
          uint32("memory", "DeviceInformation/memory_usage"),
          uint32("cpu", "DeviceInformation/cpu_usage"),
          string("deviceName", "DeviceInformation/device_name"),
          string("firmVersion", "DeviceInformation/firmware_version"),
          string("hardVersion", "DeviceInformation/hardware_version"),
          sint32("rssi", "WirelessSignalQuality/signal_strength"),
          sint32("noiseStrength", "WirelessSignalQuality/noise_strength"),
          sint32("snrProcess", "WirelessSignalQuality/snr"),
          uint32("transmitCcq", "WirelessSignalQuality/transmit_ccq"),
          string("tdma", "WirelessSettings/tdma"),
          uint32("region", "WirelessSettings/region_code"),
          string("channel", "WirelessSettings/channel"),
          string("channelWidth", "WirelessSettings/channel_width"),
          string("mode", "WirelessSettings/ieee80211_mode"),
          string("maxTxRate", "WirelessSettings/max_tx_rate"),
          uint32("antennaMode", "WirelessSettings/antenna_mode"),
          leadingDouble("txPower", "WirelessSettings/transmit_power"),
          leadingDouble("ackTimeout", "WirelessSettings/distance"),
          bool("enableSSID", "RadioStatus/ssid_broadcast_enabled"),
          bool("apEnable", "RadioStatus/access_point_enabled"),
          string("apMacAddr", "RadioStatus/access_point_mac_address"),
          string("apSsid", "RadioStatus/access_point_ssid"),
          string("apSecurity", "RadioStatus/access_point_security"),
          leadingUint32("apConnectedStations", "RadioStatus/connected_stations"),
          uint32("clientEnable", "RadioStatus/client_enabled"),
          string("clientMacAddr", "RadioStatus/client_mac_address"),
          string("clientSsid", "RadioStatus/client_ssid"),
          string("clientSecurity", "RadioStatus/client_security"),
          uint32("clientWds", "RadioStatus/client_wds"),
          string("rootApBssid", "RadioStatus/root_access_point_bssid"),
          string("rootApSsid", "RadioStatus/root_access_point_ssid"),
          string("clientTxRate", "RadioStatus/client_tx_rate"),
          string("clientRxRate", "RadioStatus/client_rx_rate"),
          string("clientConnTime", "RadioStatus/client_connection_time"));

  private String ipAddress;
  private String username;
  private String password;
  private final Map<String, Parameter> parameters = new HashMap<>();
  private volatile Status status = Status.UNAVAIL;
  private volatile String detailedStatus = "Not started.";
  private volatile String sessionCookie;
  private volatile boolean authenticationPermanentlyFailed;
  private volatile boolean hasConnectedOnce;
  private ScheduledExecutorService executor;
  private int sequenceNumber;

  @Override
  public void init(String yamcsInstance, String linkName, YConfiguration config)
      throws ConfigurationException {
    super.init(yamcsInstance, linkName, config);
    ipAddress = config.getString("ipAddress");
    username = config.getString("username");
    password = config.getString("password");

    var mdb = MdbFactory.getInstance(yamcsInstance);
    String parameterBase = "/" + linkName + "/";
    for (String parameterName : parameterNames()) {
      Parameter parameter = mdb.getParameter(parameterBase + parameterName);
      if (parameter == null) {
        throw new ConfigurationException(
            "MDB does not have WifiAntenna parameter " + parameterBase + parameterName);
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

  private void setStatus(Status newStatus) {
    status = newStatus;
  }

  private void refreshStatus() {
    try {
      if (authenticationPermanentlyFailed) {
        return;
      }

      if (!ensureAuthenticated()) {
        return;
      }

      ApiResponse<InfoResponse> pollResponse =
          request(
              "/data/info.json?autorefresh=true&_=" + System.currentTimeMillis(),
              "GET",
              null,
              true,
              InfoResponse.class,
              Map.of("X-Requested-With", "XMLHttpRequest"));

      dataIn(1, pollResponse.rawBody.length());

      if (Boolean.TRUE.equals(pollResponse.body.timeout)) {
        sessionCookie = null;
        setStatus(Status.UNAVAIL);
        detailedStatus = "Wifi antenna session timed out, reauthenticating";
        return;
      }

      publishInfo(pollResponse.body.data, getCurrentTime());

      hasConnectedOnce = true;
      setStatus(Status.OK);
      detailedStatus =
          "Authenticated and polling wifi antenna control plane at "
              + ipAddress
              + " (device "
              + nullSafe(stringValue(pollResponse.body.data, "deviceName"))
              + ")";
    } catch (Exception e) {
      sessionCookie = null;
      handlePollingFailure(e);
    }
  }

  void handlePollingFailure(Exception e) {
    if (e instanceof AuthenticationFailedException) {
      setStatus(Status.FAILED);
      authenticationPermanentlyFailed = true;
      detailedStatus =
          "Wifi antenna auth failed for "
              + ipAddress
              + "; refusing further login attempts until restart: "
              + e.getMessage();
      return;
    }

    if (hasConnectedOnce) {
      setStatus(Status.FAILED);
      detailedStatus = "Wifi antenna API poll failed for " + ipAddress + ": " + e.getMessage();
      return;
    }

    setStatus(Status.UNAVAIL);
    detailedStatus =
        "Wifi antenna at "
            + ipAddress
            + " has not responded yet; continuing to poll: "
            + e.getMessage();
  }

  void markConnectedForTest() {
    hasConnectedOnce = true;
  }

  private boolean ensureAuthenticated() throws Exception {
    if (sessionCookie == null) {
      bootstrapSession();
      authenticate();
      return true;
    }

    ApiResponse<VersionResponse> versionResponse =
        request("/data/version.json", "GET", null, true, VersionResponse.class, Map.of());

    if (!Boolean.TRUE.equals(versionResponse.body.timeout) && versionResponse.body.status != null) {
      if (versionResponse.body.status == 0) {
        return true;
      }

      setStatus(Status.FAILED);
      detailedStatus =
          "Wifi antenna authentication lost for "
              + ipAddress
              + " (status "
              + versionResponse.body.status
              + ")";
      sessionCookie = null;
    }

    bootstrapSession();
    authenticate();
    return true;
  }

  private void bootstrapSession() throws Exception {
    ApiResponse<VersionResponse> response =
        request("/data/version.json", "GET", null, false, VersionResponse.class, Map.of());

    if (response.cookie == null || response.cookie.isBlank()) {
      throw new IOException("Access point did not provide a session cookie");
    }

    sessionCookie = response.cookie;
  }

  private void authenticate() throws Exception {
    String nonce = sessionCookie;
    String passwordHash = md5Hex(password).toUpperCase(Locale.ROOT);
    String encodedHash = md5Hex(passwordHash + ":" + nonce).toUpperCase(Locale.ROOT);

    String form =
        "encoded=" + urlEncode(username + ":" + encodedHash) + "&nonce=" + urlEncode(nonce);

    ApiResponse<VersionResponse> response =
        request("/data/version.json", "POST", form, true, VersionResponse.class, Map.of());

    if (response.cookie != null && !response.cookie.isBlank()) {
      sessionCookie = response.cookie;
    }

    if (response.body.status == null) {
      throw new IOException("Access point login response did not include status");
    }

    if (response.body.status != 0) {
      throw new AuthenticationFailedException(
          "Access point rejected login for user "
              + username
              + " with status "
              + response.body.status
              + " and failedCount "
              + nullSafe(response.body.failedCount));
    }
  }

  private <T> ApiResponse<T> request(
      String path,
      String method,
      String formBody,
      boolean includeCookie,
      Class<T> responseType,
      Map<String, String> headers)
      throws Exception {
    URL url = new URL("http://" + ipAddress + path);
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
    connection.setConnectTimeout(CONNECT_TIMEOUT_MILLIS);
    connection.setReadTimeout(READ_TIMEOUT_MILLIS);
    connection.setRequestMethod(method);
    connection.setRequestProperty("Accept", "application/json, text/javascript, */*; q=0.01");
    connection.setRequestProperty("Referer", "http://" + ipAddress + "/");
    connection.setRequestProperty("User-Agent", "yamcs-wifi-antenna-link/1.0");

    if (includeCookie && sessionCookie != null && !sessionCookie.isBlank()) {
      connection.setRequestProperty("Cookie", "COOKIE=" + sessionCookie);
    }

    for (var entry : headers.entrySet()) {
      connection.setRequestProperty(entry.getKey(), entry.getValue());
    }

    if ("POST".equals(method)) {
      byte[] body = formBody.getBytes(StandardCharsets.UTF_8);
      connection.setDoOutput(true);
      connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
      connection.setRequestProperty("Content-Length", String.valueOf(body.length));
      try (OutputStream output = connection.getOutputStream()) {
        output.write(body);
      }
    }

    int responseCode = connection.getResponseCode();
    InputStream stream =
        responseCode >= HttpURLConnection.HTTP_BAD_REQUEST
            ? connection.getErrorStream()
            : connection.getInputStream();

    if (stream == null) {
      throw new IOException("Access point returned no response body");
    }

    String responseBody;
    try (InputStream input = stream) {
      responseBody = new String(input.readAllBytes(), StandardCharsets.UTF_8);
    }

    if (responseCode != HttpURLConnection.HTTP_OK) {
      throw new IOException("Access point returned HTTP " + responseCode + ": " + responseBody);
    }

    String cookie = extractCookie(connection);
    T parsed = GSON.fromJson(responseBody, responseType);
    if (parsed == null) {
      throw new IOException("Failed to parse access point response");
    }

    return new ApiResponse<>(parsed, cookie, responseBody);
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

    for (String value : setCookies) {
      if (value == null) {
        continue;
      }

      for (String segment : value.split(";")) {
        String trimmed = segment.trim();
        if (trimmed.startsWith("COOKIE=")) {
          return trimmed.substring("COOKIE=".length());
        }
      }
    }

    return null;
  }

  private static String md5Hex(String value) throws NoSuchAlgorithmException {
    MessageDigest digest = MessageDigest.getInstance("MD5");
    byte[] bytes = digest.digest(value.getBytes(StandardCharsets.US_ASCII));
    StringBuilder builder = new StringBuilder(bytes.length * 2);
    for (byte current : bytes) {
      builder.append(String.format(Locale.ROOT, "%02x", current));
    }
    return builder.toString();
  }

  private static String urlEncode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }

  private static String nullSafe(Object value) {
    return value == null ? "unknown" : String.valueOf(value);
  }

  private void publishInfo(JsonObject data, long time) {
    if (data == null) {
      return;
    }

    List<ParameterValue> values = new ArrayList<>();
    for (ParameterBinding binding : PARAMETER_BINDINGS) {
      JsonElement value = data.get(binding.jsonName());
      if (value == null || value.isJsonNull()) {
        continue;
      }

      switch (binding.kind()) {
        case STRING -> addString(values, time, binding.parameterName(), value.getAsString());
        case UINT32 -> addUint32(values, time, binding.parameterName(), value.getAsLong());
        case SINT32 -> addSint32(values, time, binding.parameterName(), value.getAsInt());
        case BOOLEAN -> addBoolean(values, time, binding.parameterName(), value.getAsBoolean());
        case LEADING_DOUBLE ->
            addDouble(
                values, time, binding.parameterName(), parseLeadingDouble(value.getAsString()));
        case LEADING_UINT32 ->
            addUint32(values, time, binding.parameterName(), parseLeadingLong(value.getAsString()));
      }
    }
    if (!values.isEmpty()) {
      updateParameters(time, "wifi-antenna", sequenceNumber++, values);
    }
  }

  private void addString(List<ParameterValue> values, long time, String name, String value) {
    addValue(values, time, name, ValueUtility.getStringValue(value));
  }

  private void addSint32(List<ParameterValue> values, long time, String name, Integer value) {
    addValue(values, time, name, ValueUtility.getSint32Value(value));
  }

  private void addBoolean(List<ParameterValue> values, long time, String name, Boolean value) {
    addValue(values, time, name, ValueUtility.getBooleanValue(value));
  }

  private void addDouble(List<ParameterValue> values, long time, String name, Double value) {
    if (value == null) {
      return;
    }

    addValue(values, time, name, ValueUtility.getDoubleValue(value));
  }

  private void addUint32(List<ParameterValue> values, long time, String name, Long value) {
    if (value == null) {
      return;
    }

    addValue(values, time, name, ValueUtility.getUint32Value(value.intValue()));
  }

  private void addValue(List<ParameterValue> values, long time, String name, Value value) {
    ParameterValue pv = new ParameterValue(parameters.get(name));
    pv.setGenerationTime(time);
    pv.setAcquisitionTime(time);
    pv.setEngValue(value);
    values.add(pv);
  }

  private static List<String> parameterNames() {
    return PARAMETER_BINDINGS.stream().map(ParameterBinding::parameterName).toList();
  }

  private static String stringValue(JsonObject object, String name) {
    if (object == null) {
      return null;
    }
    JsonElement value = object.get(name);
    return value == null || value.isJsonNull() ? null : value.getAsString();
  }

  private static Double parseLeadingDouble(String value) {
    if (value == null) {
      return null;
    }

    StringBuilder builder = new StringBuilder();
    boolean seenDigit = false;
    for (int i = 0; i < value.length(); i++) {
      char current = value.charAt(i);
      if ((current >= '0' && current <= '9')
          || current == '.'
          || (current == '-' && builder.isEmpty())) {
        builder.append(current);
        if (current >= '0' && current <= '9') {
          seenDigit = true;
        }
      } else if (seenDigit) {
        break;
      }
    }

    if (!seenDigit) {
      return null;
    }

    return Double.parseDouble(builder.toString());
  }

  private static Long parseLeadingLong(String value) {
    Double parsed = parseLeadingDouble(value);
    return parsed == null ? null : parsed.longValue();
  }

  private static ParameterBinding string(String jsonName, String parameterName) {
    return new ParameterBinding(jsonName, parameterName, ParameterKind.STRING);
  }

  private static ParameterBinding uint32(String jsonName, String parameterName) {
    return new ParameterBinding(jsonName, parameterName, ParameterKind.UINT32);
  }

  private static ParameterBinding sint32(String jsonName, String parameterName) {
    return new ParameterBinding(jsonName, parameterName, ParameterKind.SINT32);
  }

  private static ParameterBinding bool(String jsonName, String parameterName) {
    return new ParameterBinding(jsonName, parameterName, ParameterKind.BOOLEAN);
  }

  private static ParameterBinding leadingDouble(String jsonName, String parameterName) {
    return new ParameterBinding(jsonName, parameterName, ParameterKind.LEADING_DOUBLE);
  }

  private static ParameterBinding leadingUint32(String jsonName, String parameterName) {
    return new ParameterBinding(jsonName, parameterName, ParameterKind.LEADING_UINT32);
  }

  private enum ParameterKind {
    STRING,
    UINT32,
    SINT32,
    BOOLEAN,
    LEADING_DOUBLE,
    LEADING_UINT32
  }

  private record ParameterBinding(String jsonName, String parameterName, ParameterKind kind) {}

  private static final class AuthenticationFailedException extends IOException {
    AuthenticationFailedException(String message) {
      super(message);
    }
  }

  private record ApiResponse<T>(T body, String cookie, String rawBody) {}

  private static final class VersionResponse {
    Boolean timeout;
    Integer status;
    Integer failedCount;
  }

  private static final class InfoResponse {
    Boolean timeout;

    JsonObject data;
  }
}
