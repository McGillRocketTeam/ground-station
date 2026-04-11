package org.yamcs.mrt.links;

import org.yamcs.commanding.PreparedCommand;

public class AstraGenericTmTcLink extends AbstractAstraGenericTmTcLink {
  @Override
  public boolean sendCommand(PreparedCommand preparedCommand) {
    if (!shouldHandleCommand(preparedCommand)) {
      return false;
    }

    String commandText = preparedCommand.getMetaCommand().getShortDescription();
    if (commandText == null || commandText.isBlank()) {
      failedCommand(preparedCommand.getCommandId(), "Command shortDescription is required");
      return true;
    }

    return publishCommandText(preparedCommand, commandText);
  }
}
