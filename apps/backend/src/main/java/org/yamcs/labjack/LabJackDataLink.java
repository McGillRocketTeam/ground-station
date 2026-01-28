package org.yamcs.labjack;

import org.yamcs.ConfigurationException;
import org.yamcs.YConfiguration;
import org.yamcs.commanding.PreparedCommand;
import org.yamcs.tctm.AbstractTcTmParamLink;

public class LabJackDataLink extends AbstractTcTmParamLink {

	@Override
	public void init(String instance, String name, YConfiguration config) throws ConfigurationException {
		super.init(instance, name, config);
	}

	@Override
	public boolean sendCommand(PreparedCommand preparedCommand) {
		failedCommand(preparedCommand.getCommandId(), "LabJack is not connected.");
		return false;
	}

	@Override
	public String getDetailedStatus() {
		return "No LabJack Connected.";
	}

	@Override
	protected Status connectionStatus() {
		// TODO Auto-generated method stub
		return Status.UNAVAIL;
	}

	@Override
	protected void doStart() {
		if (isDisabled()) {
			notifyStarted();
		} else {
			notifyStarted();
		}
	}

	@Override
	protected void doStop() {
		notifyStopped();
	}

	@Override
	public boolean isTmPacketDataLinkImplemented() {
		return false;
	}
}
