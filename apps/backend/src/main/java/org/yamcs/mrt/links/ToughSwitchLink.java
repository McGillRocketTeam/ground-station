package org.yamcs.mrt.links;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import org.yamcs.ConfigurationException;
import org.yamcs.Spec;
import org.yamcs.Spec.OptionType;
import org.yamcs.YConfiguration;
import org.yamcs.parameter.ParameterValue;
import org.yamcs.tctm.AbstractLink;

public class ToughSwitchLink extends AbstractLink {
  private static final int POLL_INTERVAL_SECONDS = 1;
  private static final int CONNECT_TIMEOUT_MILLIS = 5_000;
  private static final int READ_TIMEOUT_MILLIS = 5_000;
  private static final String USER_AGENT =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:152.0) Gecko/20100101 Firefox/152.0";
  private static final HostnameVerifier TRUST_ALL_HOSTNAMES = (hostname, session) -> true;

  private String ipAddress;
  private String username;
  private String password;
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

  private void refreshStatus() {
    try {
      if (sessionCookie == null) {
        login();
      }

      String encodedStats = request(
          "/stats?_=" + System.currentTimeMillis(),
          "GET",
          null,
          true,
          Map.of(
              "Accept", "application/json, text/javascript, */*; q=0.01",
              "X-Requested-With", "XMLHttpRequest",
              "Referer", "https://" + ipAddress + "/index.cgi"));
      dataIn(1, encodedStats.length());

      String statsJson = new String(Base64.getDecoder().decode(encodedStats.trim()), StandardCharsets.UTF_8);
      log.info("ToughSwitch stats JSON from {}: {}", ipAddress, statsJson);

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
    String boundary = "----yamcs-toughswitch-boundary" + System.currentTimeMillis();
    String body = "--" + boundary + "\r\n"
        + "Content-Disposition: form-data; name=\"uri\"\r\n\r\n"
        + " \r\n"
        + "--" + boundary + "\r\n"
        + "Content-Disposition: form-data; name=\"username\"\r\n\r\n"
        + username + "\r\n"
        + "--" + boundary + "\r\n"
        + "Content-Disposition: form-data; name=\"password\"\r\n\r\n"
        + password + "\r\n"
        + "--" + boundary + "--\r\n";

    request(
        "/login.cgi",
        "POST",
        body,
        false,
        Map.of(
            "Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Content-Type", "multipart/form-data; boundary=" + boundary,
            "Origin", "https://" + ipAddress,
            "Referer", "https://" + ipAddress + "/login.cgi"));

    if (sessionCookie == null || sessionCookie.isBlank()) {
      throw new IOException("ToughSwitch did not provide a session cookie");
    }
  }

  private String request(
      String path,
      String method,
      String body,
      boolean includeCookie,
      Map<String, String> headers)
      throws Exception {
    URL url = new URL("https://" + ipAddress + path);
    HttpsURLConnection connection = (HttpsURLConnection) url.openConnection();
    connection.setSSLSocketFactory(tlsV1TrustAllContext().getSocketFactory());
    connection.setHostnameVerifier(TRUST_ALL_HOSTNAMES);
    connection.setConnectTimeout(CONNECT_TIMEOUT_MILLIS);
    connection.setReadTimeout(READ_TIMEOUT_MILLIS);
    connection.setRequestMethod(method);
    connection.setRequestProperty("User-Agent", USER_AGENT);
    connection.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
    connection.setRequestProperty("Connection", "keep-alive");

    if (includeCookie && sessionCookie != null && !sessionCookie.isBlank()) {
      connection.setRequestProperty("Cookie", sessionCookie);
    }

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
    if (cookie != null && !cookie.isBlank()) {
      sessionCookie = cookie;
    }

    InputStream stream = responseCode >= HttpURLConnection.HTTP_BAD_REQUEST
        ? connection.getErrorStream()
        : connection.getInputStream();
    String responseBody = "";
    if (stream != null) {
      try (InputStream input = stream) {
        responseBody = new String(input.readAllBytes(), StandardCharsets.UTF_8);
      }
    }

    if (responseCode != HttpURLConnection.HTTP_OK && responseCode != HttpURLConnection.HTTP_MOVED_TEMP) {
      throw new IOException("ToughSwitch returned HTTP " + responseCode + ": " + responseBody);
    }

    return responseBody;
  }

  private static SSLContext tlsV1TrustAllContext() throws Exception {
    TrustManager[] trustManagers = new TrustManager[] {
        new X509TrustManager() {
          @Override
          public void checkClientTrusted(X509Certificate[] chain, String authType) {}

          @Override
          public void checkServerTrusted(X509Certificate[] chain, String authType) {}

          @Override
          public X509Certificate[] getAcceptedIssuers() {
            return new X509Certificate[0];
          }
        }
    };
    SSLContext context = SSLContext.getInstance("TLSv1");
    context.init(null, trustManagers, new SecureRandom());
    return context;
  }

  private static String extractCookie(HttpsURLConnection connection) {
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
