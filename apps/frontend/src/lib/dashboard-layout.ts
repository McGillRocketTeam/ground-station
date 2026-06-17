import type { SerializedDockview } from "dockview-react";

export function isSerializedDockviewLayout(layout: unknown): layout is SerializedDockview {
  return typeof layout === "object" && layout !== null && Object.keys(layout).length > 0;
}

export function snapshotDockviewLayout(layout: SerializedDockview): SerializedDockview {
  return structuredClone(layout);
}
