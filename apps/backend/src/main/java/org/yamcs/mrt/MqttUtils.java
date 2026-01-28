package org.yamcs.mrt;

import java.util.Arrays;
import java.util.List;

import org.eclipse.paho.client.mqttv3.IMqttActionListener;
import org.eclipse.paho.client.mqttv3.IMqttMessageListener;
import org.eclipse.paho.client.mqttv3.IMqttToken;
import org.eclipse.paho.client.mqttv3.MqttAsyncClient;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.yamcs.ConfigurationException;
import org.yamcs.Spec;
import org.yamcs.YConfiguration;
import org.yamcs.events.EventProducer;
import org.yamcs.logging.Log;
import org.yamcs.Spec.OptionType;

/**
 * A set of utilities used by the MQTT packet and frame links to avoid code
 * duplication
 */
public class MqttUtils {

	/**
	 * create a new MQTT async client with the clientId and initial broker loaded
	 * from the config object
	 */
	static MqttAsyncClient newClient(YConfiguration config) throws ConfigurationException {
		try {
			List<String> brokers = config.getList("brokers");
			String clientId = config.getString("clientId", MqttClient.generateClientId());

			return new MqttAsyncClient(brokers.get(0), clientId);
		} catch (MqttException e) {
			throw new ConfigurationException(e);
		}
	}

	static MqttConnectOptions getConnectionOptions(YConfiguration config) {
		MqttConnectOptions connOpts = new MqttConnectOptions();

		connOpts.setAutomaticReconnect(config.getBoolean("autoReconnect"));
		List<String> brokers = config.getList("brokers");
		connOpts.setServerURIs(brokers.toArray(new String[0]));
		if (config.containsKey("username")) {
			connOpts.setUserName(config.getString("username"));
			connOpts.setPassword(config.getString("password").toCharArray());
		}
		connOpts.setConnectionTimeout(config.getInt("connectionTimeoutSecs"));
		connOpts.setKeepAliveInterval(config.getInt("keepAliveSecs"));
		connOpts.setCleanSession(true);

		return connOpts;
	}

	static void addConnectionOptionsToSpec(Spec spec) {
		spec.addOption("brokers", OptionType.LIST).withElementType(OptionType.STRING).withRequired(true);
		spec.addOption("username", OptionType.STRING).withRequired(false);
		spec.addOption("password", OptionType.STRING).withRequired(false);
		spec.addOption("clientId", OptionType.STRING).withRequired(false);

		spec.addOption("connectionTimeoutSecs", OptionType.INTEGER).withDefault(5);
		spec.addOption("autoReconnect", OptionType.BOOLEAN).withRequired(false).withDefault(true);
		spec.addOption("keepAliveSecs", OptionType.INTEGER).withDefault(60);
		spec.requireTogether("username", "password");
	}

	/**
	 * Connect to MQTT
	 */
	static void connect(MqttConnectOptions connOpts, MqttAsyncClient client, Log log, EventProducer eventProducer)
			throws MqttException {
		log.info("Connecting to MQTT with clientId {} and options: {}", client.getClientId(), connOpts);

		client.connect(connOpts, null, new IMqttActionListener() {
			@Override
			public void onSuccess(IMqttToken token) {
				log.info("Succesfully connected to MQTT");

			}

			@Override
			public void onFailure(IMqttToken t, Throwable e) {
				String msg = "Failed to connect to MQTT with clientId " + client.getClientId() + ": " + e.getMessage();
				eventProducer.sendWarning(msg);
				log.warn("{}", msg);
			}
		});
	}

	/**
	 * Connect MQTT and subscribe to a given topic
	 */
	static void connectAndSubscribe(MqttConnectOptions connOpts, MqttAsyncClient client,
			IMqttMessageListener messageListener, String topic, Log log, EventProducer eventProducer,
			SubscriptionFailureCallback subscriptionFailureCallback)
			throws MqttException {
		log.info("Connecting to MQTT with clientId {} and options: {}", client.getClientId(), connOpts);

		client.connect(connOpts, null, new IMqttActionListener() {
			@Override
			public void onSuccess(IMqttToken token) {
				log.info("Succesfully connected to MQTT");
				try {
					client.subscribe(topic, 2, messageListener).setActionCallback(new IMqttActionListener() {
						@Override
						public void onSuccess(IMqttToken t) {
							int[] granted = t.getGrantedQos();
							if (granted.length != 1 || granted[0] > 2) {
								String msg = "Subscription to " + topic + " failed; granted QoS: "
										+ Arrays.asList(granted);
								eventProducer.sendWarning(msg);
								subscriptionFailureCallback.setSubscriptionFailure(new Exception(msg));
							} else {
								log.info("Succesfully subscribed to {}", topic);
							}
						}

						@Override
						public void onFailure(IMqttToken t, Throwable e) {
							String msg = "Subscription to " + topic + " failed: " + e.getMessage();
							eventProducer.sendWarning(msg);
							log.warn("{}", msg);
							subscriptionFailureCallback.setSubscriptionFailure(e);
						}

					});
				} catch (MqttException e) {
					subscriptionFailureCallback.setSubscriptionFailure(e);
				}
			}

			@Override
			public void onFailure(IMqttToken t, Throwable e) {
				String msg = "Failed to connect to MQTT with clientId " + client.getClientId() + ": " + e.getMessage();
				eventProducer.sendWarning(msg);
				log.warn("{}", msg);
			}
		});
	}

	public static void doDisable(MqttAsyncClient client) throws MqttException {
		if (client.isConnected()) {
			client.disconnect();
		}
	}

	public static void doStop(MqttAsyncClient client, NotifyStoppedCallback stopCb, NotifyFailedCallback failCb) {
		try {
			if (client.isConnected()) {
				client.disconnect(null,
						new IMqttActionListener() {
							@Override
							public void onSuccess(IMqttToken t) {
								try {
									client.close();
									stopCb.notifyStopped();
								} catch (MqttException e) {
									failCb.notifyFailed(e);
								}
							}

							@Override
							public void onFailure(IMqttToken t, Throwable e) {
								failCb.notifyFailed(e);
							}
						});
			} else {
				client.disconnectForcibly(0, 0, false);
				client.close();
				stopCb.notifyStopped();
			}
		} catch (MqttException e) {
			failCb.notifyFailed(e);
		}
	}

	@FunctionalInterface
	public interface NotifyStoppedCallback {
		void notifyStopped();
	}

	@FunctionalInterface
	public interface NotifyFailedCallback {
		void notifyFailed(Throwable e);
	}

	@FunctionalInterface
	public interface SubscriptionFailureCallback {
		void setSubscriptionFailure(Throwable e);
	}
}
