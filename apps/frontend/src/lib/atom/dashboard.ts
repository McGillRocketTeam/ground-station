import { Cause, Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";

import {
  DashboardPersistence,
  layerBrowserStorage,
  type Dashboard,
} from "../dashboard-persistence";

export const dashboardRuntime = Atom.runtime(layerBrowserStorage);

export const dashboardsAtom = dashboardRuntime.atom(
  DashboardPersistence.use((service) => service.list),
);

export const dashboardAtom = Atom.family((slug: string) =>
  dashboardRuntime.atom(DashboardPersistence.use((service) => service.findBySlug(slug))),
);

export const createDashboardAtom = dashboardRuntime.fn<{
  readonly name: string;
  readonly slug?: string;
}>()((input, get) =>
  DashboardPersistence.use((service) => service.create(input)).pipe(
    Effect.tap(() => Effect.sync(() => get.refresh(dashboardsAtom))),
  ),
);

export const saveDashboardLayoutAtom = dashboardRuntime.fn<{
  readonly slug: string;
  readonly layout: unknown;
}>()(({ layout, slug }, get) =>
  DashboardPersistence.use((service) => service.saveLayout(slug, layout)).pipe(
    Effect.tapError((error) =>
      Effect.logError(
        "[dashboard-persistence] atom:save-layout:failed",
        Cause.pretty(Cause.fail(error)),
        error,
      ),
    ),
    Effect.tap(() =>
      Effect.sync(() => {
        get.refresh(dashboardsAtom);
        get.refresh(dashboardAtom(slug));
      }),
    ),
  ),
);

export const importDashboardAtom = dashboardRuntime.fn<unknown>()((input, get) =>
  DashboardPersistence.use((service) => service.importDashboard(input)).pipe(
    Effect.tap(() => Effect.sync(() => get.refresh(dashboardsAtom))),
  ),
);

export const renameDashboardAtom = dashboardRuntime.fn<{
  readonly slug: string;
  readonly name: string;
}>()(({ name, slug }, get) =>
  DashboardPersistence.use((service) => service.rename(slug, name)).pipe(
    Effect.tap(() =>
      Effect.sync(() => {
        get.refresh(dashboardsAtom);
        get.refresh(dashboardAtom(slug));
      }),
    ),
  ),
);

export const deleteDashboardAtom = dashboardRuntime.fn<string>()((slug, get) =>
  DashboardPersistence.use((service) => service.remove(slug)).pipe(
    Effect.tap(() =>
      Effect.sync(() => {
        get.refresh(dashboardsAtom);
        get.refresh(dashboardAtom(slug));
      }),
    ),
  ),
);

export type { Dashboard };
