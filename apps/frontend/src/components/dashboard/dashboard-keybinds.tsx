import type { RegisterableHotkey } from "@tanstack/react-hotkeys";

import { useAtomSet, useAtomSuspense } from "@effect/atom-react";
import { useHotkey, useHotkeySequence } from "@tanstack/react-hotkeys";
import { Suspense } from "react";

import { selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";

import type {
  DashboardAction,
  DashboardActionGroup,
} from "./dashboard-actions";

import {
  flattenDashboardActionGroups,
  useDashboardDashboardActionGroups,
  useDashboardViewActionGroups,
} from "./dashboard-actions";
import { switchInstanceMenuAtom } from "./dashboard-command";

export function DashboardKeybinds() {
  const dashboardGroups = useDashboardDashboardActionGroups();
  const viewGroups = useDashboardViewActionGroups();

  return (
    <>
      <DashboardActionKeybinds groups={dashboardGroups} />
      <DashboardActionKeybinds groups={viewGroups} />
      <Suspense>
        <InstanceCommandKeybinds />
      </Suspense>
    </>
  );
}

function DashboardActionKeybinds({
  groups,
}: {
  groups: ReadonlyArray<DashboardActionGroup>;
}) {
  return flattenDashboardActionGroups(groups).map((action) =>
    action.shortcut ? (
      <DashboardActionKeybind
        action={action}
        hotkey={action.shortcut}
        key={action.id}
      />
    ) : null,
  );
}

function DashboardActionKeybind({
  action,
  hotkey,
}: {
  action: DashboardAction;
  hotkey: RegisterableHotkey;
}) {
  useHotkey(
    hotkey,
    () => {
      if (action.disabled) {
        return;
      }

      action.run();
    },
    { conflictBehavior: "allow", stopPropagation: false },
  );

  return <></>;
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
