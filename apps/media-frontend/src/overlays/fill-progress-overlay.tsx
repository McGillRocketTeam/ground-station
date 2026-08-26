import type { PrimarySystem } from "@mrt/media-state";
import type { LivelinePoint } from "liveline";

import { useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { ParameterInfo, type ParameterValue as YamcsParameterValue } from "@mrt/yamcs-effect";
import { DateTime } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { Liveline } from "liveline";
import { motion } from "motion/react";
import { useEffectEvent, useState } from "react";

import { OverlayCard, overlayCardSpring } from "../components/overlay-card.tsx";
import { parameterSubscriptionAtom } from "../state/parameter-atoms.ts";
import { flightComputerParameter } from "../state/parameter-path.ts";
import { Unit } from "./telemetry-overlay.tsx";

const FULL_TANK_PRESSURE_PSI = 875;
const CHART_WINDOW_SECONDS = 30;
const TANK_ACCENT_COLOR = "#FFFFFF";
const LIVELINE_EDGE_FADE_WIDTH = 40;

type ParameterUpdate = {
  readonly info: typeof ParameterInfo.Type;
  readonly value: YamcsParameterValue;
};

export function FillProgressOverlay() {
  return (
    <main className="p-2">
      <FillProgressCard primarySystem="SystemA" />
    </main>
  );
}

export function FillProgressCard({ primarySystem }: { primarySystem: PrimarySystem }) {
  const pressureParameter = flightComputerParameter(primarySystem, "tank_pressure");
  const pressure = useAtomValue(parameterSubscriptionAtom(pressureParameter));
  const fillPercent = AsyncResult.match(pressure, {
    onInitial: () => undefined,
    onFailure: () => undefined,
    onSuccess: ({ value: update }) => {
      const engineeringValue = update.value.engValue;
      const value = "value" in engineeringValue ? Number(engineeringValue.value) : Number.NaN;

      return Number.isFinite(value)
        ? Math.min(100, Math.max(0, (value / FULL_TANK_PRESSURE_PSI) * 100))
        : undefined;
    },
  });

  return (
    <OverlayCard title="Fill Progress">
      <div className="flex flex-row items-end gap-6">
        <Rocket fillPercent={fillPercent} />

        <div className="min-w-80 flex flex-1 self-stretch flex-col justify-between">
          <div className="grid grid-cols-[auto_auto] gap-x-6 uppercase">
            <div>Fill/Dump Oxidizer Valve</div>
            <ValveValue qualifiedName={flightComputerParameter(primarySystem, "fdov_open")} />
            <div>MAIN OXIDIZER VALVE</div>
            <ValveValue qualifiedName={flightComputerParameter(primarySystem, "mov_open")} />
            <div>Vent Valve</div>
            <ValveValue qualifiedName={flightComputerParameter(primarySystem, "vent_open")} />
          </div>
          <PressureChart key={pressureParameter} pressureParameter={pressureParameter} />
          <div className="grid grid-cols-[auto_auto] gap-x-6 uppercase">
            <div>Pressure</div>
            <ParameterValue qualifiedName={pressureParameter} />
            <div>Temperature</div>
            <ParameterValue qualifiedName={flightComputerParameter(primarySystem, "tank_temp")} />
          </div>
        </div>
      </div>
    </OverlayCard>
  );
}

function PressureChart({ pressureParameter }: { pressureParameter: string }) {
  const [data, setData] = useState<Array<LivelinePoint>>([]);
  const [value, setValue] = useState(0);
  const onPressure = useEffectEvent((result: AsyncResult.AsyncResult<ParameterUpdate, unknown>) => {
    if (result._tag !== "Success") {
      return;
    }

    const engineeringValue = result.value.value.engValue;
    const pressure = "value" in engineeringValue ? Number(engineeringValue.value) : Number.NaN;

    if (!Number.isFinite(pressure)) {
      return;
    }

    const time =
      DateTime.toEpochMillis(
        result.value.value.acquisitionTime ?? result.value.value.generationTime,
      ) / 1_000;

    setValue(pressure);
    setData((points) => [
      ...points.filter((point) => point.time >= time - CHART_WINDOW_SECONDS),
      { time, value: pressure },
    ]);
  });

  useAtomSubscribe(parameterSubscriptionAtom(pressureParameter), onPressure);

  return (
    <div className="aspect-video relative w-full border border-white/25 bg-black/75">
      <Liveline
        badge={false}
        color={TANK_ACCENT_COLOR}
        data={data}
        fill={false}
        formatTime={() => ""}
        formatValue={() => ""}
        loading={data.length === 0}
        momentum={false}
        padding={{ top: 32, bottom: 16, left: -LIVELINE_EDGE_FADE_WIDTH, right: 8 }}
        pulse={false}
        scrub={false}
        theme="dark"
        value={value}
        window={CHART_WINDOW_SECONDS}
      />
      <div className="text-base top-2 left-2 absolute">TANK PRESSURE</div>
    </div>
  );
}

function ParameterValue({ qualifiedName }: { qualifiedName: string }) {
  const result = useAtomValue(parameterSubscriptionAtom(qualifiedName));

  return AsyncResult.match(result, {
    onInitial: () => <FormattedValue />,
    onFailure: () => <FormattedValue />,
    onSuccess: ({ value: update }) => {
      const engineeringValue = update.value.engValue;
      const value = "value" in engineeringValue ? Number(engineeringValue.value) : Number.NaN;
      const unit = update.info.type.unitSet?.map((entry) => entry.unit).join("");

      return <FormattedValue value={Number.isFinite(value) ? value : undefined} unit={unit} />;
    },
  });
}

function ValveValue({ qualifiedName }: { qualifiedName: string }) {
  const result = useAtomValue(parameterSubscriptionAtom(qualifiedName));

  return AsyncResult.match(result, {
    onInitial: () => <div className="text-right opacity-50">N/A</div>,
    onFailure: () => <div className="text-right opacity-50">N/A</div>,
    onSuccess: ({ value: update }) => {
      const engineeringValue = update.value.engValue;

      if (!("value" in engineeringValue) || typeof engineeringValue.value !== "boolean") {
        return <div className="text-right opacity-50">N/A</div>;
      }

      return <div className="text-right">{engineeringValue.value ? "OPEN" : "CLOSED"}</div>;
    },
  });
}

function FormattedValue({ value, unit }: { value?: number; unit?: string }) {
  const displayUnit = unit === "C" ? "°C" : unit;

  return (
    <div className="text-right tabular-nums whitespace-nowrap">
      <span
        className={
          value === undefined ? "inline-block min-w-[6ch] opacity-50" : "inline-block min-w-[6ch]"
        }
      >
        {value?.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          useGrouping: false,
        }) ?? "N/A"}
      </span>
      <Unit className="inline-block w-[3ch] text-left">
        {value === undefined ? "" : displayUnit}
      </Unit>
    </div>
  );
}

function Rocket({ fillPercent }: { fillPercent: number | undefined }) {
  const tankTop = 135;
  const tankHeight = 113;
  const fillHeight = tankHeight * ((fillPercent ?? 0) / 100);
  const fillTop = tankTop + tankHeight - fillHeight;

  return (
    <svg className="h-96" viewBox="0 0 41 334" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10.8126 329.027L0 334V326.728L10.7637 313.48C10.7637 313.48 10.5274 81.8218 10.7637 67.6609C11 53.5 14.0418 18.3884 20.5 0C26.9582 18.3884 30 51.5 30.2363 67.6609C30.4726 83.8218 30.2363 313.48 30.2363 313.48L41 326.728V334L30.1874 329.027H10.8126Z"
        fill="#ABABAB"
      />
      <mask
        id="mask0_238_26607"
        style={{ maskType: "alpha" }}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="41"
        height="334"
      >
        <path
          d="M10.8126 329.027L0 334V326.728L10.7637 313.48C10.7637 313.48 10.5274 81.8218 10.7637 67.6609C11 53.5 14.0418 18.3884 20.5 0C26.9582 18.3884 30 51.5 30.2363 67.6609C30.4726 83.8218 30.2363 313.48 30.2363 313.48L41 326.728V334L30.1874 329.027H10.8126Z"
          fill="#ABABAB"
        />
      </mask>
      <g mask="url(#mask0_238_26607)">
        <rect x="6" y="135" width="31" height="113" fill="#5E5E5E" />
        <motion.rect
          x="6"
          width="31"
          fill={TANK_ACCENT_COLOR}
          initial={false}
          animate={{ y: fillTop, height: fillHeight }}
          transition={overlayCardSpring}
        />
      </g>
    </svg>
  );
}
