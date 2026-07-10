import type { LivelinePoint } from "liveline";

import { useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { DateTime, Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { Liveline } from "liveline";
import { useCallback, useId } from "react";

import type { LiveParameterUpdate } from "@/lib/atom";

import { resolveTheme, useTheme } from "@/components/theme-provider";
import { parameterSubscriptionAtom } from "@/lib/atom";
import { makeCard } from "@/lib/cards";

const LIVE_PARAMETER = "/SystemA/Rocket/gps_altitude" as const;
const DEFAULT_WINDOW_SECONDS = 30;
const WINDOW_OPTIONS = [
  { label: "15s", secs: 15 },
  { label: "30s", secs: 30 },
  { label: "60s", secs: 60 },
] as const;
const MAX_RETENTION_SECONDS = Math.max(...WINDOW_OPTIONS.map((option) => option.secs)) * 5;
const CHART_COLOR = "#FD9900";

type LiveChartState = {
  readonly points: Array<LivelinePoint>;
  readonly value: number | undefined;
};

export const LiveChartCard = makeCard({
  id: "live-chart-card",
  name: "Live Chart",
  schema: Schema.Struct({}),
  component: () => <LiveChart />,
});

const liveChartStateAtom = Atom.family((_scopeId: string) =>
  Atom.make<LiveChartState>({
    points: [],
    value: undefined,
  }),
);

const liveChartWindowAtom = Atom.family((_scopeId: string) => Atom.make(DEFAULT_WINDOW_SECONDS));

const liveChartModelAtom = Atom.family((scopeId: string) =>
  Atom.make((get) => {
    const state = get(liveChartStateAtom(scopeId));
    const window = get(liveChartWindowAtom(scopeId));

    return {
      data: state.points,
      loading: state.value === undefined,
      value: state.value ?? 0,
      window,
    };
  }),
);

const appendLiveChartPointAtom = Atom.family((scopeId: string) =>
  Atom.fn(
    Effect.fn((point: LivelinePoint, get: Atom.FnContext) =>
      Effect.sync(() => {
        const state = get(liveChartStateAtom(scopeId));
        const cutoff = point.time - MAX_RETENTION_SECONDS;
        const points = [...state.points, point]
          .filter((entry) => entry.time >= cutoff)
          .sort((left, right) => left.time - right.time);

        get.set(liveChartStateAtom(scopeId), {
          points,
          value: point.value,
        });
      }),
    ),
  ),
);

function extractNumericValue(update: LiveParameterUpdate) {
  const engValue = update.value.engValue;
  if (engValue && typeof engValue === "object" && "value" in engValue) {
    const numericValue = Number(engValue.value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  const rawValue = update.value.rawValue;
  if (rawValue && typeof rawValue === "object" && "value" in rawValue) {
    const numericValue = Number(rawValue.value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return undefined;
}

function LiveChart() {
  const scopeId = useId();
  const { theme } = useTheme();
  const model = useAtomValue(liveChartModelAtom(scopeId));
  const setWindow = useAtomSet(liveChartWindowAtom(scopeId));
  const appendPoint = useAtomSet(appendLiveChartPointAtom(scopeId));

  const handleUpdate = useCallback(
    (result: AsyncResult.AsyncResult<LiveParameterUpdate, unknown>) => {
      if (result._tag !== "Success") {
        return;
      }

      const numericValue = extractNumericValue(result.value);
      if (numericValue === undefined) {
        return;
      }

      appendPoint({
        time: DateTime.toDate(result.value.value.generationTime).getTime() / 1000,
        value: numericValue,
      });
    },
    [appendPoint],
  );

  useAtomSubscribe(parameterSubscriptionAtom(LIVE_PARAMETER), handleUpdate);

  return (
    <div className="h-full w-full">
      <Liveline
        color={CHART_COLOR}
        data={model.data}
        loading={model.loading}
        onWindowChange={setWindow}
        showValue
        theme={resolveTheme(theme)}
        value={model.value}
        window={model.window}
        windows={[...WINDOW_OPTIONS]}
      />
    </div>
  );
}
