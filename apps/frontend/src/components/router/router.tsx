import { DashboardPage } from "@/pages/dashboard";
import { DebugPage } from "@/pages/debug";
import { createBrowserRouter } from "react-router";
import { RootErrorBoundary } from "./error-boundary";

export const router = createBrowserRouter([
  {
    errorElement: <RootErrorBoundary />,
    children: [
      { path: "/", element: <DashboardPage /> },
      {
        path: "/debug",
        element: <DebugPage />,
      },
    ],
  },
]);
