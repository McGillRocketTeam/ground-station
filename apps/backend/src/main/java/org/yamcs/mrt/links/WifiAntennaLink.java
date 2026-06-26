package org.yamcs.mrt.links;

import static org.yamcs.parameter.SystemParametersService.getPV;

import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.yamcs.parameter.ParameterValue;
import org.yamcs.parameter.SystemParametersService;
import org.yamcs.protobuf.Yamcs.Value.Type;
import org.yamcs.ConfigurationException;
import org.yamcs.Spec;
import org.yamcs.Spec.OptionType;
import org.yamcs.YConfiguration;
import org.yamcs.tctm.AbstractLink;
import org.yamcs.xtce.Parameter;
import org.yamcs.xtce.UnitType;

public class WifiAntennaLink extends AbstractLink {
  private static final int POLL_INTERVAL_SECONDS = 1;
  private static final int CONNECT_TIMEOUT_MILLIS = 5_000;
  private static final int READ_TIMEOUT_MILLIS = 5_000;
  private static final Gson GSON = new Gson();

  private String ipAddress;
  private String username;
  private String password;
  private volatile Status status = Status.UNAVAIL;
  private volatile String detailedStatus = "Not started.";
  private volatile String sessionCookie;
  private volatile boolean authenticationPermanentlyFailed;
  private volatile Double distanceKm;
  private volatile Double transmitPowerDbm;
  private volatile Long apConnectedStations;
  private ScheduledExecutorService executor;
  private Parameter distanceParameter;
  private Parameter transmitPowerParameter;
  private Parameter apConnectedStationsParameter;

  @Override
  public void init(String yamcsInstance, String linkName, YConfiguration config)
      throws ConfigurationException {
    super.init(yamcsInstance, linkName, config);
    ipAddress = config.getString("ipAddress");
    username = config.getString("username");
    password = config.getString("password");
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
  public void setupSystemParameters(SystemParametersService sysParamService) {
    super.setupSystemParameters(sysParamService);

    distanceParameter =
        sysParamService.createSystemParameter(
            LINK_NAMESPACE + linkName + "/Distance",
            Type.DOUBLE,
            new UnitType("km"),
            "Wifi antenna distance parsed from ack timeout");
    transmitPowerParameter =
        sysParamService.createSystemParameter(
            LINK_NAMESPACE + linkName + "/Transmit Power",
            Type.DOUBLE,
            new UnitType("dBm"),
            "Wifi antenna transmit power");
    apConnectedStationsParameter =
        sysParamService.createSystemParameter(
            LINK_NAMESPACE + linkName + "/Connected Stations",
            Type.UINT32,
            "Number of stations connected to the wifi antenna access point");
  }

  @Override
  protected void collectSystemParameters(long time, List<ParameterValue> list) {
    super.collectSystemParameters(time, list);

    if (distanceKm != null) {
      list.add(getPV(distanceParameter, time, distanceKm));
    }
    if (transmitPowerDbm != null) {
      list.add(getPV(transmitPowerParameter, time, transmitPowerDbm));
    }
    if (apConnectedStations != null) {
      list.add(getPV(apConnectedStationsParameter, time, apConnectedStations));
    }
  }

  @Override
  protected void doStart() {
    executor = Executors.newSingleThreadScheduledExecutor();
    executor.scheduleWithFixedDelay(this::refreshStatus, 0, POLL_INTERVAL_SECONDS, TimeUnit.SECONDS);
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
    if (newStatus != Status.OK) {
      apConnectedStations = 0L;
    }
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

      updateMetrics(pollResponse.body.data);

      setStatus(Status.OK);
      detailedStatus =
          "Authenticated and polling wifi antenna control plane at "
              + ipAddress
              + " (device "
              + nullSafe(pollResponse.body.data == null ? null : pollResponse.body.data.deviceName)
              + ")";
    } catch (Exception e) {
      sessionCookie = null;
      setStatus(Status.FAILED);
      if (e instanceof AuthenticationFailedException) {
        authenticationPermanentlyFailed = true;
        detailedStatus =
            "Wifi antenna auth failed for "
                + ipAddress
                + "; refusing further login attempts until restart: "
                + e.getMessage();
      } else {
        detailedStatus = "Wifi antenna API poll failed for " + ipAddress + ": " + e.getMessage();
      }
    }
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
        "encoded="
            + urlEncode(username + ":" + encodedHash)
            + "&nonce="
            + urlEncode(nonce);

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
    InputStream stream = responseCode >= HttpURLConnection.HTTP_BAD_REQUEST
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

  private void updateMetrics(InfoDataResponse data) {
    if (data == null) {
      distanceKm = null;
      transmitPowerDbm = null;
      apConnectedStations = null;
      return;
    }

    distanceKm = parseLeadingDouble(data.ackTimeout);
    transmitPowerDbm = parseLeadingDouble(data.txPower);
    apConnectedStations = parseLeadingLong(data.apConnectedStations);
  }

  private static Double parseLeadingDouble(String value) {
    if (value == null) {
      return null;
    }

    StringBuilder builder = new StringBuilder();
    boolean seenDigit = false;
    for (int i = 0; i < value.length(); i++) {
      char current = value.charAt(i);
      if ((current >= '0' && current <= '9') || current == '.' || (current == '-' && builder.isEmpty())) {
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

  private static final class AuthenticationFailedException extends IOException {
    AuthenticationFailedException(String message) {
      super(message);
    }
  }

  private record ApiResponse<T>(T body, String cookie, String rawBody) {}

  private static final class VersionResponse {
    Boolean success;
    Boolean timeout;
    Integer status;
    Integer failedCount;
    Integer lockTime;
  }

  private static final class InfoResponse {
    Boolean success;
    Boolean timeout;

    InfoDataResponse data;
  }

  private static final class InfoDataResponse {
    String deviceName;
    String ackTimeout;
    String txPower;
    String apConnectedStations;
  }
}
