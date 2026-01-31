import { createBrowserRouter } from "react-router";
import { RootErrorBoundary } from "./error-boundary";
import { DebugPage } from "@/pages/debug";
import { DashboardPage } from "@/pages/dashboard";

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
