import { DateTime } from "effect";
import { Fragment, type ReactNode } from "react";

import { Separator } from "@/components/ui/separator";
import { cn, formatUtcDateTime, stringifyValue } from "@/lib/utils";

import { BrailleSpinner } from "./braile-spinner";
import { useAckNow } from "./use-ack-now";
import {
  collectAcks,
  extractAttribute,
  getAckDisplayStatus,
  type Ack,
  type CommandHistoryEntry,
} from "./utils";

export function CommandDetail({
  command,
  commandLabel,
}: {
  command: CommandHistoryEntry;
  commandLabel?: string;
}) {
  return (
    <div className="flex flex-row items-stretch gap-2 text-sm">
      <DetailTable command={command} commandLabel={commandLabel} />
      {/* <Separator orientation="vertical" /> */}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div className="font-sans text-xs font-semibold">{children}</div>;
}

function diffMs(command: CommandHistoryEntry, ack: Ack) {
  if (!ack.time) {
    return undefined;
  }

  return Math.abs(
    DateTime.toDate(command.generationTime).getTime() - DateTime.toDate(ack.time).getTime(),
  );
}

function DetailTable({
  command,
  commandLabel,
}: {
  command: CommandHistoryEntry;
  commandLabel?: string;
}) {
  const now = useAckNow();
  const acks = collectAcks(command);

  return (
    <div className="grid gap-2 font-mono">
      <div className="space-y-0.5">
        <Label>Command</Label>
        <div className="grid grid-cols-2 gap-x-1">
          <div className="col-span-2 font-medium">{commandLabel ?? command.commandName}</div>

          {command.assignments &&
            command.assignments.map((assignment, index) => {
              const isLast = index === command.assignments!.length - 1;

              return (
                <Fragment key={assignment.name}>
                  <div className="relative ml-2 pl-4">
                    {!isLast && <span className="absolute top-0 left-1 h-full border-l" />}

                    {isLast && (
                      <>
                        <span className="absolute top-0 left-1 h-1/2 border-l" />
                        <span className="absolute top-1/2 left-1 w-3 border-b" />
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
        <div>{formatUtcDateTime(command.generationTime)}</div>
      </div>
      <div className="space-y-0.5">
        <Label>Issuer</Label>
        <div>{`${stringifyValue(extractAttribute(command, "username"))} @${command.origin}`}</div>
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
          <div>{stringifyValue(extractAttribute(command, "Sequence_Count"))}</div>
        </div>
      </div>
      <div className="space-y-0.5">
        <Label>Targets</Label>
        <div>{stringifyValue(extractAttribute(command, "TX_Targets"), "-")}</div>
      </div>
      <Separator />
      {acks.yamcs.length > 0 && (
        <div className="space-y-0.5">
          <Label>Yamcs Acknowledgements</Label>
          <div className="grid grid-cols-[auto_1fr] gap-x-2">
            {acks.yamcs.map((ack) => (
              <AckRow key={ack.name} ack={ack} command={command} now={now} />
            ))}
          </div>
        </div>
      )}
      {acks.systemA.length > 0 && (
        <div className="space-y-0.5">
          <Label>System A Acknowledgements</Label>
          <div className="grid grid-cols-[auto_1fr] gap-x-2">
            {acks.systemA.map((ack) => (
              <AckRow
                friendlyName={ack.label}
                key={ack.name}
                ack={ack}
                command={command}
                now={now}
              />
            ))}
          </div>
        </div>
      )}
      {acks.systemB.length > 0 && (
        <div className="space-y-0.5">
          <Label>System B Acknowledgements</Label>
          <div className="grid grid-cols-[auto_1fr] gap-x-2">
            {acks.systemB.map((ack) => (
              <AckRow
                friendlyName={ack.label}
                key={ack.name}
                ack={ack}
                command={command}
                now={now}
              />
            ))}
          </div>
        </div>
      )}
      {acks.other.length > 0 && (
        <div className="space-y-0.5">
          <Label>Other Acknowledgements</Label>
          <div className="grid grid-cols-[auto_1fr] gap-x-2">
            {acks.other.map((ack) => (
              <AckRow
                friendlyName={ack.label}
                key={ack.name}
                ack={ack}
                command={command}
                now={now}
              />
            ))}
          </div>
        </div>
      )}
      {acks.completion && (
        <div className="space-y-0.5">
          <Label>Completion</Label>
          <div className="grid grid-cols-[auto_1fr] gap-x-2 max-w-80">
            <FCAckRow ack={acks.completion} command={command} now={now} />
          </div>
        </div>
      )}
    </div>
  );
}

export function FCAckRow({
  ack,
  command,
  now = Date.now(),
}: {
  ack: Ack;
  command: CommandHistoryEntry;
  now?: number;
}) {
  if (ack.status === "??") return;

  const displayStatus = getAckDisplayStatus(command, ack, now);

  return (
    <>
      <div
        className={cn(
          displayStatus === "OK" && "text-success",
          displayStatus === "NOK" && "bg-error text-error-foreground",
          displayStatus === "PENDING" && "w-[2ch] text-center",
          displayStatus === "??" && "text-muted-foreground",
        )}
      >
        {displayStatus === "OK" && "SUCCESS"}
        {displayStatus === "PENDING" && <BrailleSpinner />}
        {displayStatus === "NOK" && "FAILURE"}
        {displayStatus === "CANCELLED" && "CANCELLED"}
      </div>
      <div>
        {ack.label.toLocaleUpperCase()}

        {ack.time && (
          <span className="ml-2 text-xs text-muted-foreground">+{diffMs(command, ack)}ms</span>
        )}
      </div>
      {ack.message && (
        <div className="col-span-full border-l-2 border-error py-1 pl-2 font-sans break-all">
          {ack.message}
        </div>
      )}
    </>
  );
}

export function AckRow({
  ack,
  command,
  friendlyName,
  now = Date.now(),
}: {
  ack: Ack;
  command: CommandHistoryEntry;
  friendlyName?: string;
  now?: number;
}) {
  if (ack.status === "??") return;

  const displayStatus = getAckDisplayStatus(command, ack, now);

  return (
    <>
      <div
        className={cn(
          displayStatus === "OK" && "text-success",
          displayStatus === "NOK" && "bg-error text-error-foreground",
          displayStatus === "PENDING" && "w-[2ch] text-center",
          displayStatus === "??" && "text-muted-foreground",
        )}
      >
        {displayStatus === "PENDING" ? <BrailleSpinner /> : displayStatus}
      </div>
      <div>
        {friendlyName ? friendlyName.toLocaleUpperCase() : ack.name.toLocaleUpperCase()}

        {ack.time && (
          <span className="ml-2 text-xs text-muted-foreground">+{diffMs(command, ack)}ms</span>
        )}
      </div>
      {ack.message && (
        <div className="col-span-full border-l-2 border-error py-1 pl-2 font-sans break-all">
          {ack.message}
        </div>
      )}
    </>
  );
}
