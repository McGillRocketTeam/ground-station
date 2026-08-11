import { Navigate, Route, Routes } from "react-router";

import { OverlayCard, OverlayCardHeader } from "./components/overlay-card.tsx";
import { ProcedureOverlay } from "./overlays/procedure-overlay.tsx";

export function App() {
  return (
    <Routes>
      <Route index element={<Navigate to="/telemetry" replace />} />
      <Route path="telemetry" element={<TelemetryOverlay />} />
      <Route path="tank" element={<TankOverlayPlaceholder />} />
      <Route
        path="procedures/tw1"
        element={
          <ProcedureOverlay
            code="TW1"
            title="Rocket assembly"
            blurb="The team is assembling the propulsion, avionics, payload, recovery, energetics, and airframe systems, then validating the completed vehicle for flight."
          />
        }
      />
      <Route
        path="procedures/tw2"
        element={
          <ProcedureOverlay
            code="TW2"
            title="Pre-launch procedures"
            blurb="Following flight approval, the vehicle is transported to the pad, installed on the rail, and put through ignition, valve, disconnect, avionics, and telemetry checks."
          />
        }
      />
      <Route
        path="procedures/tw3"
        element={
          <ProcedureOverlay
            code="TW3"
            title="Filling and arming"
            blurb="Pad operators connect the nitrous supply and arm the pad box before returning to the control station, where the flight tank is filled remotely while pressure and temperature are monitored."
          />
        }
      />
      <Route
        path="procedures/tw4"
        element={
          <ProcedureOverlay
            code="TW4"
            title="Launch procedures"
            blurb="With the pad clear, the fill line is vented and disconnected remotely, recovery and propulsion are armed, and the team proceeds through ignition, flight, and landing."
          />
        }
      />
      <Route path="*" element={<Navigate to="/telemetry" replace />} />
    </Routes>
  );
}

function TelemetryOverlay() {
  return (
    <main className="relative h-screen w-screen" aria-label="Telemetry overlay">
      <OverlayCard className="absolute top-4 left-4 w-[min(30rem,calc(100vw-2rem))]">
        <OverlayCardHeader>
          <span>Live telemetry</span>
        </OverlayCardHeader>

        <div className="p-4">
          <div className="border-b border-border pb-4">
            <div className="text-xs font-medium tracking-[0.12em] text-white/55 uppercase">
              Current phase
            </div>
            <div className="mt-2 text-xl font-medium uppercase">Powered ascent</div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <TelemetryMetric label="Altitude" value="3,842" unit="m" />
            <TelemetryMetric label="Speed" value="612" unit="km/h" />
            <TelemetryMetric label="Distance travelled" value="8.4" unit="km" />
            <TelemetryMetric label="Time to apogee" value="00:18" />
          </div>
        </div>
      </OverlayCard>

      <div className="pointer-events-none absolute bottom-4 left-4 h-28 w-56 origin-bottom-left scale-[0.85] overflow-hidden select-none">
        <img
          src="/icon.svg"
          alt="McGill Rocket Team"
          className="absolute top-1/2 left-0 w-full -translate-y-1/2"
        />
      </div>
    </main>
  );
}

function TelemetryMetric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <div className="text-xs font-medium tracking-[0.12em] text-white/55 uppercase">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-medium tabular-nums">{value}</span>
        {unit && <span className="text-sm text-white/65">{unit}</span>}
      </div>
    </div>
  );
}

function TankOverlayPlaceholder() {
  return (
    <main className="relative h-screen w-screen" aria-label="Tank overlay placeholder">
      <div className="absolute top-4 left-4 w-72 border border-dashed border-border bg-black/85 p-4 font-mono text-white">
        <p className="text-xs tracking-[0.18em] text-mrt uppercase">Tank overlay</p>
        <p className="mt-2 text-sm text-white/60">Tank graphic placeholder</p>
      </div>
    </main>
  );
}
