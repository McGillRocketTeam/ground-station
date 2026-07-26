import type { ReactNode } from "react";

import { useAtom } from "@effect/atom-react";
import { Option, Schema } from "effect";
import { useEffect } from "react";

import { themeAtom, ThemeFromJsonString, themeStorageKey, type Theme } from "@/lib/atom";

function syncThemeColor() {
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');

  if (!(themeColorMeta instanceof HTMLMetaElement)) {
    return;
  }

  const probe = document.createElement("div");

  probe.style.position = "fixed";
  probe.style.pointerEvents = "none";
  probe.style.opacity = "0";
  probe.style.color = "var(--background)";
  document.body.append(probe);

  themeColorMeta.content = getComputedStyle(probe).color;

  probe.remove();
}

export function resolveTheme(theme: Theme): Exclude<Theme, "system"> {
  if (theme !== "system") {
    return theme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useAtom(themeAtom);

  useEffect(() => {
    const syncStoredTheme = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || event.key !== themeStorageKey) return;

      if (event.newValue === null) {
        setTheme("system");
        return;
      }

      const storedTheme = Schema.decodeUnknownOption(ThemeFromJsonString)(event.newValue);
      if (Option.isSome(storedTheme)) setTheme(storedTheme.value);
    };

    window.addEventListener("storage", syncStoredTheme);
    return () => window.removeEventListener("storage", syncStoredTheme);
  }, [setTheme]);

  useEffect(() => {
    const root = window.document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      root.classList.remove("light", "dark");
      root.classList.add(resolveTheme(theme));
      syncThemeColor();
    };

    applyTheme();

    if (theme !== "system") {
      return;
    }

    media.addEventListener("change", applyTheme);

    return () => {
      media.removeEventListener("change", applyTheme);
    };
  }, [theme]);

  return children;
}

export function useTheme() {
  const [theme, setTheme] = useAtom(themeAtom);

  return { theme, setTheme };
}
