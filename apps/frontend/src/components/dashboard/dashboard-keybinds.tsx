import { useAtomSet, useAtomSuspense } from "@effect/atom-react";
import { useHotkeySequence } from "@tanstack/react-hotkeys";
import { Suspense } from "react";

import { selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";

import { switchInstanceMenuAtom } from "./dashboard-command";

export function DashboardKeybinds() {
  return (
    <>
      <Suspense>
        <InstanceCommandKeybinds />
      </Suspense>
    </>
  );
}

function InstanceCommandKeybinds() {
  const setInstance = useAtomSet(selectedInstanceAtom);
  const setSwitchInstanceOpen = useAtomSet(switchInstanceMenuAtom);

  const { instances } = useAtomSuspense(
    YamcsAtomHttpClient.query("instances", "listInstances", {}),
  ).value;

  instances.forEach((instance, index) => {
    useHotkeySequence(["O", "I", (index + 1).toString() as "0"], () => {
      setSwitchInstanceOpen(false);
      setInstance(instance.name);
    });
  });

  return <></>;
}
