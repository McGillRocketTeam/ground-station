import { useAtom, useAtomValue } from "@effect/atom-react";
import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AsyncResult } from "effect/unstable/reactivity";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";
import { dashboardRouteDataAtom } from "@/lib/dashboard-persistence";
import { DashboardPage } from "@/pages/dashboard";
import { NewDashboardPage } from "@/pages/new-dashboard";

function InstanceSelector() {
  const [instance, setInstance] = useAtom(selectedInstanceAtom);
  const instancesResult = useAtomValue(YamcsAtomHttpClient.query("instances", "listInstances", {}));

  return (
    <div>
      {AsyncResult.builder(instancesResult)
        .onInitial(() => <div>Loading instances...</div>)
        .onSuccess(({ instances }) => (
          <Select value={instance} onValueChange={(value) => setInstance(value ?? "")}>
            <SelectTrigger className="w-full max-w-48">
              <SelectValue placeholder="Select an instance" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Instances</SelectLabel>
                {instances.map((item) => (
                  <SelectItem key={item.name} value={item.name}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ))
        .render()}
    </div>
  );
}

function RootRouteComponent() {
  const instance = useAtomValue(selectedInstanceAtom);

  if (!instance) {
    return (
      <div className="fixed inset-0 grid h-screen w-full place-items-center px-4">
        <div className="w-full max-w-sm">
          <InstanceSelector />
        </div>
      </div>
    );
  }

  return <Outlet />;
}

const rootRoute = createRootRoute({
  component: RootRouteComponent,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexDashboardRouteComponent,
});

const newPageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/new",
  component: NewDashboardPage,
});

const customDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$dashboardPath",
  component: CustomDashboardRouteComponent,
});

function IndexDashboardRouteComponent() {
  const routeDataResult = useAtomValue(dashboardRouteDataAtom("/"));

  return AsyncResult.builder(routeDataResult)
    .onInitial(() => (
      <div className="fixed inset-0 grid place-items-center text-sm">Loading...</div>
    ))
    .onSuccess(({ page, layout }) => {
      if (page._tag === "None") {
        return null;
      }

      return <DashboardPage page={page.value} initialLayout={layout} />;
    })
    .render();
}

function CustomDashboardRouteComponent() {
  const { dashboardPath } = customDashboardRoute.useParams();
  const routeDataResult = useAtomValue(dashboardRouteDataAtom(`/${dashboardPath}`));

  return AsyncResult.builder(routeDataResult)
    .onInitial(() => (
      <div className="fixed inset-0 grid place-items-center text-sm">Loading...</div>
    ))
    .onSuccess(({ page, layout }) => {
      if (page._tag === "None") {
        return (
          <div className="fixed inset-0 grid place-items-center px-4">
            <div className="text-center text-sm text-muted-foreground">
              Dashboard page not found.
            </div>
          </div>
        );
      }

      return <DashboardPage page={page.value} initialLayout={layout} />;
    })
    .render();
}

const routeTree = rootRoute.addChildren([indexRoute, newPageRoute, customDashboardRoute]);

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
