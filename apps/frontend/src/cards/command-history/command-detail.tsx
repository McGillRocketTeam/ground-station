import { Fragment, type ReactNode } from "react";
import {
  extractAcknowledgement,
  extractAttribute,
  type CommandHistoryEntry,
} from "./utils";
import { cn, stringifyValue } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

export function CommandDetail({ command }: { command: CommandHistoryEntry }) {
  return (
    <div className="text-sm flex flex-row gap-2 items-stretch">
      <DetailTable command={command} />
      {/* <Separator orientation="vertical" /> */}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div className="font-sans text-xs font-semibold">{children}</div>;
}

function DetailTable({ command }: { command: CommandHistoryEntry }) {
  return (
    <div className="grid font-mono gap-2">
      <div className="space-y-0.5">
        <Label>Command</Label>
        <div className="grid grid-cols-2 gap-x-1">
          <div className="col-span-2 font-medium">{command.commandName}</div>

          {command.assignments &&
            command.assignments.map((assignment, index) => {
              const isLast = index === command.assignments!.length - 1;

              return (
                <Fragment key={assignment.name}>
                  <div className="relative ml-2 pl-4">
                    {!isLast && (
                      <span className="absolute left-1 top-0 h-full border-l" />
                    )}

                    {isLast && (
                      <>
                        <span className="absolute left-1 top-0 h-1/2 border-l" />
                        <span className="absolute left-1 top-1/2 w-3 border-b" />
                      </>
                    )}

                    <span className="relative">{assignment.name}</span>
                  </div>

                  <div>{stringifyValue(assignment.value)}</div>
                </Fragment>
              );
            })}
        </div>
      </div>
      <div className="space-y-0.5">
        <Label>Generation Time</Label>
        <div>{command.generationTime.toLocaleString()}</div>
      </div>
      <div className="space-y-0.5">
        <Label>Issuer</Label>
        <div>
          {`${stringifyValue(extractAttribute(command, "username"))} @${command.origin}`}
        </div>
      </div>
      <div className="space-y-0.5">
        <Label>Queue</Label>
        <div>{stringifyValue(extractAttribute(command, "queue"))}</div>
      </div>
      <Separator />
      <div className="space-y-0.5">
        <Label>Acknowledgements</Label>
        <div className="grid gap-x-2 grid-cols-[auto_1fr]">
          <AckRow command={command} name="Queued" />
          <AckRow command={command} name="Released" />
          <AckRow command={command} name="Sent" />
        </div>
      </div>
    </div>
  );
}

function AckRow({
  command,
  name,
}: {
  command: CommandHistoryEntry;
  name: string;
}) {
  const ack = extractAcknowledgement(command, name);
  return (
    <>
      <div
        className={cn(
          ack.status === "OK" && "text-green-600 dark:text-green-500",
          ack.status === "??" && "text-muted-foreground",
        )}
      >
        {ack.status}
      </div>
      <div>
        {name.toLocaleUpperCase()}

        {ack.time && (
          <span className="text-xs text-muted-foreground ml-2">
            +
            {ack.time.getMilliseconds() -
              command.generationTime.getMilliseconds()}
            ms
          </span>
        )}
      </div>
    </>
  );
}
