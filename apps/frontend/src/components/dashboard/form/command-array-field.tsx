import type { CommandInfo } from "@mrt/yamcs-effect";
import type { AnyFieldApi } from "@tanstack/react-form";

import { useAtomValue } from "@effect/atom-react";
import { Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

import { formatCommandDisplayName } from "@/cards/command-history/command-display";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";

export const CommandArrayField = Schema.Array(Schema.String);

type CommandDefinition = typeof CommandInfo.Type;

export type DashboardCommandArrayFieldValue = Schema.Codec.Encoded<typeof CommandArrayField>;

export type DashboardCommandArrayFieldApi = AnyFieldApi & {
  state: AnyFieldApi["state"] & {
    value: DashboardCommandArrayFieldValue | undefined;
  };
  handleChange: (value: DashboardCommandArrayFieldValue) => void;
};

export function DashboardCommandArrayField({ field }: { field: DashboardCommandArrayFieldApi }) {
  const instance = useAtomValue(selectedInstanceAtom);
  const commandsResult = useAtomValue(
    YamcsAtomHttpClient.query("mdb", "listCommands", {
      params: { instance },
      query: {},
    }),
  );

  return AsyncResult.builder(commandsResult)
    .onInitial(() => <div>Loading Command Selector...</div>)
    .onSuccess(({ commands }) => {
      const selectedCommands = field.state.value ?? [];
      const selectedCommandNames = new Set(selectedCommands);
      const availableCommands = commands.filter(
        (command) =>
          !selectedCommandNames.has(command.qualifiedName) &&
          !selectedCommandNames.has(command.name),
      );

      return (
        <div className="space-y-3">
          <Combobox<CommandDefinition>
            id={field.name}
            isItemEqualToValue={(item, value) => item.qualifiedName === value.qualifiedName}
            itemToStringLabel={(item) => formatCommandDisplayName(item.qualifiedName, item)}
            itemToStringValue={(item) => item.qualifiedName}
            items={availableCommands}
            name={field.name}
            onValueChange={(value) => {
              if (!value || selectedCommandNames.has(value.qualifiedName)) {
                return;
              }

              field.handleChange([...selectedCommands, value.qualifiedName]);
            }}
            value={null}
          >
            <ComboboxInput
              disabled={availableCommands.length === 0}
              placeholder={
                availableCommands.length === 0 ? "All commands added" : "Select a command"
              }
            />
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

          {selectedCommands.length === 0 ? (
            <div className="text-muted-foreground">No commands added.</div>
          ) : (
            <div className="grid max-h-64 gap-1 overflow-y-auto pr-2">
              {selectedCommands.map((commandName, commandIndex) => (
                <div
                  key={`${commandName}-${commandIndex}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
                >
                  <span className="truncate" title={commandName}>
                    {commandName}
                  </span>
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      field.handleChange(
                        selectedCommands.filter((_, index) => index !== commandIndex),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    })
    .render();
}
