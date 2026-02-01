import {
  DataGridBody,
  DataGridHead,
  DataGridHeader,
  DataGridRow,
} from "@/components/ui/data-grid";
import { makeCard } from "@/lib/cards";
import { cn, stringifyValue } from "@/lib/utils";
import { Popover as PopoverPrimitive } from "@base-ui/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Result, useAtomValue } from "@effect-atom/atom-react";
import { commandsSubscriptionAtom } from "@mrt/yamcs-atom";
import type { CommandHistoryEvent } from "@mrt/yamcs-effect";
import { Schema } from "effect";

type command = (typeof CommandHistoryEvent.Type)["data"];

export const CommandHistoryCard = makeCard({
  id: "command-history",
  name: "Command History Card",
  schema: Schema.Struct({}),
  component: () => {
    const commandHistory = useAtomValue(commandsSubscriptionAtom);
    const commandPopover = PopoverPrimitive.createHandle<command>();

    return (
      <>
        <div
          className={cn(
            "grid relative grid-cols-[1.5rem_auto_1fr_1.5rem_1.5rem_1.5rem] gap-px",
            commandHistory._tag === "Initial" && "min-h-full",
          )}
        >
          <Header />

          {Result.builder(commandHistory)
            .onInitial(() => (
              <div className="col-span-full text-center min-h-full text-muted-foreground animate-pulse font-mono uppercase">
                Loading Command History
              </div>
            ))
            .onError((error) => (
              <pre className="col-span-full h-full text-center text-destructive">
                {error.toString()}
              </pre>
            ))
            .onSuccess((commands) => (
              <DataGridBody>
                {commands.map((command) => (
                  <PopoverTrigger
                    handle={commandPopover}
                    payload={command}
                    key={command.id}
                    nativeButton={false}
                    render={
                      <DataGridRow>
                        <div />
                        <div>{formatDate(command.generationTime)}</div>
                        <div className="flex flex-col">
                          <div>{command.commandName} </div>
                          <div className="text-sm">
                            {command.assignments
                              ?.filter((u) => u.userInput)
                              .map((assignment) => (
                                <div
                                  className="m-1 border-l pl-1"
                                  key={assignment.name}
                                >
                                  {assignment.name}:{" "}
                                  {stringifyValue(assignment.value)}
                                </div>
                              ))}
                          </div>
                        </div>
                        <div>x</div>
                        <div>x</div>
                        <div>x</div>
                      </DataGridRow>
                    }
                  />
                ))}
              </DataGridBody>
            ))
            .render()}
        </div>
        <Popover handle={commandPopover}>
          {({ payload: command }) => (
            <PopoverContent>
              <div>Hello {command?.commandName}</div>
            </PopoverContent>
          )}
        </Popover>
      </>
    );
  },
});

function Row(command: command) {}

function formatDate(d: Date) {
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

  return (isToday ? "Today" : d.toLocaleDateString()) + ", " + time;
}

function Header() {
  return (
    <DataGridHeader>
      <DataGridHead />
      <DataGridHead>Timestamp</DataGridHead>
      <DataGridHead>Command</DataGridHead>
      <DataGridHead className="col-span-3 text-center">ACK</DataGridHead>
    </DataGridHeader>
  );
}
