import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { useEffect, useRef, useState } from "react";

import { parameterSubscriptionAtom, selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";
import { makeCard } from "@/lib/cards";
import {
  ControlBoxCommandArrayField,
  type ControlBoxCommandArrayEntry,
  normalizeControlBoxCommandEntry,
} from "@/lib/command-config";
import { cn } from "@/lib/utils";

import {
  completeControlBoxEntries,
  type ControlBoxStateSource,
  getControlBoxControl,
} from "./config";

export const ControlBoxCard = makeCard({
  id: "control-box",
  name: "Control Box Card",
  schema: Schema.Struct({
    commands: ControlBoxCommandArrayField,
  }),
  component: ({ params }) => <ControlBoxGrid commands={params.commands ?? []} />,
});

function ControlBoxGrid({ commands }: { commands: ReadonlyArray<ControlBoxCommandArrayEntry> }) {
  const instance = useAtomValue(selectedInstanceAtom);
  const sendCommand = useAtomSet(YamcsAtomHttpClient.mutation("command", "issueCommand"));
  const gridRef = useRef<HTMLDivElement>(null);
  const [armedIndex, setArmedIndex] = useState<number | null>(null);
  const entries = completeControlBoxEntries(commands);

  useEffect(() => {
    if (armedIndex === null) return;

    const timeout = window.setTimeout(() => setArmedIndex(null), 2_000);
    const disarmOutsideCurrentCell = (event: PointerEvent) => {
      const target = event.target;
      const currentCell =
        target instanceof Element ? target.closest(`[data-command-index="${armedIndex}"]`) : null;

      if (currentCell && gridRef.current?.contains(currentCell)) return;
      setArmedIndex(null);
    };

    document.addEventListener("pointerdown", disarmOutsideCurrentCell, true);

    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("pointerdown", disarmOutsideCurrentCell, true);
    };
  }, [armedIndex]);

  return (
    <div ref={gridRef} className="h-full overflow-auto">
      <div
        className="mx-auto grid w-full content-start border-t border-l border-border"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          maxWidth: `${entries.length * 500}px`,
        }}
      >
        {entries.map((value, index) => {
          const entry = normalizeControlBoxCommandEntry(value);
          const control = getControlBoxControl(entry);
          const displayName = entry.localName?.trim() || entry.command;
          const onActions = control?.onActions ?? [{ command: entry.command, args: entry.args }];
          const offActions = control?.offActions ?? [];

          return (
            <ControlBoxState
              key={`${control?.id ?? entry.command}-${index}`}
              sources={control?.state ?? []}
            >
              {({ active, known }) => (
                <button
                  type="button"
                  data-active={active}
                  data-armed={armedIndex === index}
                  data-command-index={index}
                  className={cn(
                    "group grid aspect-square min-w-0 cursor-pointer grid-cols-[minmax(0,1fr)] place-content-center gap-2 overflow-hidden border-r border-b border-border p-4 text-center transition-colors",
                    "data-[active=true]:border-success data-[active=true]:bg-success/10",
                    "data-[armed=true]:border-error data-[armed=true]:bg-error data-[armed=true]:text-error-foreground",
                  )}
                  onClick={() => {
                    if (armedIndex !== index) {
                      setArmedIndex(index);
                      return;
                    }

                    const actions = active && offActions.length > 0 ? offActions : onActions;
                    for (const action of actions) {
                      sendCommand({
                        params: {
                          instance,
                          processor: "realtime",
                          name: action.command,
                        },
                        payload: Object.keys(action.args).length > 0 ? { args: action.args } : {},
                      });
                    }
                    setArmedIndex(null);
                  }}
                >
                  <div className="w-full min-w-0 text-sm font-normal [overflow-wrap:anywhere]">
                    {displayName}
                  </div>
                  <div
                    className={cn(
                      "mt-2 text-xs font-medium uppercase",
                      active ? "text-success" : "text-muted-foreground",
                      "group-data-[armed=true]:text-error-foreground",
                    )}
                  >
                    {known ? (active ? "Energized" : "De-energized") : "State unknown"}
                  </div>
                </button>
              )}
            </ControlBoxState>
          );
        })}
      </div>
    </div>
  );
}

function ControlBoxState({
  active = false,
  allKnown = true,
  children,
  index = 0,
  sources,
}: {
  active?: boolean;
  allKnown?: boolean;
  children: (state: { active: boolean; known: boolean }) => React.ReactNode;
  index?: number;
  sources: ReadonlyArray<ControlBoxStateSource>;
}) {
  const source = sources[index];
  if (!source) {
    return children({
      active,
      known: sources.length > 0 && (active || allKnown),
    });
  }

  return (
    <ControlBoxStateProbe source={source}>
      {(sourceActive) => (
        <ControlBoxState
          active={active || sourceActive === true}
          allKnown={allKnown && sourceActive !== undefined}
          index={index + 1}
          sources={sources}
        >
          {children}
        </ControlBoxState>
      )}
    </ControlBoxStateProbe>
  );
}

function ControlBoxStateProbe({
  children,
  source,
}: {
  children: (active: boolean | undefined) => React.ReactNode;
  source: ControlBoxStateSource;
}) {
  const result = useAtomValue(parameterSubscriptionAtom(source.parameter));
  if (!AsyncResult.isSuccess(result)) return children(undefined);

  const value = result.value.value.engValue;
  if (value.type === "BOOLEAN" && typeof source.activeValue === "boolean") {
    return children(value.value === source.activeValue);
  }
  if (value.type === "ENUMERATED" && typeof source.activeValue === "string") {
    return children(value.value === source.activeValue);
  }

  return children(undefined);
}
