import { useAtomSuspense } from "@effect/atom-react";
import { Navigate, createBrowserRouter } from "react-router";

import { dashboardsAtom } from "@/lib/atom/dashboard";
import { DashboardPage } from "@/pages/dashboard";
import { ExportPage } from "@/pages/export";
import { FlightReviewPage } from "@/pages/flight-review/index";
import { InstanceProtectedPage } from "@/pages/instance";
import { ProceduresPage } from "@/pages/procedures";

import { RootErrorBoundary } from "./error-boundary";

function DashboardIndex() {
  const dashboards = useAtomSuspense(dashboardsAtom).value;
  return <Navigate replace to={`/dashboards/${dashboards[0].slug}`} />;
}

export const router = createBrowserRouter([
  {
    errorElement: <RootErrorBoundary />,
    Component: InstanceProtectedPage,
    children: [
      { path: "/", element: <DashboardIndex /> },
      { path: "/dashboards/:slug", element: <DashboardPage /> },
      { path: "/export", element: <ExportPage /> },
      { path: "/procedures", element: <ProceduresPage /> },
      {
        path: "/flight",
        Component: FlightReviewPage,
      },
    ],
  },
]);
