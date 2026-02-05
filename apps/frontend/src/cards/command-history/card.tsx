import {
  DataGridBody,
  DataGridHead,
  DataGridHeader,
  DataGridRow,
  DataGridSearch,
} from "@/components/ui/data-grid";
import { cn, stringifyValue } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Atom, Result, useAtom, useAtomValue } from "@effect-atom/atom-react";
import { commandsSubscriptionAtom } from "@mrt/yamcs-atom";
import {
  extractAcknowledgement,
  extractAttribute,
  formatCommandDate,
  type CommandHistoryEntry,
} from "./utils";
import { CommandDetail } from "./command-detail";
import { Check, RefreshCw, Search, X } from "lucide-react";
import { BrailleSpinner } from "./braile-spinner";

export function CommandHistoryTable() {
  const commandHistory = useAtomValue(commandsSubscriptionAtom);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto">
        <div
          className={cn(
            "grid relative grid-cols-[1.5rem_auto_1fr_auto_auto_repeat(5,1.5rem)_auto] gap-px rounded-none",
            (commandHistory._tag === "Initial" ||
              commandHistory._tag === "Failure") &&
              "min-h-full",
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
              <pre className="col-span-full text-error text-center min-h-full uppercase">
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
                <DataGridRow className="group data-popup-open:*:bg-[color-mix(in_oklab,var(--color-selection-background)_50%,var(--background))]">
                  <div className="relative px-0">
                    <button
                      onClick={() => console.log("click")}
                      className="inset-0 z-10 absolute group-hover:opacity-100 opacity-0 cursor-pointer grid place-items-center"
                    >
                      <RefreshCw className="size-3" />
                    </button>
                  </div>
                  <div className="text-right">
                    {formatCommandDate(command.generationTime)}
                  </div>
                  <div className="overflow-x-scroll no-scrollbar line-clamp-1">
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
                  <AckCell command={command} name="Radio_RX" />
                  <AckCell command={command} name="Radio_TX" />
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
        "text-sm grid place-items-center",
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
      className="col-span-4 relative font-sans"
      value={commandSearchText}
      onChange={setCommandSearchText}
    />
  );
}

function Header() {
  return (
    <DataGridHeader className="sticky top-0 z-20 bg-background">
      <DataGridHead className="grid place-items-center">
        <Search className="size-3 text-muted-foreground" />
      </DataGridHead>
      <SearchInput />
      <DataGridHead className="col-span-3 text-center">G.S.C.</DataGridHead>
      <DataGridHead className="col-span-2 text-center">RADIO</DataGridHead>
      <DataGridHead className="text-center">FC</DataGridHead>
      <DataGridHead className="col-span-1" />
      <DataGridHead>Timestamp</DataGridHead>
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
