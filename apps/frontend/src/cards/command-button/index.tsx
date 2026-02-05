import {
  DataGridBody,
  DataGridHead,
  DataGridHeader,
  DataGridRow,
} from "@/components/ui/data-grid";
import { makeCard } from "@/lib/cards";
import { Result, useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { YamcsAtomClient } from "@mrt/yamcs-atom";
import { Cause, Schema } from "effect";

type Command = {
  name: string;
};

const commands: Command[] = [
  { name: "FlightComputer/arm_recovery" },
  { name: "FlightComputer/disarm_recovery" },
  { name: "FlightComputer/drogue_ejection" },
  { name: "FlightComputer/emergency_cancel" },
  { name: "FlightComputer/emergency_stop" },
  { name: "FlightComputer/fdov_de-energize" },
  { name: "FlightComputer/fdov_energize" },
  { name: "FlightComputer/landed" },
  { name: "FlightComputer/launch" },
  { name: "FlightComputer/main_ejection" },
  { name: "FlightComputer/mov_arming" },
  { name: "FlightComputer/mov_disarming" },
  { name: "FlightComputer/propulsion_off" },
  { name: "FlightComputer/propulsion_on" },
  { name: "FlightComputer/radio_set_transmit" },
  { name: "FlightComputer/reset_from_start" },
  { name: "FlightComputer/reset_prop_boards_valve_state" },
  { name: "FlightComputer/umbilical" },
  { name: "FlightComputer/vent_valve_de-energize" },
  { name: "FlightComputer/vent_valve_energize" },
];

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
              <div>{command.name.split("/")[1]}</div>
              <button
                onClick={() =>
                  sendCommand({
                    path: {
                      instance: import.meta.env.YAMCS_INSTANCE,
                      processor: "realtime",
                      name: command.name,
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
