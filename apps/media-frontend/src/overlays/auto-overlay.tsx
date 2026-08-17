import { useAtomValue } from "@effect/atom-react";
import { AnimatePresence } from "motion/react";

import { MediaHeader } from "../components/media-header.tsx";
import { mediaStateAtom, selectMediaState } from "../state/control-state-atoms.ts";
import { parameterSubscriptionAtom } from "../state/parameter-atoms.ts";
import { flightComputerParameter } from "../state/parameter-path.ts";
import { AltitudeChartCard } from "./altitude-chart-card.tsx";
import { AnimatedProcedureCard } from "./animated-procedure-card.tsx";
import { FillProgressCard } from "./fill-progress-overlay.tsx";
import { FlightTrackingCard, getFlightStage } from "./flight-tracking-card.tsx";
import { MissionUpdateCard } from "./mission-update-card.tsx";
import { isProcedureCode } from "./procedure-steps.ts";
import { TelemetryCard } from "./telemetry-overlay.tsx";

export function AutoOverlay() {
  const state = useAtomValue(mediaStateAtom, selectMediaState);
  const flightStage = getFlightStage(
    useAtomValue(
      parameterSubscriptionAtom(flightComputerParameter(state.primarySystem, "flight_stage")),
    ),
  );
  const procedureCode = isProcedureCode(state.scene) ? state.scene : undefined;
  const showFlightTracking = state.scene === "TW4" && state.showGpsCard;
  const hideProcedureCard =
    state.scene === "TW4" && flightStage !== undefined && flightStage >= 1 && flightStage <= 5;

  return (
    <main className="relative h-screen p-4">
      <div className="flex flex-col gap-4">
        <MediaHeader redFlagAt={state.redFlagAt} />
        <TelemetryCard primarySystem={state.primarySystem} />
        <AnimatePresence initial={false} mode="wait">
          {showFlightTracking ? (
            <FlightTrackingCard
              key={`flight-tracking-card-${state.primarySystem}`}
              primarySystem={state.primarySystem}
            />
          ) : (
            state.scene === "TW3" &&
            state.showTankCard && (
              <FillProgressCard
                key={`fill-progress-card-${state.primarySystem}`}
                primarySystem={state.primarySystem}
              />
            )
          )}
        </AnimatePresence>
      </div>
      <div className="absolute bottom-4 left-4 flex items-end gap-4">
        <AnimatePresence initial={false} mode="wait">
          {hideProcedureCard
            ? state.showAltitudeCard && (
                <AltitudeChartCard
                  key={`altitude-chart-card-${state.primarySystem}`}
                  primarySystem={state.primarySystem}
                />
              )
            : procedureCode && <AnimatedProcedureCard key="procedure-card" code={procedureCode} />}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {state.missionUpdate !== null && (
            <MissionUpdateCard key="mission-update-card" message={state.missionUpdate} />
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
