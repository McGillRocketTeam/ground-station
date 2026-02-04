import { Fragment, type ReactNode } from "react";
import {
  collectAcks,
  extractAcknowledgement,
  extractAttribute,
  type Ack,
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
  const acks = collectAcks(command);

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
      <div className="grid grid-cols-3">
        <div className="space-y-0.5">
          <Label>Queue</Label>
          <div>{stringifyValue(extractAttribute(command, "queue"))}</div>
        </div>
        <div className="space-y-0.5">
          <Label>ID</Label>
          <div>{stringifyValue(extractAttribute(command, "Command_Id"))}</div>
        </div>
        <div className="space-y-0.5">
          <Label>Seq. Number</Label>
          <div>
            {stringifyValue(extractAttribute(command, "Sequence_Count"))}
          </div>
        </div>
      </div>
      <Separator />
      {acks.groundStation.length > 0 && (
        <div className="space-y-0.5">
          <Label>G.S.C. Acknowledgements</Label>
          <div className="grid gap-x-2 grid-cols-[auto_1fr]">
            {acks.groundStation.map((ack) => (
              <AckRow key={ack.name} ack={ack} command={command} />
            ))}
          </div>
        </div>
      )}
      {acks.radio.length > 0 && (
        <div className="space-y-0.5">
          <Label>Radios Acknowledgements</Label>
          <div className="grid gap-x-2 grid-cols-[auto_1fr]">
            {acks.radio.map((ack) => (
              <AckRow key={ack.name} ack={ack} command={command} />
            ))}
          </div>
        </div>
      )}
      {acks.flightComputer.length > 0 && (
        <div className="space-y-0.5">
          <Label>FC Acknowledgements</Label>
          <div className="grid gap-x-2 grid-cols-[auto_1fr]">
            {acks.flightComputer.map((ack) => (
              <FCAckRow key={ack.name} ack={ack} command={command} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FCAckRow({
  ack,
  command,
}: {
  ack: Ack;
  command: CommandHistoryEntry;
}) {
  if (ack.status === "??") return;

  return (
    <div className="flex flex-row items-center">
      <div
        className={cn(
          ack.status === "OK" && "text-success",
          ack.status === "NOK" && "bg-error text-error-foreground",
          ack.status === "??" && "text-muted-foreground",
        )}
      >
        {ack.status === "OK" && "SUCCESS"}
        {ack.status === "NOK" && "FAILURE"}
      </div>
      <div>
        {ack.time && (
          <span className="text-xs text-muted-foreground ml-2">
            +
            {Math.abs(
              command.generationTime.getMilliseconds() -
                ack.time.getMilliseconds(),
            )}
            ms
          </span>
        )}
      </div>
    </div>
  );
}

function AckRow({
  ack,
  command,
  friendlyName,
}: {
  ack: Ack;
  command: CommandHistoryEntry;
  friendlyName?: string;
}) {
  if (ack.status === "??") return;
  return (
    <>
      <div
        className={cn(
          ack.status === "OK" && "text-success",
          ack.status === "NOK" && "bg-error text-error-foreground",
          ack.status === "??" && "text-muted-foreground",
        )}
      >
        {ack.status}
      </div>
      <div>
        {friendlyName
          ? friendlyName.toLocaleUpperCase()
          : ack.name.toLocaleUpperCase()}

        {ack.time && (
          <span className="text-xs text-muted-foreground ml-2">
            +
            {Math.abs(
              command.generationTime.getMilliseconds() -
                ack.time.getMilliseconds(),
            )}
            ms
          </span>
        )}
      </div>
      {ack.message && (
        <div className="col-span-full max-w-80 font-sans border-l-2 border-error break-all pl-2 py-1">
          {ack.message}
        </div>
      )}
    </>
  );
}
