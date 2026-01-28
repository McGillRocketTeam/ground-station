package org.yamcs.mqtt;

import java.util.LinkedHashMap;
import java.util.Map;

import org.eclipse.paho.client.mqttv3.IMqttMessageListener;
import org.eclipse.paho.client.mqttv3.MqttAsyncClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.ConfigurationException;
import org.yamcs.Spec;
import org.yamcs.Spec.OptionType;
import org.yamcs.YConfiguration;
import org.yamcs.tctm.ccsds.AbstractTmFrameLink;
import org.yamcs.utils.StringConverter;
import org.yamcs.utils.YObjectLoader;

/**
 * Receives telemetry fames via MQTT. One MQTT message = one TM frame.
 */
public class MqttTmFrameLink extends AbstractTmFrameLink implements IMqttMessageListener {
    MqttConnectOptions connOpts;
    MqttAsyncClient client;
    String topic;
    volatile Throwable subscriptionFailure;
    MqttToFrameConverter converter;

    @Override
    public Spec getSpec() {
        var spec = getDefaultSpec();
        MqttUtils.addConnectionOptionsToSpec(spec);
        spec.addOption("topic", OptionType.STRING).withRequired(true);
        spec.addOption("converterClassName", OptionType.STRING)
                .withDefault(DefaultMqttToFrameConverter.class.getName());
        spec.addOption("converterArgs", OptionType.MAP).withRequired(false);

        return spec;
    }

    /**
     * Creates a new UDP Frame Data Link
     * 
     * @throws ConfigurationException
     *             if port is not defined in the configuration
     */
    @Override
    public void init(String instance, String name, YConfiguration config) throws ConfigurationException {
        super.init(instance, name, config);
        connOpts = MqttUtils.getConnectionOptions(config);
        topic = config.getString("topic");
        converter = YObjectLoader.loadObject(config.getString("converterClassName"));
        converter.init(yamcsInstance, linkName, config.getConfigOrEmpty("converterArgs"));

        client = MqttUtils.newClient(config);
    }

    @Override
    protected void doStart() {
        if (isDisabled()) {
            notifyStarted();
        } else {
            try {
                doConnect();
                notifyStarted();
            } catch (MqttException e) {
                notifyFailed(e);
            }
        }
    }

    private void doConnect() throws MqttException {
        subscriptionFailure = null;
        MqttUtils.connectAndSubscribe(connOpts, client, this, topic, log, eventProducer, e -> subscriptionFailure = e);
    }

    @Override
    protected void doStop() {
        MqttUtils.doStop(client, this::notifyStopped, this::notifyFailed);
    }

    /**
     * Called by the MQTT client when a message is received
     */
    @Override
    public void messageArrived(String topic, MqttMessage message) {
        try {

            if (log.isTraceEnabled()) {
                log.trace("Received frame of length {}: {}", message.getPayload().length,
                        StringConverter.arrayToHexString(message.getPayload(), true));
            }
            for (var frame : converter.convert(message)) {
                dataIn(1, frame.data().length);
                handleFrame(frame.ert(), frame.data(), 0, frame.data().length);
            }

        } catch (Exception e) {
            log.error("Error processing frame", e);
        }
    }

    @Override
    public Map<String, Object> getExtraInfo() {
        var extra = new LinkedHashMap<String, Object>();
        extra.put("Valid frames", validFrameCount.get());
        extra.put("Invalid frames", invalidFrameCount.get());
        return extra;
    }

    @Override
    protected void doDisable() throws Exception {
        MqttUtils.doDisable(client);
    }

    @Override
    protected void doEnable() throws Exception {
        doConnect();
    }

    @Override
    protected Status connectionStatus() {
        if (client.isConnected() && subscriptionFailure == null) {
            return Status.OK;
        } else {
            return Status.UNAVAIL;
        }
    }
}
