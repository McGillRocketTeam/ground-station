import { useAtomValue } from "@effect/atom-react";
import { Cause, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

import { parameterSubscriptionAtom } from "@/lib/atom";
import { makeCard } from "@/lib/cards";
import { cn } from "@/lib/utils";

export const FaultPanelCard = makeCard({
  id: "fault-panel-card",
  name: "Fault Panel Card",
  schema: Schema.Struct({}),
  component: () => (
    <div>Hello</div>
    // <div className="grid grid-cols-4">
    //   {faults.map((fault) => (
    //     <Fault key={fault.parameter} {...fault} />
    //   ))}
    // </div>
  ),
});

type Status = "success" | "error" | "warning" | "none";

export function Fault({ name, parameter }: { name: string; parameter: string }) {
  const result = useAtomValue(parameterSubscriptionAtom(parameter));

  return AsyncResult.builder(result)
    .onInitial(() => <FaultState name={name} title="Awaiting value" />)
    .onFailure((cause) => (
      <FaultState name={name} status="error" title={Cause.pretty(cause)} illuminated />
    ))
    .onSuccess((update) => {
      const value = update.value.engValue;
      const state = value.type === "ENUMERATED" ? value.value : undefined;

      return <FaultState name={name} state={state} />;
    })
    .render();
}

function FaultState({
  illuminated: illuminatedOverride,
  name,
  state,
  status: statusOverride,
  title,
}: {
  illuminated?: boolean;
  name: string;
  state?: string;
  status?: Status;
  title?: string;
}) {
  const status: Status =
    statusOverride ??
    (state === "CRITICAL" || state === "FAULT"
      ? "error"
      : state === "DEGRADED" || state === "NOT_READY"
        ? "warning"
        : state === "NOMINAL" || state === "READY" || state === "ACTIVE" || state === "COMPLETE"
          ? "success"
          : "none");
  const illuminated = illuminatedOverride ?? status !== "none";

  return (
    <button
      type="button"
      data-illuminated={illuminated}
      title={title ?? state ?? "Unknown"}
      className={cn(
        "whitespace-pre-line text-border border text-center grid place-items-center font-mono py-1",
        status === "success" && "data-[illuminated=true]:text-success",
        status === "error" &&
          "data-[illuminated=true]:text-error border-current border-2 bg-current/10",
        status === "warning" && "data-[illuminated=true]:text-warning",
      )}
    >
      {name}
    </button>
  );
}
