import type { AnyFieldApi } from "@tanstack/react-form";

import type { GaugeVisualRange } from "@/cards/gauge/config";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FormTable } from "./form-table";

type GaugeVisualRangeFieldValue = {
  end: string;
  pattern: GaugeVisualRange["pattern"];
  start: string;
};

const RANGE_PATTERNS: ReadonlyArray<GaugeVisualRange["pattern"]> = [
  "success",
  "success-chevron",
  "yellow",
  "yellow-chevron",
  "red",
  "red-chevron",
];

export type DashboardGaugeVisualRangesFieldApi = AnyFieldApi & {
  state: AnyFieldApi["state"] & {
    value: ReadonlyArray<GaugeVisualRangeFieldValue> | undefined;
  };
  handleChange: (value: ReadonlyArray<GaugeVisualRangeFieldValue>) => void;
};

function numberInputValue(value: string | number) {
  return String(value);
}

export function DashboardGaugeVisualRangesField({
  field,
}: {
  field: DashboardGaugeVisualRangesFieldApi;
}) {
  return (
    <FormTable<GaugeVisualRangeFieldValue>
      addLabel="Add range"
      columns={[
        {
          header: "Min",
          render: ({ row, updateRow }) => (
            <Input
              type="number"
              step="any"
              value={numberInputValue(row.start)}
              onChange={(event) =>
                updateRow({
                  ...row,
                  start: event.target.value,
                })
              }
            />
          ),
        },
        {
          header: "Max",
          render: ({ row, updateRow }) => (
            <Input
              type="number"
              step="any"
              value={numberInputValue(row.end)}
              onChange={(event) =>
                updateRow({
                  ...row,
                  end: event.target.value,
                })
              }
            />
          ),
        },
        {
          header: "Type",
          render: ({ row, updateRow }) => (
            <Select
              value={row.pattern}
              onValueChange={(pattern) =>
                updateRow({
                  ...row,
                  pattern: pattern as GaugeVisualRange["pattern"],
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_PATTERNS.map((pattern) => (
                  <SelectItem key={pattern} value={pattern}>
                    {pattern}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ),
        },
      ]}
      createRow={() => ({ start: "0", end: "0", pattern: "red-chevron" })}
      emptyMessage="No visual ranges configured."
      value={field.state.value ?? []}
      onChange={field.handleChange}
    />
  );
}
