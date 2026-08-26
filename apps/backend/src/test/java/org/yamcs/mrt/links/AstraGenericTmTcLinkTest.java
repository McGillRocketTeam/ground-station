package org.yamcs.mrt.links;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.yamcs.commanding.ArgumentValue;
import org.yamcs.commanding.PreparedCommand;
import org.yamcs.protobuf.Commanding.CommandId;
import org.yamcs.utils.ValueUtility;
import org.yamcs.xtce.Argument;
import org.yamcs.xtce.MetaCommand;

class AstraGenericTmTcLinkTest {

  @Test
  void rendersNamedArgumentsAndTerminatesCommand() {
    MetaCommand metaCommand = new MetaCommand("rocket_command_1_arg");
    Argument id = new Argument("id");
    Argument commandName = new Argument("command");
    Argument argument = new Argument("arg1");
    metaCommand.addArgument(id);
    metaCommand.addArgument(commandName);
    metaCommand.addArgument(argument);

    PreparedCommand command = preparedCommand(metaCommand);
    Map<Argument, ArgumentValue> assignments = new LinkedHashMap<>();
    assignments.put(id, new ArgumentValue(id, ValueUtility.getUint32Value(13)));
    assignments.put(
        commandName, new ArgumentValue(commandName, ValueUtility.getStringValue("fire")));
    assignments.put(argument, new ArgumentValue(argument, ValueUtility.getBooleanValue(true)));
    command.setArgAssignment(
        assignments,
        assignments.keySet().stream()
            .map(Argument::getName)
            .collect(java.util.stream.Collectors.toSet()));

    assertEquals(
        "13:fire t\n", AstraGenericTmTcLink.renderCommandText(command, "{id}:{command} {arg1}"));
  }

  @Test
  void appendsArgumentsNotPresentInTemplateInDeclaredOrder() {
    MetaCommand metaCommand = new MetaCommand("set_frequency");
    Argument frequency = new Argument("frequency_mhz");
    metaCommand.addArgument(frequency);

    PreparedCommand command = preparedCommand(metaCommand);
    Map<Argument, ArgumentValue> assignments =
        Map.of(frequency, new ArgumentValue(frequency, ValueUtility.getDoubleValue(435.0)));
    command.setArgAssignment(assignments, java.util.Set.of(frequency.getName()));

    assertEquals(
        "radio freq 435.0\n", AstraGenericTmTcLink.renderCommandText(command, "radio freq"));
  }

  private static PreparedCommand preparedCommand(MetaCommand metaCommand) {
    CommandId id =
        CommandId.newBuilder()
            .setGenerationTime(1)
            .setOrigin("test")
            .setSequenceNumber(1)
            .setCommandName(metaCommand.getName())
            .build();
    PreparedCommand command = new PreparedCommand(id);
    command.setMetaCommand(metaCommand);
    return command;
  }
}
