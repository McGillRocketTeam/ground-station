import { useAtom, useAtomValue } from "@effect/atom-react";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { Check, Search, X } from "lucide-react";
import { memo } from "react";

import {
  DataGridBody,
  DataGridHead,
  DataGridHeader,
  DataGridRow,
  DataGridSearch,
} from "@/components/ui/data-grid";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { commandListAtom, commandsSubscriptionAtom } from "@/lib/atom";
import { cn, formatDate, stringifyValue } from "@/lib/utils";

import { BrailleSpinner } from "./braile-spinner";
import { CommandDetail } from "./command-detail";
import { makeCommandDisplayMap } from "./command-display";
import { useAckNow } from "./use-ack-now";
import {
  extractAcknowledgement,
  allDisplayedAcksOk,
  extractAttribute,
  getAckDisplayStatus,
  hasNokAck,
  type CommandHistoryEntry,
} from "./utils";

const extraAckColumns = [
  { group: "System A", header: "RX", name: "uplink_a_rx" },
  { group: "System A", header: "TX", name: "uplink_a_tx" },
  { group: "System A", header: "FC", name: "fc_a" },
  { group: "System B", header: "RX", name: "uplink_b_rx" },
  { group: "System B", header: "TX", name: "uplink_b_tx" },
  { group: "System B", header: "FC", name: "fc_b" },
] as const;

const emptyCommandDisplayMap = new Map<string, string>();
const maxVisibleCommands = 30;

const commandSearchAtom = Atom.make("");

const commandDisplayMapAtom = Atom.make((get) => {
  const commandDefinitions = get(commandListAtom);

  return commandDefinitions._tag === "Success"
    ? makeCommandDisplayMap(commandDefinitions.value)
    : emptyCommandDisplayMap;
});

const totalCommandCountAtom = Atom.make((get) =>
  AsyncResult.map(get(commandsSubscriptionAtom), (commands) => commands.length),
);

const filteredCommandsAtom = Atom.make((get) => {
  const commandSearchText = get(commandSearchAtom).trim().toLowerCase();
  const commandDisplayMap = get(commandDisplayMapAtom);

  return AsyncResult.map(get(commandsSubscriptionAtom), (commands) => {
    const matchingCommands: Array<CommandHistoryEntry> = [];

    for (const command of commands) {
      const label = commandDisplayMap.get(command.commandName) ?? command.commandName;
      if (!label.toLowerCase().includes(commandSearchText)) {
        continue;
      }

      matchingCommands.push(command);

      if (matchingCommands.length >= maxVisibleCommands) {
        break;
      }
    }

    return matchingCommands;
  });
});

export function CommandHistoryTable() {
  const now = useAckNow();
  const commandCount = useAtomValue(totalCommandCountAtom);
  const filteredCommands = useAtomValue(filteredCommandsAtom);
  const commandDisplayMap = useAtomValue(commandDisplayMapAtom);
  const totalCommandCount = commandCount._tag === "Success" ? commandCount.value : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <div
          className={cn(
            "relative grid grid-cols-[1.5rem_auto_1fr_auto_auto_repeat(9,2.125rem)_auto] gap-px rounded-none",
            (filteredCommands._tag === "Initial" || filteredCommands._tag === "Failure") &&
              "min-h-full",
          )}
        >
          <Header />

          {AsyncResult.builder(filteredCommands)
            .onInitial(() => (
              <div className="col-span-full min-h-full animate-pulse text-center font-mono text-muted-foreground uppercase">
                Loading Command History
              </div>
            ))
            .onError((error) => (
              <pre className="col-span-full min-h-full text-center text-error uppercase">
                {error.toString()}
              </pre>
            ))
            .onSuccess((commands) => (
              <Body
                commands={commands}
                now={now}
                totalCommandCount={totalCommandCount}
                commandDisplayMap={commandDisplayMap}
              />
            ))
            .render()}
        </div>
      </div>
    </div>
  );
}

const Body = memo(function Body({
  commands,
  now,
  totalCommandCount,
  commandDisplayMap,
}: {
  commands: ReadonlyArray<CommandHistoryEntry>;
  now: number;
  totalCommandCount: number;
  commandDisplayMap: ReadonlyMap<string, string>;
}) {
  return (
    <DataGridBody className="text-sm">
      {totalCommandCount === 0 ? (
        <div className="col-span-full grid min-h-full place-items-center font-mono text-muted-foreground uppercase">
          No commands sent yet
        </div>
      ) : commands.length === 0 ? (
        <div className="col-span-full grid min-h-full place-items-center font-mono text-muted-foreground uppercase">
          No commands match the current search
        </div>
      ) : null}

      {commands.map((command) => (
        <CommandRow
          key={command.id}
          command={command}
          now={now}
          commandLabel={commandDisplayMap.get(command.commandName) ?? command.commandName}
        />
      ))}
    </DataGridBody>
  );
});

const CommandRow = memo(function CommandRow({
  command,
  now,
  commandLabel,
}: {
  command: CommandHistoryEntry;
  now: number;
  commandLabel: string;
}) {
  const rowHasNokAck = hasNokAck(command, now);

  return (
    <Popover>
      <PopoverTrigger
        payload={command}
        nativeButton={false}
        render={
          <DataGridRow
            className={cn(
              "group cursor-default data-popup-open:*:bg-[color-mix(in_oklab,var(--color-selection-background)_50%,var(--background))]",
              rowHasNokAck &&
                "*:bg-error *:text-error-foreground hover:*:bg-error data-popup-open:*:bg-error",
            )}
          >
            <div className="col-span-2 text-right">{formatDate(command.generationTime)}</div>
            <div className="line-clamp-1 no-scrollbar overflow-x-scroll">{commandLabel}</div>
            <div className="text-center">
              {stringifyValue(extractAttribute(command, "Command_Id"), "")}
            </div>
            <div className="text-center">
              {stringifyValue(extractAttribute(command, "Sequence_Count"), "")}
            </div>

            <AckCell command={command} name="Queued" errorRow={rowHasNokAck} />
            <AckCell command={command} name="Released" errorRow={rowHasNokAck} />
            <AckCell command={command} name="Sent" errorRow={rowHasNokAck} />
            {extraAckColumns.map((ack) => (
              <AckCell key={ack.name} command={command} name={ack.name} errorRow={rowHasNokAck} />
            ))}
            <AckCell
              command={command}
              name="CommandComplete"
              customPrefix
              errorRow={rowHasNokAck}
            />
          </DataGridRow>
        }
      />

      <PopoverContent>
        <CommandDetail command={command} commandLabel={commandLabel} />
      </PopoverContent>
    </Popover>
  );
}, areCommandRowPropsEqual);

function areCommandRowPropsEqual(
  previous: { command: CommandHistoryEntry; commandLabel: string; now: number },
  next: { command: CommandHistoryEntry; commandLabel: string; now: number },
) {
  return (
    previous.command.id === next.command.id &&
    previous.now === next.now &&
    previous.commandLabel === next.commandLabel &&
    (previous.command === next.command || allDisplayedAcksOk(previous.command))
  );
}

const AckCell = memo(function AckCell({
  command,
  name,
  customPrefix,
  errorRow,
}: {
  command: CommandHistoryEntry;
  name: string;
  customPrefix?: boolean;
  errorRow?: boolean;
}) {
  const ack = extractAcknowledgement(command, name, customPrefix);
  const displayStatus = getAckDisplayStatus(command, ack);

  return (
    <div
      title={ack.label}
      className={cn(
        "grid place-items-center !px-0",
        !errorRow && displayStatus === "OK" && "text-success",
        !errorRow &&
          (displayStatus === "??" || displayStatus === "PENDING") &&
          "text-muted-foreground",
        !errorRow &&
          displayStatus !== "??" &&
          displayStatus !== "PENDING" &&
          displayStatus !== "OK" &&
          "text-error",
      )}
    >
      {displayStatus === "OK" && <Check className="size-3.5" />}
      {displayStatus === "PENDING" && <BrailleSpinner />}
      {displayStatus !== "OK" && displayStatus !== "??" && displayStatus !== "PENDING" && (
        <X className="size-4" />
      )}
      {displayStatus === "??" && "-"}
    </div>
  );
});

const SearchInput = memo(function SearchInput() {
  const [commandSearchText, setCommandSearchText] = useAtom(commandSearchAtom);

  return (
    <DataGridSearch
      placeholder="Search command history..."
      className="relative col-span-4 font-sans"
      value={commandSearchText}
      onChange={setCommandSearchText}
    />
  );
});

const Header = memo(function Header() {
  return (
    <DataGridHeader className="sticky top-0 z-0 bg-background">
      <DataGridHead className="grid place-items-center">
        <Search className="size-3 text-muted-foreground" />
      </DataGridHead>
      <SearchInput />
      <DataGridHead className="col-span-3 text-center">Yamcs</DataGridHead>
      <DataGridHead className="col-span-3 text-center">System A</DataGridHead>
      <DataGridHead className="col-span-3 text-center">System B</DataGridHead>
      <DataGridHead className="text-center">Done</DataGridHead>
      <DataGridHead className="col-span-2">Timestamp</DataGridHead>
      <DataGridHead>Command</DataGridHead>
      <DataGridHead className="text-center">ID</DataGridHead>
      <DataGridHead className="text-center">SEQ</DataGridHead>
      <DataGridHead className="!px-0 text-center">Q</DataGridHead>
      <DataGridHead className="!px-0 text-center">R</DataGridHead>
      <DataGridHead className="!px-0 text-center">S</DataGridHead>
      {extraAckColumns.map((ack) => (
        <DataGridHead key={ack.name} className="!px-0 text-center">
          {ack.header}
        </DataGridHead>
      ))}
      <DataGridHead className="!px-0 text-center">OK</DataGridHead>
    </DataGridHeader>
  );
});
