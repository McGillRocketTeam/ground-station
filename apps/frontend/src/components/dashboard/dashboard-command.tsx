import type { ConsequenceLevel } from "@mrt/yamcs-effect";

import {
  useAtom,
  useAtomSet,
  useAtomSuspense,
  useAtomValue,
} from "@effect/atom-react";
import { useHotkey, useHotkeySequence } from "@tanstack/react-hotkeys";
import { Atom } from "effect/unstable/reactivity";
import { Suspense } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";
import { selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";

import {
  DashboardActionCommandGroups,
  useDashboardDashboardActionGroups,
  useDashboardInstanceActionGroups,
  useDashboardViewActionGroups,
} from "./dashboard-actions";

export const dashboardCommandMenuAtom = Atom.make(false);
export const sendCommandMenuAtom = Atom.make(false);
export const switchInstanceMenuAtom = Atom.make(false);

export function DashboardCommandMenu() {
  const [open, setOpen] = useAtom(dashboardCommandMenuAtom);
  const setSendCommandOpen = useAtomSet(sendCommandMenuAtom);
  useHotkey(
    "Mod+K",
    () => {
      setOpen((v) => !v);
    },
    { conflictBehavior: "allow", stopPropagation: false },
  );

  return (
    <>
      <Suspense>
        <SendCommandDialog />
      </Suspense>
      <Suspense>
        <SwitchInstanceDialog />
      </Suspense>
      <CommandDialog
        className="sm:max-w-130 w-full"
        open={open}
        onOpenChange={setOpen}
      >
        <Command>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Commands">
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  setSendCommandOpen(true);
                }}
              >
                Send Command
              </CommandItem>
            </CommandGroup>
            <Suspense>
              <InstanceCommandGroup />
            </Suspense>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

function SendCommandDialog() {
  const [open, setOpen] = useAtom(sendCommandMenuAtom);
  useHotkeySequence(["Space", "S", "C"], () => {
    setOpen((v) => !v);
  });
  const sendCommand = useAtomSet(
    YamcsAtomHttpClient.mutation("command", "issueCommand"),
  );

  const instance = useAtomValue(selectedInstanceAtom);
  const { commands } = useAtomSuspense(
    YamcsAtomHttpClient.query("mdb", "listCommands", {
      params: { instance },
      query: {},
    }),
  ).value;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Send Command">
            {commands.map((command) => (
              <CommandItem
                key={command.shortDescription}
                onSelect={() => {
                  setOpen(false);

                  sendCommand({
                    params: {
                      instance,
                      processor: "realtime",
                      name: command.qualifiedName,
                    },
                    payload: {},
                  });
                }}
              >
                <CommandConsequenceLevelIcon
                  level={command.significance?.consequenceLevel}
                />
                {command.longDescription}
                <CommandShortcut className="font-mono text-xs uppercase">
                  {command.shortDescription}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

function CommandConsequenceLevelIcon({
  level,
}: {
  level: typeof ConsequenceLevel.Type | undefined;
}) {
  const activeBars =
    level === "WATCH"
      ? 1
      : level === "WARNING"
        ? 2
        : level === "DISTRESS" || level === "SEVERE" || level === "CRITICAL"
          ? 3
          : 0;
  const isDangerLevel = level === "SEVERE" || level === "CRITICAL";

  return (
    <svg
      aria-hidden="true"
      className="size-3.5 overflow-visible"
      viewBox="0 0 18 18"
    >
      {[
        { x: 1.5, y: 10.5, height: 6 },
        { x: 7.5, y: 6.5, height: 10 },
        { x: 13.5, y: 2.5, height: 14 },
      ].map((bar, index) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={bar.y}
          width={3}
          height={bar.height}
          className={
            index < activeBars
              ? isDangerLevel
                ? "fill-current text-destructive"
                : "fill-current"
              : "fill-current opacity-20"
          }
        />
      ))}
    </svg>
  );
}

function SwitchInstanceDialog() {
  const [open, setOpen] = useAtom(switchInstanceMenuAtom);
  useHotkeySequence(["Space", "O", "I"], () => {
    setOpen((v) => !v);
  });

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command>
        <CommandList>
          <InstanceCommandGroup />
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

function InstanceCommandGroup() {
  const setOpen = useAtomSet(dashboardCommandMenuAtom);
  const setSwitchInstanceOpen = useAtomSet(switchInstanceMenuAtom);
  const dashboardGroups = useDashboardDashboardActionGroups();
  const viewGroups = useDashboardViewActionGroups();
  const instanceGroups = useDashboardInstanceActionGroups();

  return (
    <>
      <DashboardActionCommandGroups
        groups={dashboardGroups}
        onAction={() => setOpen(false)}
      />
      <CommandSeparator />
      <DashboardActionCommandGroups
        groups={viewGroups}
        onAction={() => setOpen(false)}
      />
      <CommandSeparator />
      <DashboardActionCommandGroups
        groups={instanceGroups}
        onAction={() => {
          setSwitchInstanceOpen(false);
          setOpen(false);
        }}
      />
    </>
  );
}
