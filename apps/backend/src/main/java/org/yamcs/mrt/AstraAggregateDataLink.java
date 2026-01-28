package org.yamcs.mrt;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.eclipse.paho.client.mqttv3.*;
import org.yamcs.*;
import org.yamcs.management.LinkManager;
import org.yamcs.mrt.astra.*;
import org.yamcs.tctm.*;
import com.google.common.util.concurrent.Service;

import com.google.gson.*;

/**
 * AstraDataLink is an aggregate YAMCS link that dynamically discovers and
 * manages radio devices communicating over MQTT. Devices are added when a valid
 * retained metadata JSON message is published and automatically removed when
 * their metadata is cleared (e.g., via MQTT Last Will). Telemetry from active
 * devices is forwarded to their corresponding sublinks.
 *
 * @author Léo Mindlin
 */
public class AstraAggregateDataLink extends AbstractLink implements AggregatedDataLink {

	private final Map<String, AstraSubLink> subLinksMap = new ConcurrentHashMap<>();
	private final List<Link> subLinks = Collections.synchronizedList(new ArrayList<>());

	private String instance;
	private String name;
	private YConfiguration config;
	private String detailedStatus;

	private MqttAsyncClient client;
	private MqttConnectOptions connOpts;

	// Gson parser for JSON validation
	// private static final Gson gson = new Gson();

	@Override
	public void init(String instance, String name, YConfiguration config)
			throws ConfigurationException {
		super.init(instance, name, config);
		this.instance = instance;
		this.name = name;
		this.config = config;
		this.detailedStatus = "Not started.";
		this.connOpts = MqttUtils.getConnectionOptions(config);
		this.client = MqttUtils.newClient(config);
	}

	@Override
	public Spec getSpec() {
		var spec = getDefaultSpec();
		MqttUtils.addConnectionOptionsToSpec(spec);
		return spec;
	}

	@Override
	protected void doStart() {
		try {
			client.setCallback(new MqttCallback() {
				@Override
				public void connectionLost(Throwable cause) {

					eventProducer.sendWarning(
							"MQTT connection lost: " + cause.getMessage());
				}

				@Override
				public void messageArrived(String topic, MqttMessage message) {
					handleMessage(topic, message);
				}

				@Override
				public void deliveryComplete(IMqttDeliveryToken token) {
				}
			});

			client.connect(connOpts).waitForCompletion();
			client.subscribe("#", 0).waitForCompletion();

			detailedStatus = "Connected to MQTT broker, listening for devices";
			eventProducer.sendInfo(detailedStatus);
			notifyStarted();

		} catch (Exception e) {
			detailedStatus = "Failed to start AstraDataLink: " + e.getMessage();
			eventProducer.sendWarning(detailedStatus);
			notifyFailed(e);
		}
	}

	/** Handle MQTT message logic for metadata/telemetry and device lifecycle. */
	private void handleMessage(String topic, MqttMessage message) {
		try {
			String[] parts = topic.split("/");
			if (parts.length < 2)
				return;

			String deviceName = parts[0]; // e.g., radio-pad-a
			String subTopic = parts[1]; // metadata or telemetry

			if ("metadata".equalsIgnoreCase(subTopic)) {
				handleMetadata(deviceName, message);
			} else if ("telemetry".equalsIgnoreCase(subTopic)) {
				handleTelemetry(deviceName, message);
			}
		} catch (Exception e) {
			eventProducer.sendWarning(
					"Error handling message on topic " + topic + ": " + e.getMessage());
		}
	}

	private void handleMetadata(String deviceName, MqttMessage message) {
		byte[] payload = message.getPayload();
		log.info(message.toString());
		if (payload == null || payload.length == 0) {
			// Retained empty payload means device gone (Last Will)
			removeDevice(deviceName);
			return;
		}

		if (!isValidMetadataJson(payload)) {
			eventProducer.sendWarning("Invalid metadata JSON from " + deviceName);
			return;
		}

		subLinksMap.computeIfAbsent(deviceName, dn -> {
			eventProducer.sendInfo("Discovered new radio device: " + dn);
			return createSubLinkForDevice(dn);
		});

		try {
			String jsonString = new String(payload, StandardCharsets.UTF_8);
			JsonObject jsonObject = JsonParser.parseString(jsonString).getAsJsonObject();

			String status = jsonObject.has("status") && !jsonObject.get("status").isJsonNull()
					? jsonObject.get("status").getAsString()
					: "unknown";

			String longStatus = jsonObject.has("long_status") && !jsonObject.get("long_status").isJsonNull()
					? jsonObject.get("long_status").getAsString()
					: "unknown";

			// You might also want to store or propagate these values somewhere
			AstraSubLink link = subLinksMap.get(deviceName);
			if (link != null) {
				link.setDetailedStatus(longStatus);
				link.setStatus(status);
			}

		} catch (Exception e) {
			eventProducer.sendWarning("Error parsing metadata JSON for " + deviceName + ": " + e.getMessage());
		}

	}

	private void handleTelemetry(String deviceName, MqttMessage message) {
		AstraSubLink link = subLinksMap.get(deviceName);
		if (link != null) {
			link.handleMqttMessage(message);
		}
	}

	/** Validate the metadata JSON structure using Gson. */
	private boolean isValidMetadataJson(byte[] payload) {
		try {
			String jsonString = new String(payload, StandardCharsets.UTF_8);
			JsonElement parsed = JsonParser.parseString(jsonString);
			if (!parsed.isJsonObject())
				return false;

			JsonObject obj = parsed.getAsJsonObject();

			return obj.has("frequency") && obj.has("status") && obj.has("long_status");
		} catch (Exception e) {
			return false;
		}
	}

	/** Removes the sublink corresponding to a device that cleared metadata. */
	private void removeDevice(String deviceName) {
		AstraSubLink link = subLinksMap.remove(deviceName);
		if (link != null) {
			try {
				((Service) link).stopAsync();

				LinkManager linkManager = YamcsServer.getServer().getInstance(instance).getLinkManager();
				linkManager.configureDataLink(this, config);

				linkManager.disableLink(link.getName());

				eventProducer.sendInfo("Removed device " + deviceName + " (metadata cleared)");
			} catch (Exception e) {
				eventProducer.sendWarning(
						"Failed to remove device " + deviceName + ": " + e.getMessage());
			}
		}
	}

	/** Creates and registers a new device sublink. */
	private AstraSubLink createSubLinkForDevice(String device) {

		try {
			String deviceType = device.split("-")[0];

			// Implement more types of links here!
			AstraSubLink link = switch (deviceType) {
				case "radio" -> new RadiosLink();
				default -> throw new IllegalArgumentException("Unknown device type: " + deviceType);
			};

			String linkName = this.name + "/" + device;
			link.init(instance, linkName, config);
			link.setParent(this);
			subLinks.add(link);

			LinkManager linkManager = YamcsServer.getServer().getInstance(instance).getLinkManager();
			linkManager.configureDataLink(link, config);

			return link;
		} catch (IllegalArgumentException e) {
			// This will happen for unknown device types
			eventProducer.sendWarning("Unsupported device type in: " + device);
			return null;
		} catch (IndexOutOfBoundsException e) {
			eventProducer.sendWarning("Invalid device name \"" + device + "\". Could not identify device type.");
			return null;
		}

	}

	@Override
	protected void doStop() {
		try {
			client.disconnect().waitForCompletion();
		} catch (Exception e) {
			eventProducer.sendWarning("Error disconnecting MQTT: " + e.getMessage());
		}
		notifyStopped();
	}

	@Override
	public List<Link> getSubLinks() {
		return subLinks;
	}

	@Override
	protected Status connectionStatus() {
		return client.isConnected() ? Status.OK : Status.UNAVAIL;
	}

	@Override
	public String getDetailedStatus() {
		return detailedStatus;
	}
}
