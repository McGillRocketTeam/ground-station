import { RegistryContext } from "@effect/atom-react";
import { RouterProvider } from "@tanstack/react-router";
import { Logger } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { ThemeProvider } from "./components/theme-provider.tsx";
import { TooltipProvider } from "./components/ui/tooltip.tsx";
import { atomRegistry } from "./lib/atom-registry.ts";
import { router } from "./router.tsx";

Atom.runtime.addGlobalLayer(Logger.layer([Logger.consolePretty()]));

if ("serviceWorker" in navigator) {
  void window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RegistryContext.Provider value={atomRegistry}>
      <ThemeProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </ThemeProvider>
    </RegistryContext.Provider>
  </StrictMode>,
);
