package org.yamcs.mqtt;

import java.util.concurrent.TimeUnit;

import org.eclipse.paho.client.mqttv3.IMqttActionListener;
import org.eclipse.paho.client.mqttv3.IMqttToken;
import org.eclipse.paho.client.mqttv3.MqttAsyncClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.yamcs.Spec;
import org.yamcs.Spec.OptionType;
import org.yamcs.YConfiguration;
import org.yamcs.tctm.ccsds.AbstractTcFrameLink;
import org.yamcs.tctm.ccsds.TcTransferFrame;
import org.yamcs.utils.StringConverter;
import org.yamcs.utils.YObjectLoader;

import com.google.common.util.concurrent.RateLimiter;

/**
 * Sends TC as TC frames (CCSDS 232.0-B-3) or TC frames embedded in CLTU (CCSDS 231.0-B-3).
 * <p>
 * This class implements rate limiting. args:
 * <ul>
 * <li>frameMaxRate: maximum number of command frames to send per second.</li>
 * </ul>
 *
 */
public class MqttTcFrameLink extends AbstractTcFrameLink implements Runnable {
    RateLimiter rateLimiter;
    MqttConnectOptions connOpts;
    MqttAsyncClient client;
    String topic;
    Thread thread;

    FrameToMqttConverter converter;

    @Override
    public Spec getSpec() {
        var spec = getDefaultSpec();
        MqttUtils.addConnectionOptionsToSpec(spec);
        spec.addOption("frameMaxRate", OptionType.FLOAT);
        spec.addOption("topic", OptionType.STRING).withRequired(true);
        spec.addOption("converterClassName", OptionType.STRING)
                .withDefault(DefaultFrameToMqttConverter.class.getName());
        spec.addOption("converterArgs", OptionType.MAP).withRequired(false);

        return spec;
    }

    @Override
    public void init(String yamcsInstance, String name, YConfiguration config) {
        super.init(yamcsInstance, name, config);
        connOpts = MqttUtils.getConnectionOptions(config);
        topic = config.getString("topic");
        if (config.containsKey("frameMaxRate")) {
            rateLimiter = RateLimiter.create(config.getDouble("frameMaxRate"), 1, TimeUnit.SECONDS);
        }
        converter = YObjectLoader.loadObject(config.getString("converterClassName"));
        converter.init(yamcsInstance, linkName, config.getConfigOrEmpty("converterArgs"));
        client = MqttUtils.newClient(config);
    }

    @Override
    public void run() {
        while (isRunningAndEnabled()) {
            if (rateLimiter != null) {
                rateLimiter.acquire();
            }
            TcTransferFrame tf = multiplexer.getFrame();
            if (tf != null) {
                byte[] data = tf.getData();
                if (log.isTraceEnabled()) {
                    log.trace("Outgoing frame data: {}", StringConverter.arrayToHexString(data, true));
                }

                if (cltuGenerator != null) {
                    data = encodeCltu(tf.getVirtualChannelId(), data);

                    if (log.isTraceEnabled()) {
                        log.trace("Outgoing CLTU: {}", StringConverter.arrayToHexString(data, true));
                    }
                }
                try {
                    var msg = converter.convert(data);
                    client.publish(topic, null, msg, new IMqttActionListener() {
                        @Override
                        public void onSuccess(IMqttToken asyncActionToken) {
                            if (tf.isBypass()) {
                                ackBypassFrame(tf);
                            }
                        }

                        @Override
                        public void onFailure(IMqttToken asyncActionToken, Throwable e) {
                            log.warn("Failed to send command {}", e);
                            failBypassFrame(tf, e.getMessage());
                        }
                    });
                    dataOut(1, data.length);

                } catch (MqttException e) {
                    log.warn("Failed to send command frame {}", e);
                    if (tf.isBypass()) {
                        failBypassFrame(tf, e.getMessage());
                    }
                }
                frameCount++;
            }
        }
    }

    @Override
    protected void doDisable() throws Exception {
        if (thread != null) {
            thread.interrupt();
        }
        MqttUtils.doDisable(client);
    }

    @Override
    protected void doEnable() throws Exception {
        MqttUtils.connect(connOpts, client, log, eventProducer);
        thread = new Thread(this);
        thread.setName(getClass().getSimpleName() + "-" + linkName);
        thread.start();
    }

    @Override
    protected void doStart() {
        if (isDisabled()) {
            notifyStarted();
        } else {
            try {
                doEnable();
                notifyStarted();
            } catch (Exception e) {
                log.warn("Exception starting link", e);
                notifyFailed(e);
            }
        }
    }

    @Override
    protected void doStop() {
        MqttUtils.doStop(client, this::notifyStopped, this::notifyFailed);
    }

    @Override
    protected Status connectionStatus() {
        if (client.isConnected()) {
            return Status.OK;
        } else {
            return Status.UNAVAIL;
        }
    }
}
