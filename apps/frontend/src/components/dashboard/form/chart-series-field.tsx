import type { AnyFieldApi } from "@tanstack/react-form";

import type { ChartSeriesConfig } from "@/cards/chart-card/config";

import { Input } from "@/components/ui/input";

import { FormTable } from "./form-table";
import { ParameterSelector } from "./parameter-field";

type ChartSeriesFieldValue = Omit<ChartSeriesConfig, "offset"> & {
  offset?: number | string;
};

export type DashboardChartSeriesFieldApi = AnyFieldApi & {
  state: AnyFieldApi["state"] & {
    value: ReadonlyArray<ChartSeriesConfig> | undefined;
  };
  handleChange: (value: ReadonlyArray<ChartSeriesFieldValue>) => void;
};

export function DashboardChartSeriesField({
  field,
}: {
  field: DashboardChartSeriesFieldApi;
}) {
  return (
    <FormTable<ChartSeriesFieldValue>
      addLabel="Add series"
      columns={[
        {
          className: "min-w-64",
          header: "Parameter",
          render: ({ row, updateRow }) => (
            <ParameterSelector
              value={row.parameter ? { qualifiedName: row.parameter } : null}
              onChange={(parameter) =>
                updateRow({ ...row, parameter: parameter.qualifiedName })
              }
            />
          ),
        },
        {
          header: "Label",
          render: ({ row, updateRow }) => (
            <Input
              value={row.label}
              onChange={(event) =>
                updateRow({ ...row, label: event.target.value })
              }
            />
          ),
        },
        {
          className: "w-28",
          header: "Offset",
          render: ({ row, updateRow }) => (
            <Input
              type="number"
              step="any"
              value={row.offset ?? ""}
              onChange={(event) =>
                updateRow({
                  ...row,
                  offset: event.target.value,
                })
              }
            />
          ),
        },
        {
          className: "w-32",
          header: "Color",
          render: ({ row, updateRow }) => (
            <div className="flex items-center gap-2">
              <Input
                className="h-7 w-10 p-1"
                type="color"
                value={row.color}
                onChange={(event) =>
                  updateRow({ ...row, color: event.target.value })
                }
              />
              <Input
                value={row.color}
                onChange={(event) =>
                  updateRow({ ...row, color: event.target.value })
                }
              />
            </div>
          ),
        },
      ]}
      createRow={() => ({ color: "#2563eb", label: "", parameter: "" })}
      emptyMessage="No series configured."
      value={field.state.value ?? []}
      onChange={field.handleChange}
    />
  );
}
