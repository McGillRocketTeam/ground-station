import { Atom } from "effect/unstable/reactivity";

export const colors = {
  black: "#000000",
  white: "#FFFFFF",
  fl_red: "#FF0000",
  fl_green: "#00FF00",
  fl_blue: "#0000FF",
  fl_cyan: "#00FFFF",
  fl_magenta: "#FF00FF",
  fl_yellow: "#FFFF00",
  fl_orange: "#FF6600",
  maroon: "#660000",
  green: "#00A645",
  blue: "#000066",
  cyan: "#006666",
  magenta: "#660066",
  yellow: "#FFBF00",
  olive: "#666600",
  gray: "#999999",
} as const;

/*
 *   	"background": "var(black)",
        "foreground": "var(yellow)",
        "caret": "var(green)",
        "block_caret": "var(green)",
        "selection": "var(blue)",
        "selection_foreground": "var(fl_cyan)",
        "selection_corner_style": "cut",
        "selection_corner_radius": "2",
        "inactive_selection": "var(gray)",
        "inactive_selection_foreground": "var(fl_blue)",
        "inactive_sheet_dimming": "0",
        "gutter": "var(black)",
        "gutter_foreground": "var(fl_orange)",
        "line_highlight": "var(fl_blue)",
        "gutter_foreground_highlight": "var(white)",
 */

export const usgcPolyimide = {
  _tag: "USGC-POLYIMIDE",
  background: colors.black,
  foreground: colors.yellow,
  caret: colors.green,
  blockCaret: colors.green,
  selection: colors.blue,
  selectionForeground: colors.fl_cyan,
  inactiveSelection: colors.gray,
  inactive_selection_foreground: colors.fl_blue,
  gutter: colors.black,
  gutterForeground: colors.fl_orange,
  lineHighlight: colors.blue,
  gutterForegroundHighlight: colors.white,
  border: colors.gray,
} as const;

export const usgcReticle = {
  _tag: "USGC-RETICLE",
  background: colors.black,
  foreground: colors.green,
  caret: colors.white,
  blockCaret: colors.white,
  selection: colors.white,
  selectionForeground: colors.fl_blue,
  inactiveSelection: colors.gray,
  inactive_selection_foreground: colors.fl_blue,
  gutter: colors.black,
  gutterForeground: colors.fl_red,
  lineHighlight: colors.fl_blue,
  gutterForegroundHighlight: colors.white,
  border: colors.gray,
} as const;

export const usgcMetalGateSt = {
  _tag: "USGC-METALGATE-ST",
  background: colors.black,
  foreground: colors.fl_cyan,
  caret: colors.fl_blue,
  blockCaret: colors.fl_blue,
  selection: colors.olive,
  selectionForeground: colors.fl_yellow,
  inactiveSelection: colors.gray,
  inactive_selection_foreground: colors.fl_blue,
  gutter: colors.black,
  gutterForeground: colors.fl_yellow,
  lineHighlight: colors.fl_blue,
  gutterForegroundHighlight: colors.fl_cyan,
  border: colors.gray,
} as const;

export const usgcHighKSt = {
  _tag: "USGC-HIGH-K-ST",
  background: colors.white,
  foreground: colors.black,
  caret: colors.fl_blue,
  blockCaret: colors.fl_blue,
  selection: colors.fl_green,
  selectionForeground: colors.black,
  inactiveSelection: colors.gray,
  inactive_selection_foreground: colors.fl_blue,
  gutter: colors.white,
  gutterForeground: colors.fl_red,
  lineHighlight: colors.fl_green,
  gutterForegroundHighlight: colors.black,
  border: colors.gray,
} as const;

export const usgcEpitaxySt = {
  _tag: "USGC-EPITAXY-ST",
  background: colors.black,
  foreground: colors.fl_magenta,
  caret: colors.white,
  blockCaret: colors.white,
  selection: colors.blue,
  selectionForeground: colors.fl_yellow,
  inactiveSelection: colors.gray,
  inactive_selection_foreground: colors.fl_blue,
  gutter: colors.black,
  gutterForeground: colors.fl_blue,
  lineHighlight: colors.fl_yellow,
  gutterForegroundHighlight: colors.black,
  border: colors.gray,
} as const;

export const themeList = [
  usgcPolyimide,
  usgcReticle,
  usgcMetalGateSt,
  usgcHighKSt,
  usgcEpitaxySt,
] as const;

export type Theme = (typeof themeList)[number];

export const currentThemeAtom = Atom.make<Theme>(usgcPolyimide);

export const textTheme = {} as const;
