import {
  DataGridBody,
  DataGridHead,
  DataGridHeader,
  DataGridRow,
} from "@/components/ui/data-grid";
import { cn, stringifyValue } from "@/lib/utils";
import { Popover as PopoverPrimitive } from "@base-ui/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Result, useAtomValue } from "@effect-atom/atom-react";
import { commandsSubscriptionAtom } from "@mrt/yamcs-atom";
import {
  extractAcknowledgement,
  formatCommandDate,
  type CommandHistoryEntry,
} from "./utils";
import { CommandDetail } from "./command-detail";

export function CommandHistoryTable() {
  const commandHistory = useAtomValue(commandsSubscriptionAtom);
  const commandPopover = PopoverPrimitive.createHandle<CommandHistoryEntry>();

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
                    <DataGridRow className="data-popup-open:*:bg-selection-background">
                      <div />
                      <div className="text-right">
                        {formatCommandDate(command.generationTime)}
                      </div>
                      <div>{command.commandName}</div>
                      <AckCell command={command} name="Queued" />
                      <AckCell command={command} name="Released" />
                      <AckCell command={command} name="Sent" />
                    </DataGridRow>
                  }
                />
              ))}
            </DataGridBody>
          ))
          .render()}
      </div>
      <Popover handle={commandPopover}>
        {({ payload: command }) =>
          command && (
            <PopoverContent>
              <CommandDetail command={command} />
            </PopoverContent>
          )
        }
      </Popover>
    </>
  );
}

function AckCell({
  command,
  name,
}: {
  command: CommandHistoryEntry;
  name: string;
}) {
  const ack = extractAcknowledgement(command, name);
  return (
    <div
      className={cn(
        ack.status === "OK" && "text-green-600 dark:text-green-500",
        ack.status === "??" && "text-muted-foreground",
        ack.status !== "??" && ack.status !== "OK" && "text-error",
      )}
    >
      {ack.status === "OK" && "✓"}
      {ack.status !== "OK" && ack.status !== "??" && "✗"}
    </div>
  );
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
