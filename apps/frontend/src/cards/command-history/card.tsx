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
import { cn, formatDate, stringifyValue } from "@/lib/utils";
import { Atom, Result, useAtom, useAtomValue } from "@effect-atom/atom-react";
import { commandsSubscriptionAtom } from "@mrt/yamcs-atom";
import { Check, Search, X } from "lucide-react";
import { BrailleSpinner } from "./braile-spinner";
import { CommandDetail } from "./command-detail";
import {
  extractAcknowledgement,
  extractAttribute,
  type CommandHistoryEntry,
} from "./utils";

export function CommandHistoryTable() {
  const commandHistory = useAtomValue(commandsSubscriptionAtom);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <div
          className={cn(
            "relative grid grid-cols-[1.5rem_auto_1fr_auto_auto_repeat(5,1.5rem)_auto] gap-px rounded-none",
            (commandHistory._tag === "Initial" ||
              commandHistory._tag === "Failure") &&
              "min-h-full",
          )}
        >
          <Header />

          {Result.builder(commandHistory)
            .onInitial(() => (
              <div className="text-muted-foreground col-span-full min-h-full animate-pulse text-center font-mono uppercase">
                Loading Command History
              </div>
            ))
            .onError((error) => (
              <pre className="text-error col-span-full min-h-full text-center uppercase">
                {error.toString()}
              </pre>
            ))
            .onSuccess((commands) => <Body commands={commands} />)
            .render()}
        </div>
      </div>
    </div>
  );
}

function Body({ commands }: { commands: CommandHistoryEntry[] }) {
  const commandSearchText = useAtomValue(commandSearchAtom);

  return (
    <DataGridBody className="text-sm">
      {commands
        .filter((cmd) =>
          cmd.commandName.toLowerCase().includes(commandSearchText),
        )
        .map((command) => (
          <Popover key={command.id}>
            <PopoverTrigger
              payload={command}
              nativeButton={false}
              render={
                <DataGridRow className="group cursor-default data-popup-open:*:bg-[color-mix(in_oklab,var(--color-selection-background)_50%,var(--background))]">
                  <div className="col-span-2 text-right">
                    {formatDate(command.generationTime)}
                  </div>
                  <div className="no-scrollbar line-clamp-1 overflow-x-scroll">
                    {command.commandName}
                  </div>
                  <div className="text-center">
                    {stringifyValue(
                      extractAttribute(command, "Command_Id"),
                      "",
                    )}
                  </div>
                  <div className="text-center">
                    {stringifyValue(
                      extractAttribute(command, "Sequence_Count"),
                      "",
                    )}
                  </div>

                  <AckCell command={command} name="Queued" />
                  <AckCell command={command} name="Released" />
                  <AckCell command={command} name="Sent" />
                  <AckCell command={command} name="radio-controlstation-a_RX" />
                  <AckCell command={command} name="radio-controlstation-b_RX" />
                  <FCAckCell command={command} name="CommandComplete" />
                </DataGridRow>
              }
            />

            <PopoverContent>
              <CommandDetail command={command} />
            </PopoverContent>
          </Popover>
        ))}
    </DataGridBody>
  );
}

function FCAckCell({
  command,
  name,
}: {
  command: CommandHistoryEntry;
  name: string;
}) {
  const ack = extractAcknowledgement(command, name, true);
  return (
    <div
      className={cn(
        "grid place-items-center text-sm",
        ack.status === "OK" && "text-success",
        ack.status === "??" && "text-muted-foreground",
        ack.status !== "??" &&
          ack.status !== "OK" &&
          "bg-error! text-error-foreground",
      )}
    >
      {ack.status === "OK" && "SUCCESS"}
      {ack.status !== "OK" && ack.status !== "??" && "FAILURE"}
    </div>
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
        "grid place-items-center",
        ack.status === "OK" && "text-success",
        ack.status === "??" ||
          (ack.status === "PENDING" && "text-muted-foreground"),
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
    </div>
  );
}

const commandSearchAtom = Atom.make("");

function SearchInput() {
  const [commandSearchText, setCommandSearchText] = useAtom(commandSearchAtom);

  return (
    <DataGridSearch
      placeholder="Search command history..."
      className="relative col-span-4 font-sans"
      value={commandSearchText}
      onChange={setCommandSearchText}
    />
  );
}

function Header() {
  return (
    <DataGridHeader className="bg-background sticky top-0 z-20">
      <DataGridHead className="grid place-items-center">
        <Search className="text-muted-foreground size-3" />
      </DataGridHead>
      <SearchInput />
      <DataGridHead className="col-span-3 text-center">G.S.C.</DataGridHead>
      <DataGridHead className="col-span-2 text-center">RADIO</DataGridHead>
      <DataGridHead className="text-center">FC</DataGridHead>
      <DataGridHead className="col-span-2">Timestamp</DataGridHead>
      <DataGridHead>Command</DataGridHead>
      <DataGridHead className="text-center">ID</DataGridHead>
      <DataGridHead className="text-center">SEQ</DataGridHead>
      <DataGridHead className="text-center">Q</DataGridHead>
      <DataGridHead className="text-center">R</DataGridHead>
      <DataGridHead className="text-center">S</DataGridHead>
      <DataGridHead className="text-center">RX</DataGridHead>
      <DataGridHead className="text-center">TX</DataGridHead>
      <DataGridHead className="text-center">ACK</DataGridHead>
    </DataGridHeader>
  );
}
