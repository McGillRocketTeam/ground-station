import type { PrimarySystem } from "@mrt/media-state";
import type { LivelinePoint } from "liveline";

import { useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { ParameterInfo, type ParameterValue } from "@mrt/yamcs-effect";
import { DateTime } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { Liveline } from "liveline";
import { useEffectEvent, useState } from "react";

import { OverlayCard } from "../components/overlay-card.tsx";
import { parameterSubscriptionAtom } from "../state/parameter-atoms.ts";
import { flightComputerParameter } from "../state/parameter-path.ts";

const CHART_WINDOW_SECONDS = 120;
const LIVELINE_EDGE_FADE_WIDTH = 40;

type ParameterUpdate = {
  readonly info: typeof ParameterInfo.Type;
  readonly value: ParameterValue;
};

export function AltitudeChartCard({ primarySystem }: { primarySystem: PrimarySystem }) {
  const altitudeParameter = flightComputerParameter(primarySystem, "barometer_altitude_from_pad");
  const flightStage = useAtomValue(
    parameterSubscriptionAtom(flightComputerParameter(primarySystem, "flight_stage")),
  );
  const landed = AsyncResult.match(flightStage, {
    onInitial: () => false,
    onFailure: () => false,
    onSuccess: ({ value: update }) => {
      const stage = update.value.rawValue ?? update.value.engValue;
      return "value" in stage && Number(stage.value) === 5;
    },
  });
  const [data, setData] = useState<Array<LivelinePoint>>([]);
  const [value, setValue] = useState(0);
  const [unit, setUnit] = useState("");
  const onAltitude = useEffectEvent((result: AsyncResult.AsyncResult<ParameterUpdate, unknown>) => {
    if (landed || result._tag !== "Success") return;

    const engineeringValue = result.value.value.engValue;
    const altitude = "value" in engineeringValue ? Number(engineeringValue.value) : Number.NaN;

    if (!Number.isFinite(altitude)) return;

    const time =
      DateTime.toEpochMillis(
        result.value.value.acquisitionTime ?? result.value.value.generationTime,
      ) / 1_000;

    setValue(altitude);
    setUnit(result.value.info.type.unitSet?.map((entry) => entry.unit).join("") ?? "");
    setData((points) => [
      ...points.filter((point) => point.time >= time - CHART_WINDOW_SECONDS),
      { time, value: altitude },
    ]);
  });

  useAtomSubscribe(parameterSubscriptionAtom(altitudeParameter), onAltitude);

  return (
    <OverlayCard title="Altitude Profile">
      <div className="relative aspect-[2/1] w-[30rem] border border-white/25 bg-black/75">
        <Liveline
          badge={false}
          color="#FFFFFF"
          data={data}
          fill={false}
          formatTime={() => ""}
          formatValue={() => ""}
          loading={data.length === 0}
          momentum={false}
          padding={{ top: 36, bottom: 16, left: -LIVELINE_EDGE_FADE_WIDTH, right: 8 }}
          paused={landed}
          pulse={false}
          scrub={false}
          theme="dark"
          value={value}
          window={CHART_WINDOW_SECONDS}
        />
        <div className="absolute top-2 right-2 text-base tabular-nums">
          {data.length === 0
            ? "N/A"
            : value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          {data.length > 0 && unit ? ` ${unit}` : ""}
        </div>
      </div>
    </OverlayCard>
  );
}
