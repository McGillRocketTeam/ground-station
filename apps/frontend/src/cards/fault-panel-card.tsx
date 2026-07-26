import { useAtomValue } from "@effect/atom-react";
import { Cause, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

import { parameterSubscriptionAtom } from "@/lib/atom";
import { makeCard } from "@/lib/cards";
import { cn } from "@/lib/utils";

const faults = [
  {
    name: "FC\nOPERATIONAL",
    parameter: "/SystemA/Derived/Rocket/FlightComputer/operational_health",
  },
  {
    name: "FC\nTELEMETRY",
    parameter: "/SystemA/Derived/Rocket/FlightComputer/telemetry_health",
  },
  {
    name: "DROGUE\nRECOVERY",
    parameter: "/SystemA/Derived/Rocket/Recovery/drogue_health",
  },
  {
    name: "MAIN\nRECOVERY",
    parameter: "/SystemA/Derived/Rocket/Recovery/main_health",
  },
  {
    name: "RECOVERY\nREADINESS",
    parameter: "/SystemA/Derived/Rocket/Recovery/readiness",
  },
  {
    name: "MOV\nPROPULSION",
    parameter: "/SystemA/Derived/Rocket/Propulsion/mov_health",
  },
  {
    name: "F/DOV\nPROPULSION",
    parameter: "/SystemA/Derived/Rocket/Propulsion/fdov_health",
  },
  {
    name: "VENT\nPROPULSION",
    parameter: "/SystemA/Derived/Rocket/Propulsion/vent_health",
  },
  {
    name: "PROPULSION\nREADINESS",
    parameter: "/SystemA/Derived/Rocket/Propulsion/readiness",
  },
  {
    name: "GPS\nNAVIGATION",
    parameter: "/SystemA/Derived/Rocket/Navigation/solution_health",
  },
  {
    name: "SD\nRECORDING",
    parameter: "/SystemA/Derived/Rocket/Storage/recording_health",
  },
  {
    name: "CONTROL\nRADIO",
    parameter: "/SystemA/Derived/ControlStation/Radio/link_health",
  },
  {
    name: "PAD\nRADIO",
    parameter: "/SystemA/Derived/Pad/Radio/link_health",
  },
  {
    name: "SYSTEMA\nCOMMS",
    parameter: "/SystemA/Derived/Communications/capability",
  },
] as const;

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
