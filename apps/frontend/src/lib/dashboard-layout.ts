import type { SerializedDockview } from "dockview-react";

export const dashboardStorageKey = "mrt-dashboard";

export function isSerializedDockviewLayout(
  layout: unknown,
): layout is SerializedDockview {
  return (
    typeof layout === "object" &&
    layout !== null &&
    Object.keys(layout).length > 0
  );
}

export function snapshotDockviewLayout(
  layout: SerializedDockview,
): SerializedDockview {
  return structuredClone(layout);
}

export function persistDashboardLayout(layout: SerializedDockview) {
  window.localStorage.setItem(dashboardStorageKey, JSON.stringify(layout));
}

export function readPersistedDashboardLayout() {
  const rawLayout = window.localStorage.getItem(dashboardStorageKey);

  if (!rawLayout) {
    return undefined;
  }

  try {
    const layout = JSON.parse(rawLayout) as unknown;
    return isSerializedDockviewLayout(layout)
      ? snapshotDockviewLayout(layout)
      : undefined;
  } catch (err) {
    console.error("Error parsing persisted layout", err);
    return undefined;
  }
}
