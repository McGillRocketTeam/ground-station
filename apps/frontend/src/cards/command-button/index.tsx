import { useAtomSet, useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { Cause, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

import {
  DataGridBody,
  DataGridHead,
  DataGridHeader,
  DataGridRow,
} from "@/components/ui/data-grid";
import { YamcsAtomHttpClient } from "@/lib/atom";
import { makeCard } from "@/lib/cards";

export const CommandButtonCard = makeCard({
  id: "command-button",
  name: "Command Button Card",
  schema: Schema.Struct({}),
  component: () => {
    const commandList = useAtomValue(
      YamcsAtomHttpClient.query("command", "listCommands", {
        params: { instance: import.meta.env.YAMCS_INSTANCE },
      }),
    );

    return AsyncResult.builder(commandList)
      .onInitial(() => (
        <div className="text-muted-foreground grid min-h-full w-full animate-pulse place-items-center font-mono uppercase">
          Awaiting Links
        </div>
      ))
      .onFailure((cause) => (
        <pre className="text-error col-span-full min-h-full text-center uppercase">
          {Cause.pretty(cause)}
        </pre>
      ))
      .onSuccess(() => <CommandButtonTable />)
      .render();
  },
});

function CommandButtonTable() {
  const sendCommand = useAtomSet(
    YamcsAtomHttpClient.mutation("command", "issueCommand"),
  );

  const { commands } = useAtomSuspense(
    YamcsAtomHttpClient.query("mdb", "listCommands", {
      params: { instance: "ground_station" },
      query: {},
    }),
  ).value;

  return (
    <div className="h-full overflow-auto">
      <div className="grid grid-cols-[1fr_auto] p-px">
        <DataGridHeader className="bg-background sticky top-0 z-10">
          <DataGridHead>COMMAND</DataGridHead>
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
                onClick={() =>
                  sendCommand({
                    params: {
                      instance: import.meta.env.YAMCS_INSTANCE,
                      processor: "realtime",
                      name: command.qualifiedName,
                    },
                    payload: {},
                  })
                }
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
