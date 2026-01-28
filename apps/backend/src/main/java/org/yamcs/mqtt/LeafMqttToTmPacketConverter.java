package org.yamcs.mqtt;

import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;

import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.TmPacket;
import org.yamcs.YConfiguration;
import org.yamcs.YamcsServer;
import org.yamcs.logging.Log;
import org.yamcs.time.Instant;
import org.yamcs.time.TimeService;
import org.yamcs.utils.TimeEncoding;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

/**
 * MQTT packet converter that works with LeafSpace ground stations.
 * <p>
 * Messages are JSON objects with two fields: <code>timestamp</code> and <code>payload</code>.
 * </p>
 * <p>
 * <code>timestamp</code> is UTC in ISO 8601 format and is used to set the Earth Reception Time (ERT).
 * </p>
 * <p>
 * <code>payload</code> is a string with the binary data encoded as a sequence of octets in hexadecimal.
 * </p>
 * <p>
 * Example:
 * </p>
 * 
 * <pre>
 * {"timestamp": "2024-08-12T22:23:28.430897", "payload": "0x47 0x1c 0xa 0x2"}
 * </pre>
 */

public class LeafMqttToTmPacketConverter implements MqttToTmPacketConverter {
    TimeService timeService;
    Log log;

    @Override
    public void init(String yamcsInstance, String linkName, YConfiguration config) {
        this.timeService = YamcsServer.getTimeService(yamcsInstance);
        this.log = new Log(this.getClass(), yamcsInstance);
    }

    @Override
    public List<TmPacket> convert(MqttMessage message) {
        try {
            var leafMsg = parseLeafMessage(message);
            var pkt = new TmPacket(timeService.getMissionTime(), leafMsg.data);
            pkt.setEarthReceptionTime(leafMsg.ert);
            return Collections.singletonList(pkt);
        } catch (Exception e) {
            log.warn("Cannot parse message {}: {}", message, e.toString());
            return Collections.emptyList();
        }
    }

    static LeafMessage parseLeafMessage(MqttMessage msg) {
        String jsonString = new String(msg.getPayload(), StandardCharsets.US_ASCII);

        JsonObject jsonObject = JsonParser.parseString(jsonString).getAsJsonObject();

        Instant ert = null;
        if (jsonObject.has("timestamp")) {
            var timestampString = jsonObject.get("timestamp").getAsString();
            ert = TimeEncoding.parseHres(timestampString);
        }

        if (!jsonObject.has("payload")) {
            throw new IllegalArgumentException("Message has no payload field");
        }

        var payloadString = jsonObject.get("payload").getAsString();
        byte[] data = parseHexString(payloadString);
        return new LeafMessage(ert, data);
    }

    static byte[] parseHexString(String hexString) {
        int n = 0;
        int length = hexString.length();
        // first count the bytes
        for (int i = 0; i < length - 1; i++) {
            if (hexString.charAt(i) == '0' && hexString.charAt(i + 1) == 'x') {
                n++;
                i += 2; // Skip "0x"
            }
        }

        // then parse the bytes
        byte[] byteArray = new byte[n];
        int idx = 0;
        for (int i = 0; i < length - 1; i++) {
            if (hexString.charAt(i) == '0' && hexString.charAt(i + 1) == 'x') {
                int start = i + 2;
                int end = start + 2;

                if (end > length || hexString.charAt(end - 1) == ' ') {
                    end = start + 1;
                }

                String hexByte = hexString.substring(start, end);
                byteArray[idx++] = (byte) Integer.parseInt(hexByte, 16);

                i = end - 1;
            }
        }

        return byteArray;
    }
    record LeafMessage(Instant ert, byte[] data) {
    }
}
