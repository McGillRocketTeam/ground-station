import { PlusIcon, Redo2Icon, Trash2Icon, Undo2Icon } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type FormTableColumn<T> = {
  header: string;
  className?: string;
  render: (props: {
    row: T;
    rowIndex: number;
    updateRow: (next: T) => void;
  }) => ReactNode;
};

type FormTableHistory<T> = {
  past: ReadonlyArray<ReadonlyArray<T>>;
  future: ReadonlyArray<ReadonlyArray<T>>;
};

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
  value,
}: {
  addLabel?: string;
  columns: ReadonlyArray<FormTableColumn<T>>;
  createRow: () => T;
  emptyMessage?: string;
  getRowKey?: (row: T, rowIndex: number) => string;
  onChange: (value: ReadonlyArray<T>) => void;
  value: ReadonlyArray<T>;
}) {
  const rowIdsRef = useRef<ReadonlyArray<string>>(
    value.map(() => crypto.randomUUID()),
  );
  const [history, setHistory] = useState<FormTableHistory<T>>({
    past: [],
    future: [],
  });

  if (rowIdsRef.current.length !== value.length) {
    rowIdsRef.current = value.map(
      (_, index) => rowIdsRef.current[index] ?? crypto.randomUUID(),
    );
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
    rowIdsRef.current = rowIdsRef.current.filter(
      (_, index) => index !== rowIndex,
    );
    changeValue(value.filter((_, index) => index !== rowIndex));
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

  return (
    <div className="space-y-2" onKeyDownCapture={handleKeyDownCapture}>
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.header} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
              <TableHead className="w-12 text-right">Actions</TableHead>
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
              value.map((row, rowIndex) => (
                <TableRow
                  key={
                    getRowKey?.(row, rowIndex) ?? rowIdsRef.current[rowIndex]
                  }
                >
                  {columns.map((column) => (
                    <TableCell key={column.header} className={column.className}>
                      {column.render({
                        row,
                        rowIndex,
                        updateRow: (next) => updateRow(rowIndex, next),
                      })}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => {
            rowIdsRef.current = [...rowIdsRef.current, crypto.randomUUID()];
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
