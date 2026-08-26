import type { ArgumentInfo, CommandInfo } from "@mrt/yamcs-effect";
import type { AnyFieldApi } from "@tanstack/react-form";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAtomValue } from "@effect/atom-react";
import { useForm } from "@tanstack/react-form";
import { Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { GripVerticalIcon } from "lucide-react";
import { useRef, useState } from "react";

import { formatCommandDisplayName } from "@/cards/command-history/command-display";
import { completeControlBoxEntries, getControlBoxControl } from "@/cards/control-box/config";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  fieldLabelClassName,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";
import {
  type CommandArrayEntry,
  type CommandEntry,
  normalizeCommandEntry,
} from "@/lib/command-config";
import { createId } from "@/lib/utils";

type CommandDefinition = typeof CommandInfo.Type;
type ArgumentDefinition = typeof ArgumentInfo.Type;
type EditableCommandEntry = CommandEntry & { readonly localName?: string };

export type DashboardCommandArrayFieldApi = AnyFieldApi & {
  state: AnyFieldApi["state"] & {
    value: ReadonlyArray<CommandArrayEntry> | undefined;
  };
  handleChange: (value: ReadonlyArray<CommandArrayEntry>) => void;
};

export function DashboardCommandArrayField({
  allowLocalName = false,
  field,
}: {
  allowLocalName?: boolean;
  field: DashboardCommandArrayFieldApi;
}) {
  const instance = useAtomValue(selectedInstanceAtom);
  const [pendingCommand, setPendingCommand] = useState<CommandDefinition | null>(null);
  const commandsResult = useAtomValue(
    YamcsAtomHttpClient.query("mdb", "listCommands", {
      params: { instance },
      query: { details: true },
    }),
  );

  return AsyncResult.builder(commandsResult)
    .onInitial(() => <div>Loading Command Selector...</div>)
    .onSuccess(({ commands }) => {
      const configuredCommands: ReadonlyArray<CommandArrayEntry> = field.state.value ?? [];
      const selectedCommands: ReadonlyArray<CommandArrayEntry> = allowLocalName
        ? completeControlBoxEntries(configuredCommands)
        : configuredCommands;

      const addCommand = (entry: EditableCommandEntry) => {
        field.handleChange([...selectedCommands, entry]);
        setPendingCommand(null);
      };

      return (
        <div className="space-y-3">
          {!allowLocalName ? (
            <Combobox<CommandDefinition>
              id={field.name}
              isItemEqualToValue={(item, value) => item.qualifiedName === value.qualifiedName}
              itemToStringLabel={(item) => formatCommandDisplayName(item.qualifiedName, item)}
              itemToStringValue={(item) => item.qualifiedName}
              items={commands}
              name={field.name}
              onValueChange={(command) => {
                if (!command) return;

                if (getConfigurableArguments(command).length === 0) {
                  addCommand({ command: command.qualifiedName, args: {} });
                } else {
                  setPendingCommand(command);
                }
              }}
              value={null}
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
          ) : null}

          {selectedCommands.length === 0 ? (
            <div className="text-muted-foreground">No commands added.</div>
          ) : (
            <SortableCommands
              allowLocalName={allowLocalName}
              allowRemove={!allowLocalName}
              commands={selectedCommands}
              definitions={commands}
              onChange={field.handleChange}
            />
          )}

          {pendingCommand ? (
            <CommandArgumentsDialog
              key={pendingCommand.qualifiedName}
              command={pendingCommand}
              onCancel={() => setPendingCommand(null)}
              onSubmit={(args) =>
                addCommand({
                  command: pendingCommand.qualifiedName,
                  args,
                })
              }
            />
          ) : null}
        </div>
      );
    })
    .render();
}

function SortableCommand({
  allowLocalName,
  allowRemove,
  definition,
  id,
  value,
  onLocalNameChange,
  onRemove,
}: {
  allowLocalName: boolean;
  allowRemove: boolean;
  definition: CommandDefinition | undefined;
  id: string;
  value: CommandArrayEntry;
  onLocalNameChange: (localName: string) => void;
  onRemove: () => void;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id,
  });
  const entry = normalizeCommandEntry(value);
  const yamcsDisplayName = definition
    ? formatCommandDisplayName(definition.qualifiedName, definition)
    : entry.command;

  return (
    <div
      ref={setNodeRef}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-1 rounded-md border border-border px-1 py-1.5"
      style={{
        opacity: isDragging ? 0.5 : undefined,
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      <Button
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${entry.command}`}
        className="touch-none cursor-grab active:cursor-grabbing"
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <GripVerticalIcon />
      </Button>
      <div className="min-w-0">
        {allowLocalName ? (
          <Input
            aria-label={`Local name for ${entry.command}`}
            value={getLocalName(value) ?? yamcsDisplayName}
            onChange={(event) => onLocalNameChange(event.target.value)}
          />
        ) : (
          <div className="truncate" title={entry.command}>
            {yamcsDisplayName}
          </div>
        )}
        {Object.entries(entry.args).length > 0 ? (
          <dl className="mt-1 grid gap-0.5 text-xs text-muted-foreground">
            {Object.entries(entry.args).map(([name, argumentValue]) => (
              <div key={name} className="grid grid-cols-[auto_minmax(0,1fr)] gap-1">
                <dt>{name}=</dt>
                <dd className="truncate" title={argumentValue}>
                  {argumentValue}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      {allowRemove ? (
        <Button size="xs" type="button" variant="ghost" onClick={onRemove}>
          Remove
        </Button>
      ) : null}
    </div>
  );
}

function SortableCommands({
  allowLocalName,
  allowRemove,
  commands,
  definitions,
  onChange,
}: {
  allowLocalName: boolean;
  allowRemove: boolean;
  commands: ReadonlyArray<CommandArrayEntry>;
  definitions: ReadonlyArray<CommandDefinition>;
  onChange: (commands: ReadonlyArray<CommandArrayEntry>) => void;
}) {
  const itemIdsRef = useRef<ReadonlyArray<string>>([]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (itemIdsRef.current.length !== commands.length) {
    itemIdsRef.current = commands.map((_, index) => itemIdsRef.current[index] ?? createId());
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    const oldIndex = itemIdsRef.current.indexOf(String(active.id));
    const newIndex = itemIdsRef.current.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    itemIdsRef.current = arrayMove([...itemIdsRef.current], oldIndex, newIndex);
    onChange(arrayMove([...commands], oldIndex, newIndex));
  };

  const remove = (index: number) => {
    itemIdsRef.current = itemIdsRef.current.filter((_, itemIndex) => itemIndex !== index);
    onChange(commands.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
      sensors={sensors}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={[...itemIdsRef.current]} strategy={verticalListSortingStrategy}>
        <div className="grid max-h-64 gap-1 overflow-y-auto pr-2">
          {commands.map((value, index) => {
            const entry = normalizeCommandEntry(value);
            const isControlBoxControl = Boolean(getControlBoxControl(entry));
            const definition = definitions.find(
              (candidate) =>
                candidate.qualifiedName === entry.command || candidate.name === entry.command,
            );
            const id = itemIdsRef.current[index];

            return id ? (
              <SortableCommand
                key={id}
                allowLocalName={allowLocalName}
                allowRemove={allowRemove || (allowLocalName && !isControlBoxControl)}
                definition={definition}
                id={id}
                value={value}
                onLocalNameChange={(localName) =>
                  onChange(
                    commands.map((command, commandIndex) =>
                      commandIndex === index
                        ? { ...normalizeCommandEntry(command), localName }
                        : command,
                    ),
                  )
                }
                onRemove={() => remove(index)}
              />
            ) : null;
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function getLocalName(value: CommandArrayEntry) {
  return typeof value === "object" && "localName" in value && typeof value.localName === "string"
    ? value.localName
    : undefined;
}

function CommandArgumentsDialog({
  command,
  onCancel,
  onSubmit,
}: {
  command: CommandDefinition;
  onCancel: () => void;
  onSubmit: (args: Readonly<Record<string, string>>) => void;
}) {
  const arguments_ = getConfigurableArguments(command);
  const argumentFields: Record<string, Schema.Codec<string, string>> = Object.fromEntries(
    arguments_.map((argument) => [argument.name, makeArgumentValueSchema(argument)]),
  );
  const argumentSchema = Schema.Struct(argumentFields);
  const defaultValues: Record<string, string> = Object.fromEntries(
    arguments_.map((argument) => [argument.name, argument.initialValue ?? ""]),
  );
  const form = useForm({
    defaultValues,
    validators: {
      onChange: Schema.toStandardSchemaV1(argumentSchema),
    },
    onSubmit: ({ value }) => onSubmit(value),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Configure command arguments</DialogTitle>
          <DialogDescription>
            Enter arguments for {formatCommandDisplayName(command.qualifiedName, command)}.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            {arguments_.map((argument) => (
              <form.Field key={argument.name} name={argument.name}>
                {(argumentField) => {
                  const invalid =
                    argumentField.state.meta.isTouched && !argumentField.state.meta.isValid;

                  return (
                    <Field data-invalid={invalid}>
                      <label className={fieldLabelClassName} htmlFor={argumentField.name}>
                        {argument.name}
                        <span className="ml-1 font-normal text-muted-foreground">
                          ({argument.type.engType})
                        </span>
                      </label>
                      {argument.description ? (
                        <FieldDescription>{argument.description}</FieldDescription>
                      ) : null}
                      <Input
                        id={argumentField.name}
                        name={argumentField.name}
                        type={isNumericArgument(argument) ? "number" : "text"}
                        min={argument.type.rangeMin}
                        max={argument.type.rangeMax}
                        step={argument.type.engType === "integer" ? 1 : "any"}
                        value={argumentField.state.value}
                        aria-invalid={invalid}
                        onBlur={argumentField.handleBlur}
                        onChange={(event) => argumentField.handleChange(event.target.value)}
                      />
                      {invalid ? <FieldError errors={argumentField.state.meta.errors} /> : null}
                    </Field>
                  );
                }}
              </form.Field>
            ))}
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add command"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function makeArgumentValueSchema(argument: ArgumentDefinition): Schema.Codec<string, string> {
  return Schema.String.check(
    Schema.isMinLength(1, { message: "Enter a value" }),
    Schema.makeFilter<string>((value) => {
      if (!isNumericArgument(argument)) return undefined;

      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return "Enter a valid number";
      if (argument.type.engType === "integer" && !Number.isInteger(parsed)) {
        return "Enter a whole number";
      }

      const { rangeMin, rangeMax } = argument.type;
      if (rangeMin !== undefined && parsed < rangeMin) {
        return `Enter a value greater than or equal to ${rangeMin}`;
      }
      if (rangeMax !== undefined && parsed > rangeMax) {
        return `Enter a value less than or equal to ${rangeMax}`;
      }

      return undefined;
    }),
  );
}

function isNumericArgument(argument: ArgumentDefinition) {
  return (
    argument.type.engType === "float" ||
    argument.type.engType === "integer" ||
    argument.type.rangeMin !== undefined ||
    argument.type.rangeMax !== undefined
  );
}

function getConfigurableArguments(command: CommandDefinition): ReadonlyArray<ArgumentDefinition> {
  const hierarchy: Array<CommandDefinition> = [];
  const argumentsByName = new Map<string, ArgumentDefinition>();
  const fixedArguments = new Set<string>();
  let current: CommandDefinition | undefined = command;

  while (current) {
    hierarchy.unshift(current);
    current = current.baseCommand;
  }

  for (const definition of hierarchy) {
    for (const argument of definition.argument ?? []) {
      argumentsByName.set(argument.name, argument);
    }
    for (const assignment of definition.argumentAssignment ?? []) {
      fixedArguments.add(assignment.name);
    }
  }

  return Array.from(argumentsByName.values()).filter(
    (argument) => !fixedArguments.has(argument.name),
  );
}
