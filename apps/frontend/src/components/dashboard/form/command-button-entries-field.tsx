import type { CommandInfo } from "@mrt/yamcs-effect";
import type { AnyFieldApi } from "@tanstack/react-form";

import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { formatCommandDisplayName } from "@/cards/command-history/command-display";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";

import { FormTable } from "./form-table";

type CommandDefinition = typeof CommandInfo.Type;
type CommandButtonArgument = { name: string; value: string };
type CommandButtonEntry = {
  command: string;
  label: string;
  args: ReadonlyArray<CommandButtonArgument>;
};

export type DashboardCommandButtonEntriesFieldApi = AnyFieldApi & {
  state: AnyFieldApi["state"] & {
    value: ReadonlyArray<CommandButtonEntry> | undefined;
  };
  handleChange: (value: ReadonlyArray<CommandButtonEntry>) => void;
};

function makeArgument() {
  return { name: "", value: "" };
}

function makeEntry(): CommandButtonEntry {
  return {
    command: "",
    label: "",
    args: [],
  };
}

export function DashboardCommandButtonEntriesField({
  field,
}: {
  field: DashboardCommandButtonEntriesFieldApi;
}) {
  const instance = useAtomValue(selectedInstanceAtom);
  const commandsResult = useAtomValue(
    YamcsAtomHttpClient.query("mdb", "listCommands", {
      params: { instance },
      query: {},
    }),
  );

  return AsyncResult.builder(commandsResult)
    .onInitial(() => <div>Loading Command Button Editor...</div>)
    .onSuccess(({ commands }) => {
      const entries = field.state.value ?? [];

      return (
        <FormTable<CommandButtonEntry>
          addLabel="Add button"
          columns={[
            {
              className: "w-64 align-top",
              header: "Label",
              render: ({ row, updateRow }) => (
                <Input
                  placeholder="Optional button label"
                  value={row.label ?? ""}
                  onChange={(event) => updateRow({ ...row, label: event.target.value })}
                />
              ),
            },
            {
              className: "w-80 align-top",
              header: "Command",
              render: ({ row, updateRow, rowIndex }) => (
                <CommandSelector
                  id={`${field.name}.${rowIndex}.command`}
                  commands={commands}
                  value={row.command}
                  onChange={(command) => updateRow({ ...row, command })}
                />
              ),
            },
            {
              className: "align-top",
              header: "Arguments",
              render: ({ row, updateRow }) => (
                <div className="space-y-2">
                  {(row.args ?? []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">No arguments configured.</div>
                  ) : (
                    <div className="space-y-2">
                      {(row.args ?? []).map((arg: CommandButtonArgument, argIndex: number) => (
                        <div
                          key={`${arg.name}-${argIndex}`}
                          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2"
                        >
                          <Input
                            placeholder="Argument name"
                            value={arg.name}
                            onChange={(event) =>
                              updateRow({
                                ...row,
                                args: (row.args ?? []).map(
                                  (currentArg: CommandButtonArgument, currentArgIndex: number) =>
                                    currentArgIndex === argIndex
                                      ? { ...currentArg, name: event.target.value }
                                      : currentArg,
                                ),
                              })
                            }
                          />
                          <Input
                            placeholder="Value"
                            value={arg.value}
                            onChange={(event) =>
                              updateRow({
                                ...row,
                                args: (row.args ?? []).map(
                                  (currentArg: CommandButtonArgument, currentArgIndex: number) =>
                                    currentArgIndex === argIndex
                                      ? { ...currentArg, value: event.target.value }
                                      : currentArg,
                                ),
                              })
                            }
                          />
                          <Button
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              updateRow({
                                ...row,
                                args: (row.args ?? []).filter(
                                  (_arg: CommandButtonArgument, currentArgIndex: number) =>
                                    currentArgIndex !== argIndex,
                                ),
                              })
                            }
                          >
                            <Trash2Icon />
                            <span className="sr-only">Remove argument</span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() =>
                      updateRow({
                        ...row,
                        args: [...(row.args ?? []), makeArgument()],
                      })
                    }
                  >
                    <PlusIcon />
                    Add argument
                  </Button>
                </div>
              ),
            },
          ]}
          createRow={makeEntry}
          emptyMessage="No command buttons configured."
          value={entries}
          onChange={field.handleChange}
        />
      );
    })
    .render();
}

function CommandSelector({
  commands,
  id,
  value,
  onChange,
}: {
  commands: ReadonlyArray<CommandDefinition>;
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const selectedCommand = commands.find(
    (command) => command.qualifiedName === value || command.name === value,
  );

  return (
    <Combobox<CommandDefinition>
      id={id}
      isItemEqualToValue={(item, comboboxValue) =>
        item.qualifiedName === comboboxValue.qualifiedName
      }
      itemToStringLabel={(item) => formatCommandDisplayName(item.qualifiedName, item)}
      itemToStringValue={(item) => item.qualifiedName}
      items={commands}
      name={id}
      onValueChange={(nextValue) => {
        if (nextValue) {
          onChange(nextValue.qualifiedName);
        }
      }}
      value={selectedCommand ?? null}
    >
      <ComboboxInput placeholder="Select a command" />
      <ComboboxContent>
        <ComboboxEmpty>No items found.</ComboboxEmpty>
        <ComboboxList>
          {(item: CommandDefinition) => (
            <ComboboxItem key={item.qualifiedName} value={item}>
              {formatCommandDisplayName(item.qualifiedName, item)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
