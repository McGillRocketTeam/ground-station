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
} from "@/components/ui/command";
import { selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";

export const dashboardCommandMenuAtom = Atom.make(false);
export const sendCommandMenuAtom = Atom.make(false);
export const switchInstanceMenuAtom = Atom.make(false);

export function DashboardCommandMenu() {
  const [open, setOpen] = useAtom(dashboardCommandMenuAtom);
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
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
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
  const setInstance = useAtomSet(selectedInstanceAtom);
  const { instances } = useAtomSuspense(
    YamcsAtomHttpClient.query("instances", "listInstances", {}),
  ).value;

  const setOpen = useAtomSet(dashboardCommandMenuAtom);
  const setSwitchInstanceOpen = useAtomSet(switchInstanceMenuAtom);

  const handleSelect = (value: string) => {
    setInstance(value);
    setSwitchInstanceOpen(false);
    setOpen(false);
  };

  return (
    <CommandGroup heading="Open Instance">
      {instances.map((instance, index) => (
        <CommandItem
          onSelect={handleSelect}
          key={instance.name}
          value={instance.name}
        >
          <span className="font-mono uppercase">{index + 1}</span>
          <span className="font-mono uppercase">{instance.name}</span>
          <CommandShortcut>{"O then I"}</CommandShortcut>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
