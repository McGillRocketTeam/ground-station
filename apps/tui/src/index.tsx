import { useAtom } from "@effect/atom-react";
import { createCliRenderer, TextAttributes } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import { Suspense } from "react";

import { currentThemeAtom, themeList } from "./colors";
import { ParameterTable } from "./ui/parameter-table";
import { Text } from "./ui/text";

function App() {
  const [theme, setTheme] = useAtom(currentThemeAtom);

  useKeyboard((key) => {
    if (key.name !== "t" || key.ctrl || key.meta) {
      return;
    }

    setTheme((currentTheme) => {
      const currentIndex = themeList.findIndex(
        (theme) => theme._tag === currentTheme._tag,
      );

      return themeList[(currentIndex + 1) % themeList.length]!;
    });
  });

  return (
    <box backgroundColor={theme.background} flexGrow={1}>
      <box flexGrow={1} justifyContent="center">
        <box
          flexDirection="row"
          height={2}
          borderColor={theme.border}
          border={["bottom"]}
        >
          <Text fg={theme.gutterForeground}>
            MCGILL ROCKET TEAM * Ground Station
          </Text>
        </box>
        <box flexGrow={1}>
          <Suspense>
            <ParameterTable />
          </Suspense>
        </box>
        <box
          borderColor={theme.border}
          border={["top"]}
          flexDirection="row"
          gap={1}
          height={2}
        >
          <Text attributes={TextAttributes.BOLD}>c</Text>
          <Text fg={theme.border} marginRight={1}>
            commanding
          </Text>
          <Text attributes={TextAttributes.BOLD}>p</Text>
          <Text fg={theme.border} marginRight={1}>
            parameters
          </Text>
          <Text attributes={TextAttributes.BOLD}>t</Text>
          <Text fg={theme.border} marginRight={1}>
            theme
          </Text>
        </box>
      </box>
    </box>
  );
}

const renderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(renderer).render(<App />);
