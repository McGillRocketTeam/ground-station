import { useAtom, useAtomValue } from "@effect/atom-react";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { Check, Search, X } from "lucide-react";
import { memo, useMemo } from "react";

import {
  DataGridBody,
  DataGridHead,
  DataGridHeader,
  DataGridRow,
  DataGridSearch,
} from "@/components/ui/data-grid";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  YamcsAtomHttpClient,
  commandsSubscriptionAtom,
  selectedInstanceAtom,
} from "@/lib/atom";
import { cn, formatDate, stringifyValue } from "@/lib/utils";

import { BrailleSpinner } from "./braile-spinner";
import { CommandDetail } from "./command-detail";
import { makeCommandDisplayMap } from "./command-display";
import {
  extractAcknowledgement,
  extractAttribute,
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

export function CommandHistoryTable() {
  const instance = useAtomValue(selectedInstanceAtom);
  const commandHistory = useAtomValue(commandsSubscriptionAtom);
  const commandDefinitions = useAtomValue(
    YamcsAtomHttpClient.query("mdb", "listCommands", {
      params: { instance },
      query: {},
    }),
  );
  const commandDisplayMap = useMemo(
    () =>
      commandDefinitions._tag === "Success"
        ? makeCommandDisplayMap(commandDefinitions.value.commands)
        : new Map<string, string>(),
    [commandDefinitions],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <div
          className={cn(
            "relative grid grid-cols-[1.5rem_auto_1fr_auto_auto_repeat(9,2.125rem)_auto] gap-px rounded-none",
            (commandHistory._tag === "Initial" ||
              commandHistory._tag === "Failure") &&
              "min-h-full",
          )}
        >
          <Header />

          {AsyncResult.builder(commandHistory)
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
              <Body commands={commands} commandDisplayMap={commandDisplayMap} />
            ))
            .render()}
        </div>
      </div>
    </div>
  );
}

const Body = memo(function Body({
  commands,
  commandDisplayMap,
}: {
  commands: CommandHistoryEntry[];
  commandDisplayMap: ReadonlyMap<string, string>;
}) {
  const commandSearchText = useAtomValue(commandSearchAtom);
  const filteredCommands = useMemo(
    () =>
      commands.filter((cmd) => {
        const label = commandDisplayMap.get(cmd.commandName) ?? cmd.commandName;
        return label.toLowerCase().includes(commandSearchText.toLowerCase());
      }),
    [commands, commandDisplayMap, commandSearchText],
  );

  return (
    <DataGridBody className="text-sm">
      {commands.length === 0 ? (
        <div className="col-span-full grid min-h-full place-items-center font-mono text-muted-foreground uppercase">
          No commands sent yet
        </div>
      ) : filteredCommands.length === 0 ? (
        <div className="col-span-full grid min-h-full place-items-center font-mono text-muted-foreground uppercase">
          No commands match the current search
        </div>
      ) : null}

      {filteredCommands.map((command) => (
        <CommandRow
          key={command.id}
          command={command}
          commandDisplayMap={commandDisplayMap}
        />
      ))}
    </DataGridBody>
  );
});

const CommandRow = memo(function CommandRow({
  command,
  commandDisplayMap,
}: {
  command: CommandHistoryEntry;
  commandDisplayMap: ReadonlyMap<string, string>;
}) {
  const commandLabel =
    commandDisplayMap.get(command.commandName) ?? command.commandName;
  const rowHasNokAck = hasNokAck(command);

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
            <div className="col-span-2 text-right">
              {formatDate(command.generationTime)}
            </div>
            <div className="line-clamp-1 no-scrollbar overflow-x-scroll">
              {commandLabel}
            </div>
            <div className="text-center">
              {stringifyValue(extractAttribute(command, "Command_Id"), "")}
            </div>
            <div className="text-center">
              {stringifyValue(extractAttribute(command, "Sequence_Count"), "")}
            </div>

            <AckCell command={command} name="Queued" errorRow={rowHasNokAck} />
            <AckCell
              command={command}
              name="Released"
              errorRow={rowHasNokAck}
            />
            <AckCell command={command} name="Sent" errorRow={rowHasNokAck} />
            {extraAckColumns.map((ack) => (
              <AckCell
                key={ack.name}
                command={command}
                name={ack.name}
                errorRow={rowHasNokAck}
              />
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
});

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
  return (
    <div
      title={ack.label}
      className={cn(
        "grid place-items-center !px-0",
        !errorRow && ack.status === "OK" && "text-success",
        !errorRow &&
          (ack.status === "??" || ack.status === "PENDING") &&
          "text-muted-foreground",
        !errorRow &&
          ack.status !== "??" &&
          ack.status !== "PENDING" &&
          ack.status !== "OK" &&
          "text-error",
      )}
    >
      {ack.status === "OK" && <Check className="size-3.5" />}
      {ack.status === "PENDING" && <BrailleSpinner />}
      {ack.status !== "OK" &&
        ack.status !== "??" &&
        ack.status !== "PENDING" && <X className="size-4" />}
      {ack.status === "??" && "-"}
    </div>
  );
});

const commandSearchAtom = Atom.make("");

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
    <DataGridHeader className="sticky top-0 z-20 bg-background">
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
