import { BrowserKeyValueStore } from "@effect/platform-browser";
import { Clock, Context, Effect, Layer, Option, Schema } from "effect";
import { KeyValueStore } from "effect/unstable/persistence";

const dashboardsStorageKey = "mrt-dashboards-v1";
const legacyDashboardStorageKey = "mrt-dashboard";
const encodeUnknownJson = Schema.encodeUnknownEffect(Schema.UnknownFromJsonString);
const decodeUnknownJson = Schema.decodeUnknownEffect(Schema.UnknownFromJsonString);

const normalizeLayout = Effect.fn("DashboardPersistence.normalizeLayout")(function* (
  layout: unknown,
) {
  const encoded = yield* encodeUnknownJson(layout);
  return yield* decodeUnknownJson(encoded);
});

export const DashboardSlug = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  Schema.brand("DashboardSlug"),
);
export type DashboardSlug = typeof DashboardSlug.Type;

export const Dashboard = Schema.Struct({
  name: Schema.NonEmptyString,
  slug: DashboardSlug,
  layout: Schema.NullOr(Schema.Unknown),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
});
export interface Dashboard extends Schema.Schema.Type<typeof Dashboard> {}

const DashboardCollection = Schema.Array(Dashboard);

export class DashboardPersistenceError extends Schema.TaggedErrorClass<DashboardPersistenceError>()(
  "DashboardPersistenceError",
  {
    operation: Schema.String,
    cause: Schema.Defect,
  },
) {}

export class DashboardNotFound extends Schema.TaggedErrorClass<DashboardNotFound>()(
  "DashboardNotFound",
  { slug: Schema.String },
) {}

export class DashboardLastRemaining extends Schema.TaggedErrorClass<DashboardLastRemaining>()(
  "DashboardLastRemaining",
  {},
) {}

export interface DashboardPersistenceShape {
  readonly list: Effect.Effect<ReadonlyArray<Dashboard>, DashboardPersistenceError>;
  readonly findBySlug: (
    slug: string,
  ) => Effect.Effect<Option.Option<Dashboard>, DashboardPersistenceError>;
  readonly create: (
    input: Readonly<{ name: string; slug?: string; layout?: unknown }>,
  ) => Effect.Effect<Dashboard, DashboardPersistenceError>;
  readonly saveLayout: (
    slug: string,
    layout: unknown,
  ) => Effect.Effect<Dashboard, DashboardPersistenceError | DashboardNotFound>;
  readonly rename: (
    slug: string,
    name: string,
  ) => Effect.Effect<Dashboard, DashboardPersistenceError | DashboardNotFound>;
  readonly remove: (
    slug: string,
  ) => Effect.Effect<void, DashboardPersistenceError | DashboardNotFound | DashboardLastRemaining>;
  readonly importDashboard: (input: unknown) => Effect.Effect<Dashboard, DashboardPersistenceError>;
}

export class DashboardPersistence extends Context.Service<
  DashboardPersistence,
  DashboardPersistenceShape
>()("@mrt/frontend/DashboardPersistence") {}

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "") || "dashboard";

const uniqueSlug = (requested: string, dashboards: ReadonlyArray<Dashboard>) => {
  const base = toSlug(requested);
  const used = new Set(dashboards.map((dashboard) => dashboard.slug));
  let slug = base;
  let suffix = 2;

  while (used.has(slug as DashboardSlug)) {
    slug = `${base}-${suffix++}`;
  }

  return DashboardSlug.make(slug);
};

const persistenceError = (operation: string) =>
  Effect.mapError((cause: unknown) => new DashboardPersistenceError({ operation, cause }));

export const layer = Layer.effect(
  DashboardPersistence,
  Effect.gen(function* () {
    const keyValueStore = yield* KeyValueStore.KeyValueStore;
    const dashboardsStore = KeyValueStore.toSchemaStore(keyValueStore, DashboardCollection);
    const legacyLayoutStore = KeyValueStore.toSchemaStore(keyValueStore, Schema.Json);

    const load = Effect.fn("DashboardPersistence.load")(function* () {
      const stored = yield* dashboardsStore.get(dashboardsStorageKey);

      if (Option.isSome(stored)) {
        return stored.value;
      }

      const legacyLayout = yield* legacyLayoutStore.get(legacyDashboardStorageKey);
      const now = yield* Clock.currentTimeMillis;
      const migrated = Dashboard.make({
        name: "Dashboard",
        slug: DashboardSlug.make("dashboard"),
        layout: Option.getOrNull(legacyLayout),
        createdAt: now,
        updatedAt: now,
      });
      const dashboards = [migrated];
      yield* dashboardsStore.set(dashboardsStorageKey, dashboards);
      if (Option.isSome(legacyLayout)) {
        yield* keyValueStore.remove(legacyDashboardStorageKey);
      }
      return dashboards;
    }, persistenceError("load"));

    const store = Effect.fn("DashboardPersistence.store")(function* (
      dashboards: ReadonlyArray<Dashboard>,
    ) {
      yield* dashboardsStore.set(dashboardsStorageKey, dashboards);
    }, persistenceError("store"));

    const list = load();

    const findBySlug = Effect.fn("DashboardPersistence.findBySlug")(function* (slug: string) {
      const dashboards = yield* load();
      return Option.fromNullishOr(dashboards.find((dashboard) => dashboard.slug === slug));
    });

    const create = Effect.fn("DashboardPersistence.create")(function* (input: {
      readonly name: string;
      readonly slug?: string;
      readonly layout?: unknown;
    }) {
      const dashboards = yield* load();
      const name = yield* Schema.decodeUnknownEffect(Schema.NonEmptyString)(input.name.trim());
      const layout = input.layout === undefined ? null : yield* normalizeLayout(input.layout);
      const now = yield* Clock.currentTimeMillis;
      const dashboard = Dashboard.make({
        name,
        slug: uniqueSlug(input.slug ?? name, dashboards),
        layout,
        createdAt: now,
        updatedAt: now,
      });
      yield* store([...dashboards, dashboard]);
      return dashboard;
    }, persistenceError("create"));

    const saveLayout = Effect.fn("DashboardPersistence.saveLayout")(function* (
      slug: string,
      input: unknown,
    ) {
      const dashboards = yield* load();
      const index = dashboards.findIndex((dashboard) => dashboard.slug === slug);
      if (index < 0) {
        return yield* new DashboardNotFound({ slug });
      }

      const layout = yield* normalizeLayout(input);
      const now = yield* Clock.currentTimeMillis;
      const dashboard = Dashboard.make({ ...dashboards[index], layout, updatedAt: now });
      const updated = [...dashboards];
      updated[index] = dashboard;
      yield* store(updated);
      return dashboard;
    }, persistenceError("saveLayout"));

    const rename = Effect.fn("DashboardPersistence.rename")(function* (
      slug: string,
      input: string,
    ) {
      const dashboards = yield* load();
      const index = dashboards.findIndex((dashboard) => dashboard.slug === slug);
      if (index < 0) {
        return yield* new DashboardNotFound({ slug });
      }

      const name = yield* Schema.decodeUnknownEffect(Schema.NonEmptyString)(input.trim());
      const now = yield* Clock.currentTimeMillis;
      const dashboard = Dashboard.make({ ...dashboards[index], name, updatedAt: now });
      const updated = [...dashboards];
      updated[index] = dashboard;
      yield* store(updated);
      return dashboard;
    }, persistenceError("rename"));

    const importDashboard = Effect.fn("DashboardPersistence.importDashboard")(function* (
      input: unknown,
    ) {
      const imported = yield* Schema.decodeUnknownEffect(Dashboard)(input);
      return yield* create({
        name: imported.name,
        slug: imported.slug,
        layout: imported.layout,
      });
    }, persistenceError("importDashboard"));

    const remove = Effect.fn("DashboardPersistence.remove")(function* (slug: string) {
      const dashboards = yield* load();
      if (!dashboards.some((dashboard) => dashboard.slug === slug)) {
        return yield* new DashboardNotFound({ slug });
      }
      if (dashboards.length === 1) {
        return yield* new DashboardLastRemaining();
      }

      yield* store(dashboards.filter((dashboard) => dashboard.slug !== slug));
    }, persistenceError("remove"));

    return DashboardPersistence.of({
      list,
      findBySlug,
      create,
      saveLayout,
      rename,
      remove,
      importDashboard,
    });
  }),
);

export const layerBrowserStorage = layer.pipe(
  Layer.provide(BrowserKeyValueStore.layerLocalStorage),
);
