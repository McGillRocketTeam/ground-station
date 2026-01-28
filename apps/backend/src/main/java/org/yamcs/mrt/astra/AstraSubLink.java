package org.yamcs.mrt.astra;

import java.util.HashMap;
import java.util.Map;

import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.yamcs.ConfigurationException;
import org.yamcs.YConfiguration;
import org.yamcs.tctm.AbstractTcTmParamLink;

public abstract class AstraSubLink extends AbstractTcTmParamLink {
	private Status status = Status.UNAVAIL;
	private String detailedStatus = "";

	@Override
	public void init(String yamcsInstance, String linkName, YConfiguration config) throws ConfigurationException {
		Map<String, Object> cfgMap = config.getRoot();
		Map<String, Object> args = new HashMap<>();

		args.put("timestampOffset", -1);
		args.put("seqCountOffset", 0);

		cfgMap.put("packetPreprocessorClassName", "org.yamcs.tctm.GenericPacketPreprocessor");
		cfgMap.put("packetPreprocessorArgs", args);

		YConfiguration cfg = YConfiguration.wrap(cfgMap);

		super.init(yamcsInstance, linkName, cfg);
	}

	@Override
	public String getDetailedStatus() {
		return detailedStatus;
	}

	public void setDetailedStatus(String detailedStatus) {
		this.detailedStatus = detailedStatus;
	}

	public void setStatus(String statusString) {
		Status status = switch (statusString) {
			case "OK" -> Status.OK;
			case "UNAVAIL" -> Status.UNAVAIL;
			case "FAILED" -> Status.FAILED;
			case "DISABLED" -> Status.DISABLED;
			default -> throw new IllegalArgumentException("Unknown status type: " + statusString);
		};

		this.status = status;
	}

	public abstract void handleMqttMessage(MqttMessage message);;

	@Override
	protected Status connectionStatus() {
		return status;
	}

	@Override
	protected void doStart() {
		notifyStarted();
	}

	@Override
	protected void doDisable() throws Exception {
		this.detailedStatus = "Device disconnected or stopped.";
		super.doDisable();
	}

	@Override
	protected void doStop() {
		notifyStopped();
	}
}
