import { Navigate, Route, Routes } from "react-router";

import { AutoOverlay } from "./overlays/auto-overlay.tsx";
import { ProcedureOverlay } from "./overlays/procedure-overlay.tsx";
import { procedureCodes, procedureSteps } from "./overlays/procedure-steps.ts";
import { TelemetryOverlay } from "./overlays/telemetry-overlay.tsx";

export function App() {
  return (
    <Routes>
      <Route index element={<Navigate to="/telemetry" replace />} />
      <Route path="auto" element={<AutoOverlay />} />
      <Route path="telemetry" element={<TelemetryOverlay />} />
      {procedureCodes.map((code) => (
        <Route
          key={code}
          path={`procedures/${code.toLowerCase()}`}
          element={<ProcedureOverlay code={code} {...procedureSteps[code]} />}
        />
      ))}
      <Route path="*" element={<Navigate to="/telemetry" replace />} />
    </Routes>
  );
}
