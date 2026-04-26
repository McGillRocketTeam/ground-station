import type { AnyFieldApi } from "@tanstack/react-form";

import type { ChartSeriesConfig } from "@/cards/chart-card/config";

import { DEFAULT_SERIES_CONFIGS } from "@/cards/chart-card/config";
import { Input } from "@/components/ui/input";

import { FormTable } from "./form-table";
import { ParameterSelector } from "./parameter-field";

export type DashboardChartSeriesFieldApi = AnyFieldApi & {
  state: AnyFieldApi["state"] & {
    value: ReadonlyArray<ChartSeriesConfig> | undefined;
  };
  handleChange: (value: ReadonlyArray<ChartSeriesConfig>) => void;
};

function createSeriesRow(index: number): ChartSeriesConfig {
  return (
    DEFAULT_SERIES_CONFIGS[index] ?? {
      color: "#2563eb",
      label: "Series",
      parameter: "",
    }
  );
}

export function DashboardChartSeriesField({
  field,
}: {
  field: DashboardChartSeriesFieldApi;
}) {
  return (
    <FormTable<ChartSeriesConfig>
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
      createRow={() => createSeriesRow(field.state.value?.length ?? 0)}
      emptyMessage="No series configured."
      value={field.state.value ?? []}
      onChange={field.handleChange}
    />
  );
}
