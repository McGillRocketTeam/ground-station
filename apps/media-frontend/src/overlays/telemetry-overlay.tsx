import type { PrimarySystem } from "@mrt/media-state";
import type { ReactNode } from "react";

import { useAtomValue } from "@effect/atom-react";
import { DateTime } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import { MrtLogo } from "../components/mrt-logo.tsx";
import { OverlayCard } from "../components/overlay-card.tsx";
import { cn } from "../lib/utils.ts";
import { mediaStateAtom, selectMediaState } from "../state/control-state-atoms.ts";
import { currentTimeAtom, parameterSubscriptionAtom } from "../state/parameter-atoms.ts";
import { flightComputerParameter } from "../state/parameter-path.ts";

export function TelemetryOverlay() {
  const state = useAtomValue(mediaStateAtom, selectMediaState);

  return (
    <main className="flex flex-col items-start gap-4 p-2">
      <div className="flex flex-row items-center">
        <MrtLogo />
      </div>
      <TelemetryCard primarySystem={state.primarySystem} />
    </main>
  );
}

export function TelemetryCard({ primarySystem }: { primarySystem: PrimarySystem }) {
  const altitudeParameter = flightComputerParameter(primarySystem, "barometer_altitude_from_pad");
  const verticalSpeedParameter = flightComputerParameter(primarySystem, "vertical_speed");
  const flightStageParameter = flightComputerParameter(primarySystem, "flight_stage");
  const apogeeParameter = flightComputerParameter(primarySystem, "apogee_from_ground");

  return (
    <OverlayCard title="Flight & Telemetry" animateAppearance={false} layoutMode={false}>
      <div className="grid grid-cols-[auto_auto] gap-x-6 uppercase min-w-70">
        <div>Stage</div>
        <ParameterValue qualifiedName={flightStageParameter} />
        <div className="col-span-full mb-2 h-px bg-white/25" />
        <div>Altitude</div>
        <ParameterValue qualifiedName={altitudeParameter} />
        <div>Vertical Speed</div>
        <ParameterValue qualifiedName={verticalSpeedParameter} />
        <div>Apogee</div>
        <ParameterValue qualifiedName={apogeeParameter} />
        <div className="col-span-full mb-2 h-px bg-white/25" />
        <div>Last Packet</div>
        <LastPacketValue
          parameters={[
            altitudeParameter,
            verticalSpeedParameter,
            flightStageParameter,
            apogeeParameter,
          ]}
        />
      </div>
    </OverlayCard>
  );
}

function EmptyValue() {
  return <div className="text-right opacity-50">N/A</div>;
}

function ParameterValue({ qualifiedName }: { qualifiedName: string }) {
  const result = useAtomValue(parameterSubscriptionAtom(qualifiedName));

  return AsyncResult.match(result, {
    onInitial: () => <EmptyValue />,
    onFailure: () => <EmptyValue />,
    onSuccess: ({ value: update }) => {
      const engineeringValue = update.value.engValue;
      const value = "value" in engineeringValue ? engineeringValue.value : undefined;
      const unit = update.info.type.unitSet?.map((entry) => entry.unit).join("");

      if (value === undefined || value === "") {
        return <EmptyValue />;
      }

      return (
        <div className="text-right w-[14ch] line-clamp-1">
          {value.toLocaleString()} {unit && <Unit>{unit}</Unit>}
        </div>
      );
    },
  });
}

function LastPacketValue({
  parameters,
}: {
  parameters: readonly [string, string, string, string];
}) {
  const altitude = useAtomValue(parameterSubscriptionAtom(parameters[0]));
  const verticalSpeed = useAtomValue(parameterSubscriptionAtom(parameters[1]));
  const flightStage = useAtomValue(parameterSubscriptionAtom(parameters[2]));
  const apogee = useAtomValue(parameterSubscriptionAtom(parameters[3]));
  const currentTime = useAtomValue(currentTimeAtom);

  const packetTimes = [altitude, verticalSpeed, flightStage, apogee].flatMap((result) =>
    AsyncResult.match(result, {
      onInitial: () => [],
      onFailure: () => [],
      onSuccess: ({ value: update }) => [
        DateTime.toEpochMillis(update.value.acquisitionTime ?? update.value.generationTime),
      ],
    }),
  );
  const now = AsyncResult.match(currentTime, {
    onInitial: () => undefined,
    onFailure: () => undefined,
    onSuccess: ({ value }) => value,
  });

  if (now === undefined || packetTimes.length === 0) {
    return <EmptyValue />;
  }

  const ageSeconds = Math.max(0, Math.floor((now - Math.max(...packetTimes)) / 1_000));

  if (ageSeconds < 2) {
    return <div className="text-right">Now</div>;
  }

  return (
    <div className="text-right">
      {ageSeconds.toLocaleString()} <Unit>s</Unit>
    </div>
  );
}

export function Unit({ children, className }: { className?: string; children: ReactNode }) {
  return <span className={cn("text-base opacity-75 normal-case", className)}>{children}</span>;
}
