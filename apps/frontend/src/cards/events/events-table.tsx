import {
  DataGridBody,
  DataGridHead,
  DataGridHeader,
  DataGridRow,
  DataGridSearch,
} from "@/components/ui/data-grid";
import { cn } from "@/lib/utils";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { memo, useState } from "react";
import { Fragment } from "react/jsx-runtime";
import type { Event } from ".";

const HeaderButton = memo(function HeaderButton({
  children,
  isSorted,
  onToggleSort,
  className,
}: {
  children: React.ReactNode;
  isSorted: false | "asc" | "desc";
  onToggleSort: () => void;
  className?: string;
}) {
  return (
    <DataGridHead className={className}>
      <button
        className={cn(
          "flex h-full w-full cursor-pointer flex-row items-center gap-1 uppercase",
          className,
        )}
        onClick={onToggleSort}
      >
        {children}
        {isSorted === "asc" ? (
          <ArrowUp className="size-3" />
        ) : isSorted === "desc" ? (
          <ArrowDown className="size-3" />
        ) : null}
      </button>
    </DataGridHead>
  );
});

const columns: ColumnDef<Event>[] = [
  {
    accessorKey: "severity",
    header: ({ column }) => (
      <HeaderButton
        className="col-span-2"
        isSorted={column.getIsSorted()}
        onToggleSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Severity
      </HeaderButton>
    ),
  },
  {
    accessorKey: "source",
    header: ({ column }) => (
      <HeaderButton
        isSorted={column.getIsSorted()}
        onToggleSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Source
      </HeaderButton>
    ),
  },
  {
    accessorKey: "message",
    header: () => <DataGridHead>MESSAGE</DataGridHead>,
  },
  {
    accessorKey: "generationTime",
    header: ({ column }) => (
      <HeaderButton
        className="justify-end"
        isSorted={column.getIsSorted()}
        onToggleSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Generation Time
      </HeaderButton>
    ),
  },
];

const EventRow = memo(function EventRow({
  event,
  isSelected,
}: {
  event: Event;
  isSelected: boolean;
}) {
  const { severity, source, generationTime, message } = event;

  return (
    <DataGridRow
      className={cn(
        "group text-sm",
        severity === "INFO" && "text-muted-foreground/50",
        severity === "WARNING" &&
          "text-orange-text *:bg-[color-mix(in_oklab,var(--color-orange-text)_8%,var(--background))]",
        (severity === "DISTRESS" || severity === "SEVERE") &&
          "dark:text-error-foreground text-error dark:*:bg-error *:bg-[color-mix(in_oklab,var(--color-error)_15%,var(--background))]",
        "hover:text-white-text",
      )}
      data-state={isSelected && "selected"}
    >
      <div className="col-span-2 text-right">{severity}</div>
      <div className="text-center">{source}</div>
      <div className="line-clamp-2 text-ellipsis">{message}</div>
      <div className="text-right">{generationTime.toLocaleString()}</div>
    </DataGridRow>
  );
});

export function EventsTable({ events }: { events: Array<Event> }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: events,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-[1.5rem_auto_auto_1fr_auto] gap-px">
          <DataGridHeader className="bg-background sticky top-0 z-10">
            <DataGridHead className="grid place-items-center">
              <Search className="text-muted-foreground size-3" />
            </DataGridHead>

            <DataGridSearch
              placeholder="Filter messages..."
              className="col-span-4"
              value={(table.getColumn("message")?.getFilterValue() as string) ?? ""}
              onChange={(value) => table.getColumn("message")?.setFilterValue(value)}
            />

            {table.getHeaderGroups().map((headerGroup) => (
              <Fragment key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <Fragment key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </DataGridHeader>
          <DataGridBody className="gap-0">
            {table.getRowModel().rows?.length ? (
              table
                .getRowModel()
                .rows.map((row) => (
                  <EventRow key={row.id} event={row.original} isSelected={row.getIsSelected()} />
                ))
            ) : (
              <DataGridRow>
                <div className="col-span-full grid h-24 place-items-center">No results.</div>
              </DataGridRow>
            )}
          </DataGridBody>
        </div>
      </div>
    </div>
  );
}
