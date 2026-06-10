package org.yamcs.mrt.links;

import org.yamcs.commanding.PreparedCommand;

public class AstraGenericTmLink extends AbstractAstraGenericTmTcLink {
  @Override
  public boolean sendCommand(PreparedCommand preparedCommand) {
    return false;
  }

  @Override
  public boolean isTcDataLinkImplemented() {
    return false;
  }
}
