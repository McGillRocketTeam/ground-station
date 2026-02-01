import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { ThemeProvider } from "./components/theme-provider.tsx";
import { RouterProvider } from "react-router";
import { router } from "./components/router/router.tsx";
import { Atom } from "@effect-atom/atom-react";
import { Logger, ConfigProvider, Layer } from "effect";

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
