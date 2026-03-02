import {
  Result,
  useAtomSet,
  useAtomSuspense,
  useAtomValue,
} from "@effect-atom/atom-react";
import { YamcsAtomClient } from "@mrt/yamcs-atom";
import { Cause, Schema } from "effect";

import {
  DataGridBody,
  DataGridHead,
  DataGridHeader,
  DataGridRow,
} from "@/components/ui/data-grid";
import { makeCard } from "@/lib/cards";

type Command = {
  name: string;
};

export const CommandButtonCard = makeCard({
  id: "command-button",
  name: "Command Button Card",
  schema: Schema.Struct({}),
  component: () => {
    const commandList = useAtomValue(
      YamcsAtomClient.query("command", "listCommands", {
        path: { instance: import.meta.env.YAMCS_INSTANCE },
      }),
    );

    return Result.builder(commandList)
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
    YamcsAtomClient.mutation("command", "issueCommand"),
  );

  const { commands } = useAtomSuspense(
    YamcsAtomClient.query("mdb", "listCommands", {
      path: { instance: "ground_station" },
      urlParams: {},
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
                    path: {
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
