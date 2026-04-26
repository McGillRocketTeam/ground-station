import { useAtomValue } from "@effect/atom-react";
import { Cause } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

import { parameterSubscriptionAtom } from "@/lib/atom";
import { makeCard } from "@/lib/cards";

import {
  DEFAULT_GAUGE_PARAMETER,
  DEFAULT_VISUAL_RANGES,
  GaugeCardConfigSchema,
} from "./config";
import { Gauge } from "./gauge";

function extractNumericValue(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function GaugeParameter({
  label,
  max,
  min,
  parameter,
  ranges,
}: {
  label: string;
  max: number;
  min: number;
  parameter: string;
  ranges: typeof DEFAULT_VISUAL_RANGES;
}) {
  const result = useAtomValue(parameterSubscriptionAtom(parameter));

  return AsyncResult.match(result, {
    onInitial: () => (
      <Gauge label={label} max={max} min={min} ranges={ranges} value={0} />
    ),
    onFailure: ({ cause }) => (
      <pre className="p-4 text-center font-mono text-xs text-error uppercase">
        {Cause.pretty(cause)}
      </pre>
    ),
    onSuccess: ({ value }) => {
      const parameterValue =
        value.engValue && "value" in value.engValue
          ? value.engValue.value
          : value.rawValue && "value" in value.rawValue
            ? value.rawValue.value
            : undefined;

      return (
        <Gauge
          label={label}
          max={max}
          min={min}
          ranges={ranges}
          value={extractNumericValue(parameterValue) ?? 0}
        />
      );
    },
  });
}

export const GaugeCard = makeCard({
  id: "gauge",
  name: "Gauge Card",
  schema: GaugeCardConfigSchema,
  component: (props) => {
    const min = props.params.min ?? -32;
    const max = props.params.max ?? 32;
    const parameter =
      props.params.parameter?.qualifiedName ?? DEFAULT_GAUGE_PARAMETER;

    return (
      <div className="relative grid h-full w-full place-items-center">
        <GaugeParameter
          label={props.params.label ?? "G"}
          max={max}
          min={min}
          parameter={parameter}
          ranges={props.params.ranges ?? DEFAULT_VISUAL_RANGES}
        />
      </div>
    );
  },
});
