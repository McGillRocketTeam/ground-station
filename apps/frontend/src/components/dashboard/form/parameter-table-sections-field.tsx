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
import { GripVerticalIcon } from "lucide-react";

import type { ParameterTableSection } from "@/cards/parameter-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FormTable, FormTableDragHandle } from "./form-table";
import { ParameterSelector } from "./parameter-field";

export type DashboardParameterTableSectionsFieldApi = AnyFieldApi & {
  state: AnyFieldApi["state"] & {
    value: ReadonlyArray<ParameterTableSection> | undefined;
  };
  handleChange: (value: ReadonlyArray<ParameterTableSection>) => void;
};

function SortableParameter({ parameter, remove }: { parameter: string; remove: () => void }) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: parameter,
  });

  return (
    <div
      ref={setNodeRef}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1"
      style={{
        opacity: isDragging ? 0.5 : undefined,
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      <Button
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${parameter}`}
        className="touch-none cursor-grab active:cursor-grabbing"
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <GripVerticalIcon />
      </Button>
      <span className="truncate text-right" title={parameter}>
        {parameter}
      </span>
      <Button size="xs" type="button" variant="ghost" onClick={remove}>
        Remove
      </Button>
    </div>
  );
}

function SortableParameters({
  parameters,
  onChange,
}: {
  parameters: ReadonlyArray<string>;
  onChange: (parameters: ReadonlyArray<string>) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    const oldIndex = parameters.indexOf(String(active.id));
    const newIndex = parameters.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    onChange(arrayMove([...parameters], oldIndex, newIndex));
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
      sensors={sensors}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={[...parameters]} strategy={verticalListSortingStrategy}>
        <div className="grid max-h-64 gap-1 overflow-y-auto pr-2">
          {parameters.map((parameter) => (
            <SortableParameter
              key={parameter}
              parameter={parameter}
              remove={() => onChange(parameters.filter((item) => item !== parameter))}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export function DashboardParameterTableSectionsField({
  field,
}: {
  field: DashboardParameterTableSectionsFieldApi;
}) {
  const sections = field.state.value ?? [];

  return (
    <FormTable<ParameterTableSection>
      addLabel="Add section"
      columns={[
        {
          className: "w-72 align-top",
          header: "Section",
          render: ({ row, updateRow }) => (
            <div className="grid gap-2">
              <Input
                value={row.title}
                onChange={(event) => updateRow({ ...row, title: event.target.value })}
              />
              <FormTableDragHandle label={`Reorder ${row.title || "section"}`} />
            </div>
          ),
        },
        {
          className: "align-top",
          header: "Parameters",
          render: ({ row, updateRow }) => {
            const selected = new Set(row.parameters);

            return (
              <div className="grid gap-2">
                <ParameterSelector
                  value={null}
                  onChange={(parameter) => {
                    if (selected.has(parameter.qualifiedName)) return;

                    updateRow({
                      ...row,
                      parameters: [...row.parameters, parameter.qualifiedName],
                    });
                  }}
                />
                {row.parameters.length === 0 ? (
                  <div className="text-muted-foreground">No parameters added.</div>
                ) : (
                  <SortableParameters
                    parameters={row.parameters}
                    onChange={(parameters) => updateRow({ ...row, parameters })}
                  />
                )}
              </div>
            );
          },
        },
      ]}
      createRow={() => ({ title: "", parameters: [] })}
      emptyMessage="No sections configured."
      reorderable
      value={sections}
      onChange={field.handleChange}
    />
  );
}
