import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Atom } from "@effect-atom/atom-react";
import { ConfigProvider, Layer, Logger } from "effect";
import { RouterProvider } from "react-router";
import { router } from "./components/router/router.tsx";
import { ThemeProvider } from "./components/theme-provider.tsx";
import "./index.css";

Atom.runtime.addGlobalLayer(Logger.pretty);
Atom.runtime.addGlobalLayer(
  Layer.setConfigProvider(ConfigProvider.fromJson(import.meta.env)),
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
);
