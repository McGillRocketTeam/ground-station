import { useAtomSet, useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { Cause, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { useState } from "react";

import {
  DataGridBody,
  DataGridHead,
  DataGridHeader,
  DataGridRow,
} from "@/components/ui/data-grid";
import { YamcsAtomHttpClient, selectedInstanceAtom } from "@/lib/atom";
import { makeCard } from "@/lib/cards";

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
  schema: Schema.Struct({}),
  component: () => {
    const instance = useAtomValue(selectedInstanceAtom);
    const commandList = useAtomValue(
      YamcsAtomHttpClient.query("command", "listCommands", {
        params: { instance },
      }),
    );

    return AsyncResult.builder(commandList)
      .onInitial(() => (
        <div className="text-muted-foreground grid min-h-full w-full animate-pulse place-items-center font-mono uppercase">
          Awaiting Links
        </div>
      ))
      .onFailure((cause) => (
        <pre className="text-error grid min-h-full w-full text-center place-items-center font-mono uppercase">
          {Cause.pretty(cause)}
        </pre>
      ))
      .onSuccess(() => <CommandButtonTable />)
      .render();
  },
});

function CommandButtonTable() {
  const instance = useAtomValue(selectedInstanceAtom);
  const [target, setTarget] = useState<TargetOption>("BOTH");
  const sendCommand = useAtomSet(
    YamcsAtomHttpClient.mutation("command", "issueCommand"),
  );

  const { commands } = useAtomSuspense(
    YamcsAtomHttpClient.query("mdb", "listCommands", {
      params: { instance },
      query: {},
    }),
  ).value;

  return (
    <div className="h-full overflow-auto">
      <div className="grid grid-cols-[1fr_auto] p-px">
        <DataGridHeader className="bg-background sticky top-0 z-10">
          <DataGridHead className="flex items-center justify-between gap-3">
            <span>COMMAND</span>
            <label className="text-muted-foreground flex items-center gap-2 text-xs font-normal uppercase">
              <span>Target</span>
              <select
                value={target}
                onChange={(event) =>
                  setTarget(event.target.value as TargetOption)
                }
                className="bg-background border-border text-foreground rounded border px-2 py-1 text-xs"
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
          {commands.map((command) => (
            <DataGridRow key={command.name}>
              <div>
                {command.longDescription ?? command.qualifiedName}{" "}
                {command.shortDescription && `(${command.shortDescription})`}
              </div>
              <button
                onClick={() => {
                  const extra = targetExtra(target);

                  sendCommand({
                    params: {
                      instance,
                      processor: "realtime",
                      name: command.qualifiedName,
                    },
                    payload: extra ? { extra } : {},
                  });
                }}
                className="bg-background-secondary! hover:bg-background! text-white-text h-full w-full"
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
