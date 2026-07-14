import type { TextProps } from "@opentui/react";

import { useAtomValue } from "@effect/atom-react";

import { currentThemeAtom, textTheme } from "../colors";

export function Text({ children, ...props }: TextProps) {
  const theme = useAtomValue(currentThemeAtom);
  return (
    <text
      fg={theme.foreground}
      bg={theme.background}
      selectionFg={theme.selectionForeground}
      selectionBg={theme.selection}
      {...props}
    >
      {children}
    </text>
  );
}
