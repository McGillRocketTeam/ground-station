import type { DockviewApi, SerializedDockview } from "dockview-react";

import { Atom } from "effect/unstable/reactivity";

type DashboardLayoutHistory = {
  past: ReadonlyArray<SerializedDockview>;
  present: SerializedDockview | undefined;
  future: ReadonlyArray<SerializedDockview>;
};

const emptyDashboardLayoutHistory: DashboardLayoutHistory = {
  past: [],
  present: undefined,
  future: [],
};

function areLayoutsEqual(
  left: SerializedDockview | undefined,
  right: SerializedDockview | undefined,
) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

export const dashboardDockviewApiAtom = Atom.make<DockviewApi | undefined>(
  undefined,
);

export const dashboardLayoutHistoryAtom = Atom.make<DashboardLayoutHistory>(
  emptyDashboardLayoutHistory,
);

export const initializeDashboardLayoutHistoryAtom: Atom.Writable<
  void,
  SerializedDockview
> = Atom.writable(
  () => undefined,
  (ctx, layout) => {
    ctx.set(dashboardLayoutHistoryAtom, {
      past: [],
      present: layout,
      future: [],
    });
  },
) as Atom.Writable<void, SerializedDockview>;

export const pushDashboardLayoutHistoryAtom: Atom.Writable<
  void,
  SerializedDockview
> = Atom.writable(
  () => undefined,
  (ctx, layout) => {
    const history = ctx.get(dashboardLayoutHistoryAtom);

    if (areLayoutsEqual(history.present, layout)) {
      return;
    }

    ctx.set(dashboardLayoutHistoryAtom, {
      past: history.present ? [...history.past, history.present] : history.past,
      present: layout,
      future: [],
    });
  },
) as Atom.Writable<void, SerializedDockview>;

export const dashboardUndoAtom: Atom.Writable<void, void> = Atom.writable(
  () => undefined,
  (ctx) => {
    const api = ctx.get(dashboardDockviewApiAtom);
    const history = ctx.get(dashboardLayoutHistoryAtom);
    const previousLayout = history.past.at(-1);

    if (!api || !history.present || !previousLayout) {
      return;
    }

    const nextHistory: DashboardLayoutHistory = {
      past: history.past.slice(0, -1),
      present: previousLayout,
      future: [history.present, ...history.future],
    };

    ctx.set(dashboardLayoutHistoryAtom, nextHistory);
    api.fromJSON(previousLayout);
  },
) as Atom.Writable<void, void>;

export const dashboardRedoAtom: Atom.Writable<void, void> = Atom.writable(
  () => undefined,
  (ctx) => {
    const api = ctx.get(dashboardDockviewApiAtom);
    const history = ctx.get(dashboardLayoutHistoryAtom);
    const [nextLayout, ...futureLayouts] = history.future;

    if (!api || !history.present || !nextLayout) {
      return;
    }

    const nextHistory: DashboardLayoutHistory = {
      past: [...history.past, history.present],
      present: nextLayout,
      future: futureLayouts,
    };

    ctx.set(dashboardLayoutHistoryAtom, nextHistory);
    api.fromJSON(nextLayout);
  },
) as Atom.Writable<void, void>;
