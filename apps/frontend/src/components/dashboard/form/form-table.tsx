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
import { GripVerticalIcon, PlusIcon, Redo2Icon, Trash2Icon, Undo2Icon } from "lucide-react";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, createId } from "@/lib/utils";

export type FormTableColumn<T> = {
  header: string;
  className?: string;
  render: (props: { row: T; rowIndex: number; updateRow: (next: T) => void }) => ReactNode;
};

type FormTableHistory<T> = {
  past: ReadonlyArray<ReadonlyArray<T>>;
  future: ReadonlyArray<ReadonlyArray<T>>;
};

type SortableHandleContextValue = Pick<ReturnType<typeof useSortable>, "attributes" | "listeners">;

const SortableHandleContext = createContext<SortableHandleContextValue | null>(null);

function SortableTableRow({ children, id }: { children: ReactNode; id: string }) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id,
  });

  return (
    <SortableHandleContext value={{ attributes, listeners }}>
      <TableRow
        ref={setNodeRef}
        style={{
          opacity: isDragging ? 0.5 : undefined,
          position: "relative",
          transform: CSS.Translate.toString(transform),
          transition,
          zIndex: isDragging ? 1 : undefined,
        }}
      >
        {children}
      </TableRow>
    </SortableHandleContext>
  );
}

export function FormTableDragHandle({ label = "Reorder row" }: { label?: string }) {
  const sortable = useContext(SortableHandleContext);
  if (!sortable) return null;

  return (
    <Button
      {...sortable.attributes}
      {...sortable.listeners}
      aria-label={label}
      className="touch-none cursor-grab active:cursor-grabbing"
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      <GripVerticalIcon />
    </Button>
  );
}

function isEditableTarget(target: EventTarget) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function FormTable<T>({
  addLabel = "Add row",
  columns,
  createRow,
  emptyMessage = "No rows configured.",
  getRowKey,
  onChange,
  reorderable = false,
  value,
}: {
  addLabel?: string;
  columns: ReadonlyArray<FormTableColumn<T>>;
  createRow: () => T;
  emptyMessage?: string;
  getRowKey?: (row: T, rowIndex: number) => string;
  onChange: (value: ReadonlyArray<T>) => void;
  reorderable?: boolean;
  value: ReadonlyArray<T>;
}) {
  const rowIdsRef = useRef<ReadonlyArray<string>>([]);
  const [history, setHistory] = useState<FormTableHistory<T>>({
    past: [],
    future: [],
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (rowIdsRef.current.length === 0) {
    rowIdsRef.current = value.map(() => createId());
  }

  if (rowIdsRef.current.length !== value.length) {
    rowIdsRef.current = value.map((_, index) => rowIdsRef.current[index] ?? createId());
  }

  const changeValue = (next: ReadonlyArray<T>) => {
    setHistory((current) => ({
      past: [...current.past, value],
      future: [],
    }));
    onChange(next);
  };

  const updateRow = (rowIndex: number, next: T) => {
    changeValue(value.map((row, index) => (index === rowIndex ? next : row)));
  };

  const removeRow = (rowIndex: number) => {
    rowIdsRef.current = rowIdsRef.current.filter((_, index) => index !== rowIndex);
    changeValue(value.filter((_, index) => index !== rowIndex));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    const oldIndex = rowIdsRef.current.indexOf(String(active.id));
    const newIndex = rowIdsRef.current.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    changeValue(arrayMove([...value], oldIndex, newIndex));
  };

  const undo = () => {
    setHistory((current) => {
      const previous = current.past.at(-1);

      if (!previous) {
        return current;
      }

      onChange(previous);

      return {
        past: current.past.slice(0, -1),
        future: [value, ...current.future],
      };
    });
  };

  const redo = () => {
    setHistory((current) => {
      const [next, ...future] = current.future;

      if (!next) {
        return current;
      }

      onChange(next);

      return {
        past: [...current.past, value],
        future,
      };
    });
  };

  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!event.metaKey && !event.ctrlKey) {
      return;
    }

    if (event.key.toLowerCase() !== "z") {
      return;
    }

    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();

    if (isEditableTarget(event.target)) {
      return;
    }

    event.preventDefault();

    if (event.shiftKey) {
      redo();
    } else {
      undo();
    }
  };

  const table = (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.header} className={cn(column.className, "align-middle")}>
              {column.header}
            </TableHead>
          ))}
          <TableHead className="w-24 px-3 text-right align-middle">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {value.length === 0 ? (
          <TableRow>
            <TableCell
              className="h-16 text-center text-muted-foreground"
              colSpan={columns.length + 1}
            >
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          value.map((row, rowIndex) => {
            const rowId =
              rowIdsRef.current[rowIndex] ?? getRowKey?.(row, rowIndex) ?? String(rowIndex);
            const cells = (
              <>
                {columns.map((column) => (
                  <TableCell key={column.header} className={column.className}>
                    {column.render({
                      row,
                      rowIndex,
                      updateRow: (next) => updateRow(rowIndex, next),
                    })}
                  </TableCell>
                ))}
                <TableCell className="w-24 px-3 text-right align-top">
                  <Button
                    aria-label="Remove row"
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                    onClick={() => removeRow(rowIndex)}
                  >
                    <Trash2Icon />
                  </Button>
                </TableCell>
              </>
            );

            return reorderable ? (
              <SortableTableRow key={rowId} id={rowId}>
                {cells}
              </SortableTableRow>
            ) : (
              <TableRow key={getRowKey?.(row, rowIndex) ?? rowId}>{cells}</TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-2" onKeyDownCapture={handleKeyDownCapture}>
      <div className="rounded-md border border-border">
        {reorderable ? (
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
            sensors={sensors}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={[...rowIdsRef.current]} strategy={verticalListSortingStrategy}>
              {table}
            </SortableContext>
          </DndContext>
        ) : (
          table
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => {
            rowIdsRef.current = [...rowIdsRef.current, createId()];
            changeValue([...value, createRow()]);
          }}
        >
          <PlusIcon />
          {addLabel}
        </Button>
        {history.past.length > 0 ? (
          <Button size="sm" type="button" variant="ghost" onClick={undo}>
            <Undo2Icon />
            Undo
          </Button>
        ) : null}
        {history.future.length > 0 ? (
          <Button size="sm" type="button" variant="ghost" onClick={redo}>
            <Redo2Icon />
            Redo
          </Button>
        ) : null}
      </div>
    </div>
  );
}
