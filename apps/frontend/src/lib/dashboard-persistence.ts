import type { SerializedDockview } from "dockview-react";

import { BrowserKeyValueStore } from "@effect/platform-browser";
import { Context, Data, Effect, Layer, Option, Schema } from "effect";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";
import { Atom } from "effect/unstable/reactivity";

const dashboardPagesStorageKey = "mrt-dashboard-pages";
const dashboardPathPattern = /^\/(?:[a-z0-9-]+)?$/;
const dashboardPathSegmentPattern = /^[a-z0-9-]+$/;
const dashboardPersistenceReactivityKey = "dashboard-persistence";

const DashboardName = Schema.String.check(
  Schema.isMinLength(1, { message: "Dashboard name is required." }),
  Schema.isMaxLength(64, { message: "Dashboard name must be at most 64 characters." }),
);

const DashboardPath = Schema.String.check(
  Schema.isPattern(dashboardPathPattern, {
    message: "Dashboard routes must be / or a single lowercase path segment.",
  }),
);

const DashboardPathSegment = Schema.String.check(
  Schema.isMinLength(1, { message: "Route is required." }),
  Schema.isPattern(dashboardPathSegmentPattern, {
    message: "Use lowercase letters, numbers, and hyphens only.",
  }),
  Schema.isMaxLength(63, { message: "Route must be at most 63 characters." }),
);

export const DashboardNameSchema = DashboardName;
export const DashboardPathSegmentSchema = DashboardPathSegment;

export class DashboardPageRecord extends Schema.Class<DashboardPageRecord>("DashboardPageRecord")({
  name: DashboardName,
  path: DashboardPath,
  layout: Schema.optional(Schema.String),
}) {}

export class CreateDashboardPageInput extends Schema.Class<CreateDashboardPageInput>(
  "CreateDashboardPageInput",
)({
  name: DashboardName,
  pathSegment: DashboardPathSegment,
}) {}

export class DashboardPersistenceError extends Data.TaggedError("DashboardPersistenceError")<{
  readonly message: string;
}> {}

const DashboardPages = Schema.Array(DashboardPageRecord);
const DashboardPageJsonString = Schema.fromJsonString(Schema.toCodecJson(DashboardPageRecord));
const JsonUnknownString = Schema.UnknownFromJsonString;

export const defaultDashboardPage = DashboardPageRecord.make({
  name: "Default Dashboard",
  path: "/",
  layout: undefined,
});

export const reservedDashboardPaths = new Set(["/", "/new"]);

function toDashboardPersistenceError(error: unknown, fallback: string) {
  if (error instanceof DashboardPersistenceError) {
    return error;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error as { message?: unknown };

    if (typeof message === "string" && message.length > 0) {
      return new DashboardPersistenceError({ message });
    }
  }

  return new DashboardPersistenceError({ message: fallback });
}

function optionFromNullable<A>(value: A | null | undefined) {
  return value === null || value === undefined ? Option.none<A>() : Option.some(value);
}

function normalizeDashboardName(value: string) {
  return value.trim();
}

function normalizeDashboardSegment(value: string) {
  return value.trim().toLowerCase();
}

function sortDashboardPages(pages: ReadonlyArray<DashboardPageRecord>) {
  return [...pages].sort((left, right) => {
    if (left.path === "/") {
      return -1;
    }

    if (right.path === "/") {
      return 1;
    }

    return left.name.localeCompare(right.name);
  });
}

function sanitizeStoredPages(pages: ReadonlyArray<DashboardPageRecord>) {
  const byPath = new Map<string, DashboardPageRecord>([
    [defaultDashboardPage.path, defaultDashboardPage],
  ]);

  for (const page of pages) {
    if (page.path === "/") {
      continue;
    }

    byPath.set(page.path, page);
  }

  return sortDashboardPages([...byPath.values()]);
}

export function normalizeDashboardPath(value: string) {
  const trimmed = value.trim().toLowerCase().replace(/^\/+/, "").replace(/\/+$/, "");

  return trimmed.length === 0 ? "/" : `/${trimmed}`;
}

export function getDashboardPathSegment(path: string) {
  return normalizeDashboardPath(path).slice(1);
}

export function dashboardRouteTarget(path: string) {
  const normalizedPath = normalizeDashboardPath(path);

  return normalizedPath === "/"
    ? { to: "/" as const }
    : {
        to: "/$dashboardPath" as const,
        params: { dashboardPath: getDashboardPathSegment(normalizedPath) },
      };
}

export function getDashboardPageLayout(page: DashboardPageRecord) {
  if (page.layout === undefined) {
    return undefined;
  }

  const decoded = Schema.decodeUnknownSync(JsonUnknownString)(page.layout);

  return isSerializedDockviewLayout(decoded)
    ? snapshotDockviewLayout(decoded as SerializedDockview)
    : undefined;
}

function normalizeLayoutForPersistence(layout: SerializedDockview) {
  return Schema.encodeSync(JsonUnknownString)(layout);
}

export function setDashboardPageLayout(page: DashboardPageRecord, layout: SerializedDockview) {
  return DashboardPageRecord.make({
    name: page.name,
    path: page.path,
    layout: normalizeLayoutForPersistence(snapshotDockviewLayout(layout)),
  });
}

export function encodeDashboardPage(page: DashboardPageRecord) {
  return Schema.encodeUnknownSync(DashboardPageJsonString)(page);
}

export function decodeDashboardPage(raw: string) {
  return Schema.decodeUnknownSync(DashboardPageJsonString)(raw);
}

export class DashboardPersistence extends Context.Service<
  DashboardPersistence,
  {
    readonly listPages: Effect.Effect<ReadonlyArray<DashboardPageRecord>>;
    readonly getPage: (path: string) => Effect.Effect<Option.Option<DashboardPageRecord>>;
    readonly createPage: (
      input: typeof CreateDashboardPageInput.Type,
    ) => Effect.Effect<DashboardPageRecord, DashboardPersistenceError>;
    readonly importPage: (
      page: DashboardPageRecord,
    ) => Effect.Effect<DashboardPageRecord, DashboardPersistenceError>;
    readonly readLayout: (path: string) => Effect.Effect<SerializedDockview | undefined>;
    readonly writeLayout: (
      path: string,
      layout: SerializedDockview,
    ) => Effect.Effect<void, DashboardPersistenceError>;
  }
>()("@mrt/frontend/DashboardPersistence") {
  static readonly layer = Layer.effect(
    DashboardPersistence,
    Effect.gen(function* () {
      const store = yield* KeyValueStore.KeyValueStore;
      const pagesStore = KeyValueStore.toSchemaStore(store, DashboardPages);

      const persistPages = (pages: ReadonlyArray<DashboardPageRecord>, message: string) =>
        pagesStore
          .set(dashboardPagesStorageKey, sortDashboardPages(pages))
          .pipe(Effect.mapError((error) => toDashboardPersistenceError(error, message)));

      const listPages: Effect.Effect<ReadonlyArray<DashboardPageRecord>> = Effect.match(
        Effect.gen(function* () {
          const storedPages = yield* pagesStore.get(dashboardPagesStorageKey);
          return sanitizeStoredPages(Option.getOrElse(storedPages, () => []));
        }),
        {
          onFailure: () => [defaultDashboardPage] as const,
          onSuccess: (pages) => pages,
        },
      );

      const getPage: (path: string) => Effect.Effect<Option.Option<DashboardPageRecord>> = (path) =>
        listPages.pipe(
          Effect.map((pages) => pages.find((page) => page.path === normalizeDashboardPath(path))),
          Effect.map(optionFromNullable),
        );

      const createPage: (
        input: typeof CreateDashboardPageInput.Type,
      ) => Effect.Effect<DashboardPageRecord, DashboardPersistenceError> = (input) =>
        Effect.gen(function* () {
          const page = DashboardPageRecord.make({
            name: normalizeDashboardName(input.name),
            path: normalizeDashboardPath(normalizeDashboardSegment(input.pathSegment)),
            layout: undefined,
          });

          if (reservedDashboardPaths.has(page.path)) {
            return yield* new DashboardPersistenceError({ message: "That route is reserved." });
          }

          const pages = yield* listPages;

          if (pages.some((existingPage) => existingPage.path === page.path)) {
            return yield* new DashboardPersistenceError({
              message: "A dashboard already exists at that route.",
            });
          }

          yield* persistPages([...pages, page], "Failed to persist dashboard page.");

          return page;
        });

      const importPage: (
        page: DashboardPageRecord,
      ) => Effect.Effect<DashboardPageRecord, DashboardPersistenceError> = (page) =>
        Effect.gen(function* () {
          const importedPage = DashboardPageRecord.make({
            name: normalizeDashboardName(page.name),
            path: normalizeDashboardPath(page.path),
            layout: page.layout,
          });

          if (reservedDashboardPaths.has(importedPage.path)) {
            return yield* new DashboardPersistenceError({
              message: "Imported page uses a reserved route.",
            });
          }

          const pages = yield* listPages;

          if (pages.some((existingPage) => existingPage.path === importedPage.path)) {
            return yield* new DashboardPersistenceError({
              message: "A dashboard already exists at that route.",
            });
          }

          yield* persistPages([...pages, importedPage], "Failed to import dashboard page.");

          return importedPage;
        });

      const readLayout: (path: string) => Effect.Effect<SerializedDockview | undefined> = (path) =>
        Effect.match(getPage(path), {
          onFailure: () => undefined,
          onSuccess: (page) => {
            const layout = Option.isSome(page) ? getDashboardPageLayout(page.value) : undefined;

            console.info("[dashboard-persistence] readLayout", {
              path,
              hasPage: Option.isSome(page),
              page: Option.isSome(page) ? page.value : undefined,
              layout,
            });

            return layout;
          },
        });

      const writeLayout: (
        path: string,
        layout: SerializedDockview,
      ) => Effect.Effect<void, DashboardPersistenceError> = (path, layout) =>
        Effect.gen(function* () {
          const normalizedPath = normalizeDashboardPath(path);

          console.info("[dashboard-persistence] writeLayout:start", {
            path,
            normalizedPath,
            layout,
          });

          if (!isSerializedDockviewLayout(layout)) {
            return yield* new DashboardPersistenceError({
              message: "Cannot persist an empty dashboard layout.",
            });
          }

          const pages = yield* listPages;
          const existingPage = pages.find((page) => page.path === normalizedPath);

          if (!existingPage) {
            return yield* new DashboardPersistenceError({
              message: `Dashboard page ${normalizedPath} was not found.`,
            });
          }

          const nextPage = DashboardPageRecord.make({
            name: existingPage.name,
            path: existingPage.path,
            layout: normalizeLayoutForPersistence(snapshotDockviewLayout(layout)),
          });

          console.info("[dashboard-persistence] writeLayout:nextPage", {
            existingPage,
            nextPage,
          });

          yield* persistPages(
            pages.map((page) => (page.path === normalizedPath ? nextPage : page)),
            "Failed to persist dashboard layout.",
          );

          console.info("[dashboard-persistence] writeLayout:done", {
            path,
            normalizedPath,
          });
        });

      return {
        listPages,
        getPage,
        createPage,
        importPage,
        readLayout,
        writeLayout,
      };
    }),
  );
}

export const dashboardPersistenceLayer = DashboardPersistence.layer.pipe(
  Layer.provide(BrowserKeyValueStore.layerLocalStorage),
);

export const dashboardPersistenceRuntime = Atom.runtime(dashboardPersistenceLayer);

const withDashboardPersistenceReactivity = dashboardPersistenceRuntime.factory.withReactivity([
  dashboardPersistenceReactivityKey,
]);

export const dashboardPagesAtom = withDashboardPersistenceReactivity(
  dashboardPersistenceRuntime.atom(
    DashboardPersistence.use((dashboardPersistence) => dashboardPersistence.listPages),
  ),
);

export const dashboardRouteDataAtom = Atom.family((path: string) => {
  const normalizedPath = normalizeDashboardPath(path);

  return withDashboardPersistenceReactivity(
    dashboardPersistenceRuntime.atom(
      DashboardPersistence.use((dashboardPersistence) =>
        Effect.all({
          page: dashboardPersistence.getPage(normalizedPath),
          layout: dashboardPersistence.readLayout(normalizedPath),
        }),
      ),
    ),
  );
});

export const createDashboardPageAtom = dashboardPersistenceRuntime.fn(
  (input: typeof CreateDashboardPageInput.Type) =>
    DashboardPersistence.use((dashboardPersistence) => dashboardPersistence.createPage(input)),
  { reactivityKeys: [dashboardPersistenceReactivityKey] },
);

export const importDashboardPageAtom = dashboardPersistenceRuntime.fn(
  (page: DashboardPageRecord) =>
    DashboardPersistence.use((dashboardPersistence) => dashboardPersistence.importPage(page)),
  { reactivityKeys: [dashboardPersistenceReactivityKey] },
);

export const writeDashboardLayoutAtom = dashboardPersistenceRuntime.fn(
  ({ path, layout }: { path: string; layout: SerializedDockview }) =>
    DashboardPersistence.use((dashboardPersistence) =>
      dashboardPersistence.writeLayout(path, layout),
    ),
  { reactivityKeys: [dashboardPersistenceReactivityKey] },
);

function isSerializedDockviewLayout(layout: unknown): layout is SerializedDockview {
  return typeof layout === "object" && layout !== null && Object.keys(layout).length > 0;
}

function snapshotDockviewLayout(layout: SerializedDockview): SerializedDockview {
  return structuredClone(layout);
}
