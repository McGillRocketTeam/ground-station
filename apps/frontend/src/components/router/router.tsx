import { createBrowserRouter, Outlet } from "react-router";
import { RootErrorBoundary } from "./error-boundary";
import { DebugPage } from "../pages/debug";

export const router = createBrowserRouter([
  {
    errorElement: <RootErrorBoundary />,
    children: [
      { path: "/", element: <div>Hello World!</div> },
      {
        path: "/debug",
        element: <DebugPage />,
      },
    ],
  },
]);
