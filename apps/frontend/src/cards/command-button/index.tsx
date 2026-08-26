import type { CommandInfo } from "@mrt/yamcs-effect";

import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Cause, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { useState } from "react";

import { DataGridBody, DataGridHead, DataGridHeader, DataGridRow } from "@/components/ui/data-grid";
import { YamcsAtomHttpClient, selectedInstanceAtom } from "@/lib/atom";
import { makeCard } from "@/lib/cards";
import {
  CommandArrayField,
  type CommandArrayEntry,
  normalizeCommandEntry,
} from "@/lib/command-config";

import { formatCommandDisplayName } from "../command-history/command-display";

type CommandDefinition = typeof CommandInfo.Type;

const TARGET_OPTIONS = ["BOTH", "SystemA", "SystemB"] as const;
type TargetOption = (typeof TARGET_OPTIONS)[number];

const targetExtra = (target: TargetOption) => {
  switch (target) {
    case "SystemA":
      return { mqttFanoutSystemA: true };
    case "SystemB":
      return { mqttFanoutSystemB: true };
    default:
      return undefined;
  }
};

export const CommandButtonCard = makeCard({
  id: "command-button",
  name: "Command Button Card",
  schema: Schema.Struct({
    commands: CommandArrayField,
  }),
  component: (props) => <CommandButtonCardBody commands={props.params.commands} />,
});

function CommandButtonCardBody({
  commands: allowedCommands,
}: {
  commands?: ReadonlyArray<CommandArrayEntry>;
}) {
  const instance = useAtomValue(selectedInstanceAtom);
  const commandList = useAtomValue(
    YamcsAtomHttpClient.query("mdb", "listCommands", {
      params: { instance },
      query: {},
    }),
  );

  return AsyncResult.builder(commandList)
    .onInitial(() => (
      <div className="grid min-h-full w-full animate-pulse place-items-center font-mono text-muted-foreground uppercase">
        Loading Commands
      </div>
    ))
    .onFailure((cause) => (
      <pre className="grid min-h-full w-full place-items-center text-center font-mono text-error uppercase">
        {Cause.pretty(cause)}
      </pre>
    ))
    .onSuccess(({ commands }) => (
      <CommandButtonTable commands={filterCommands(commands, allowedCommands)} />
    ))
    .render();
}

type ConfiguredCommand = {
  command: CommandDefinition;
  args: Readonly<Record<string, string>>;
};

function CommandButtonTable({ commands }: { commands: ReadonlyArray<ConfiguredCommand> }) {
  const instance = useAtomValue(selectedInstanceAtom);
  const [target, setTarget] = useState<TargetOption>("BOTH");
  const sendCommand = useAtomSet(YamcsAtomHttpClient.mutation("command", "issueCommand"));

  return (
    <div className="h-full overflow-auto">
      <div className="grid grid-cols-[1fr_auto] p-px">
        <DataGridHeader className="sticky top-0 z-10 bg-background">
          <DataGridHead className="flex items-center justify-between gap-3">
            <span>COMMAND</span>
            <label className="flex items-center gap-2 text-xs font-normal text-muted-foreground uppercase">
              <span>Target</span>
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value as TargetOption)}
                className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
              >
                {TARGET_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </DataGridHead>
          <DataGridHead />
        </DataGridHeader>

        <DataGridBody>
          {commands.map(({ command, args }, commandIndex) => (
            <DataGridRow key={`${command.qualifiedName}-${commandIndex}`}>
              <div>
                <div>{formatCommandDisplayName(command.qualifiedName, command)}</div>
                {Object.entries(args).length > 0 ? (
                  <div className="text-xs text-muted-foreground">
                    {Object.entries(args)
                      .map(([name, value]) => `${name}=${value}`)
                      .join(", ")}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  const extra = targetExtra(target);

                  sendCommand({
                    params: {
                      instance,
                      processor: "realtime",
                      name: command.qualifiedName,
                    },
                    payload: {
                      ...(Object.keys(args).length > 0 ? { args } : {}),
                      ...(extra ? { extra } : {}),
                    },
                  });
                }}
                className="h-full w-full bg-background-secondary! text-white-text hover:bg-background!"
              >
                SEND
              </button>
            </DataGridRow>
          ))}
        </DataGridBody>
      </div>
    </div>
  );
}

function filterCommands(
  commands: ReadonlyArray<CommandDefinition>,
  allowedCommands?: ReadonlyArray<CommandArrayEntry>,
): ReadonlyArray<ConfiguredCommand> {
  if (!allowedCommands || allowedCommands.length === 0) {
    return commands.map((command) => ({ command, args: {} }));
  }

  const commandLookup = new Map(
    commands.flatMap((command) => [
      [command.qualifiedName, command] as const,
      [command.name, command] as const,
    ]),
  );

  return allowedCommands.flatMap((entry) => {
    const { command: commandName, args } = normalizeCommandEntry(entry);
    const command = commandLookup.get(commandName);
    return command ? [{ command, args }] : [];
  });
}
