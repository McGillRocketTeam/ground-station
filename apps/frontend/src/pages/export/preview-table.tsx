import { useAtomValue } from "@effect/atom-react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type Table,
} from "@tanstack/react-table";
import {
  useVirtualizer,
  type VirtualItem,
  type Virtualizer,
} from "@tanstack/react-virtual";
import { Cause } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import React, { useMemo } from "react";

import {
  exportPreviewCsvAtom,
  exportPreviewModelAtom,
  exportPreviewUrlAtom,
} from "./state";

type CsvPreviewRow = {
  id: number;
  cells: ReadonlyArray<string>;
};

export function ExportPreviewTable() {
  const url = useAtomValue(exportPreviewUrlAtom);
  const csvResult = useAtomValue(exportPreviewCsvAtom);
  const model = useAtomValue(exportPreviewModelAtom);
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  const data = useMemo(
    () => model.rows.map((cells, index) => ({ id: index, cells })),
    [model.rows],
  );

  const columns = useMemo<ColumnDef<CsvPreviewRow>[]>(
    () => [
      {
        id: "row-number",
        header: () => "#",
        size: 56,
        cell: ({ row }) => row.index + 1,
      },
      ...model.columns.map((column, index) => ({
        id: `column-${index}`,
        header: () => column,
        accessorFn: (row: CsvPreviewRow) => row.cells[index] ?? "",
        cell: (info) => info.getValue<string>(),
        size: 180,
      })),
    ],
    [model.columns],
  );

  const table = useReactTable({
    data,
    columns,
    defaultColumn: {
      size: 180,
      minSize: 80,
    },
    getCoreRowModel: getCoreRowModel(),
  });

  if (!url) {
    return (
      <div className="grid h-full min-h-40 place-items-center border border-border text-xs text-muted-foreground">
        Select an instance to build the export preview.
      </div>
    );
  }

  return AsyncResult.builder(csvResult)
    .onInitial(() => (
      <div className="grid h-full min-h-40 place-items-center border border-border text-xs text-muted-foreground">
        Loading export preview...
      </div>
    ))
    .onFailure((cause) => (
      <pre className="h-full overflow-auto border border-destructive p-3 text-xs text-destructive">
        {Cause.pretty(cause)}
      </pre>
    ))
    .onSuccess(() => {
      if (model.columns.length === 0) {
        return (
          <div className="grid h-full min-h-40 place-items-center border border-border text-xs text-muted-foreground">
            No preview data returned.
          </div>
        );
      }

      return (
        <div className="flex h-full min-h-0 flex-col gap-2">
          <div className="text-xs text-muted-foreground">
            {model.rows.length.toLocaleString()} rows
          </div>
          <div
            ref={tableContainerRef}
            className="min-h-0 flex-1 overflow-auto border border-border"
          >
            <table className="grid border-collapse text-xs">
              <thead className="sticky top-0 z-10 grid bg-background">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="flex w-full">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="flex border-r border-b border-border px-2 py-1 text-left font-medium whitespace-nowrap last:border-r-0"
                        style={{ width: header.getSize() }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <VirtualizedTableBody
                table={table}
                tableContainerRef={tableContainerRef}
              />
            </table>
          </div>
        </div>
      );
    })
    .render();
}

function VirtualizedTableBody({
  table,
  tableContainerRef,
}: {
  table: Table<CsvPreviewRow>;
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: rows.length,
    estimateSize: () => 29,
    getScrollElement: () => tableContainerRef.current,
    overscan: 12,
  });

  return (
    <tbody
      className="relative grid"
      style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const row = rows[virtualRow.index];

        return (
          <VirtualizedTableRow
            key={row.id}
            row={row}
            virtualRow={virtualRow}
            rowVirtualizer={rowVirtualizer}
          />
        );
      })}
    </tbody>
  );
}

function VirtualizedTableRow({
  row,
  virtualRow,
  rowVirtualizer,
}: {
  row: Row<CsvPreviewRow>;
  virtualRow: VirtualItem;
  rowVirtualizer: Virtualizer<HTMLDivElement, HTMLTableRowElement>;
}) {
  return (
    <tr
      data-index={virtualRow.index}
      ref={(node) => rowVirtualizer.measureElement(node)}
      className="absolute flex w-full"
      style={{ transform: `translateY(${virtualRow.start}px)` }}
    >
      {row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          className="flex border-r border-b border-border px-2 py-1 whitespace-nowrap last:border-r-0"
          style={{ width: cell.column.getSize() }}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}
