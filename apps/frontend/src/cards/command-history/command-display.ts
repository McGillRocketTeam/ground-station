import type { CommandInfo } from "@mrt/yamcs-effect";

type CommandDefinition = typeof CommandInfo.Type;

export function formatCommandDisplayName(
  qualifiedName: string,
  command?: CommandDefinition,
) {
  if (!command) {
    return qualifiedName;
  }

  const title = command.longDescription ?? command.qualifiedName;
  return command.shortDescription
    ? `${title} (${command.shortDescription})`
    : title;
}

export function makeCommandDisplayMap(
  commands: ReadonlyArray<CommandDefinition>,
): ReadonlyMap<string, string> {
  return new Map(
    commands.map((command) => [
      command.qualifiedName,
      formatCommandDisplayName(command.qualifiedName, command),
    ]),
  );
}
