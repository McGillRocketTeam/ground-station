import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
  type SortingState,
} from "@tanstack/react-table";
import type { Event } from ".";
import {
  DataGridBody,
  DataGridHead,
  DataGridHeader,
  DataGridRow,
  DataGridSearch,
} from "@/components/ui/data-grid";
import { Fragment } from "react/jsx-runtime";
import { cn } from "@/lib/utils";
import { formatCommandDate } from "../parameter-chart/utils";
import { memo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";

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
        className="w-full h-full flex flex-row items-center justify-start gap-1 uppercase cursor-pointer"
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
        onToggleSort={() =>
          column.toggleSorting(column.getIsSorted() === "asc")
        }
      >
        Severity
      </HeaderButton>
    ),
    cell: ({ row }) => {
      return (
        <div className="text-right col-span-2">{row.original.severity}</div>
      );
    },
  },
  {
    accessorKey: "source",
    cell: ({ row }) => {
      return <div className="text-center">{row.original.source}</div>;
    },
    header: ({ column }) => (
      <HeaderButton
        isSorted={column.getIsSorted()}
        onToggleSort={() =>
          column.toggleSorting(column.getIsSorted() === "asc")
        }
      >
        Source
      </HeaderButton>
    ),
  },
  {
    accessorKey: "generationTime",
    cell: ({ row }) => {
      return (
        <div className="text-left">
          {formatCommandDate(row.original.generationTime)}
        </div>
      );
    },
    header: ({ column }) => (
      <HeaderButton
        isSorted={column.getIsSorted()}
        onToggleSort={() =>
          column.toggleSorting(column.getIsSorted() === "asc")
        }
      >
        Generation Time
      </HeaderButton>
    ),
  },
  {
    accessorKey: "message",
    header: () => <DataGridHead>MESSAGE</DataGridHead>,
    cell: ({ row }) => {
      return (
        <div className="text-ellipsis line-clamp-2">{row.original.message}</div>
      );
    },
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
        severity === "INFO" && "text-muted",
        severity === "WARNING" &&
          "*:bg-[color-mix(in_oklab,var(--color-orange-text)_8%,var(--background))]",
        (severity === "DISTRESS" || severity === "SEVERE") &&
          "text-error-foreground *:bg-error",
        "hover:text-white",
      )}
      data-state={isSelected && "selected"}
    >
      <div className="text-right col-span-2">{severity}</div>
      <div className="text-center">{source}</div>
      <div className="text-left">{formatCommandDate(generationTime)}</div>
      <div className="text-ellipsis line-clamp-2">{message}</div>
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
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-[1.5rem_auto_auto_auto_1fr] gap-px">
          <DataGridHeader className="sticky top-0 z-10 bg-background">
            <DataGridHead className="grid place-items-center">
              <Search className="size-3 text-muted-foreground" />
            </DataGridHead>

            <DataGridSearch
              placeholder="Filter messages..."
              className="col-span-4"
              value={
                (table.getColumn("message")?.getFilterValue() as string) ?? ""
              }
              onChange={(value) =>
                table.getColumn("message")?.setFilterValue(value)
              }
            />

            {table.getHeaderGroups().map((headerGroup) => (
              <Fragment key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <Fragment key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
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
                  <EventRow
                    key={row.id}
                    event={row.original}
                    isSelected={row.getIsSelected()}
                  />
                ))
            ) : (
              <DataGridRow>
                <div className="h-24 grid place-items-center col-span-full">
                  No results.
                </div>
              </DataGridRow>
            )}
          </DataGridBody>
        </div>
      </div>
    </div>
  );
}
