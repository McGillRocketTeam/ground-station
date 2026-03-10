import { createBrowserRouter } from "react-router";

import { DashboardPage } from "@/pages/dashboard";
import { DebugPage } from "@/pages/debug";
import { InstanceProtectedPage } from "@/pages/instance";
import { ProceduresPage } from "@/pages/procedures";

import { RootErrorBoundary } from "./error-boundary";

export const router = createBrowserRouter([
  {
    errorElement: <RootErrorBoundary />,
    Component: InstanceProtectedPage,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/procedures", element: <ProceduresPage /> },
      {
        path: "/debug",
        element: <DebugPage />,
      },
    ],
  },
]);
