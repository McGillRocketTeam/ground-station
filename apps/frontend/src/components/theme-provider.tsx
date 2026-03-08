import type { ReactNode } from "react";

import { useAtom } from "@effect/atom-react";
import { useEffect } from "react";

import { themeAtom, type Theme } from "@/lib/atom";

export function resolveTheme(theme: Theme): Exclude<Theme, "system"> {
  if (theme !== "system") {
    return theme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme] = useAtom(themeAtom);

  useEffect(() => {
    const root = window.document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      root.classList.remove("light", "dark");
      root.classList.add(resolveTheme(theme));
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
