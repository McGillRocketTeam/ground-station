import { Logger } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import { router } from "./components/router/router.tsx";
import "./index.css";
import { ThemeProvider } from "./components/theme-provider.tsx";

Atom.runtime.addGlobalLayer(Logger.layer([Logger.consolePretty()]));
// Atom.runtime.addGlobalLayer(
//   Layer.setConfigProvider(ConfigProvider.makeRecord(import.meta.env)),
// );

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
);
