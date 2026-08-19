import type { Value } from "@mrt/yamcs-effect";

import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { parameterSubscriptionAtom, selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";
import { makeCard } from "@/lib/cards";
import { FormTitleAnnotationId, FormTypeAnnotationId } from "@/lib/form";
import { cn } from "@/lib/utils";

type AggregateMembers = Extract<Value, { readonly type: "AGGREGATE" }>["value"];

export const SwitchPortsCard = makeCard({
  id: "switch-ports",
  name: "Switch Ports",
  schema: Schema.Struct({
    switch: Schema.String.pipe(
      Schema.annotate({
        [FormTitleAnnotationId]: "Switch",
        [FormTypeAnnotationId]: "omadaSwitch",
      }),
    ),
  }),
  component: ({ params }) => <SwitchPorts switchRoot={params.switch} />,
});

function SwitchPorts({ switchRoot }: { switchRoot: string }) {
  const root = switchRoot.replace(/\/$/, "");
  const portsResult = useAtomValue(parameterSubscriptionAtom(`${root}/ports`));
  const portCountResult = useAtomValue(parameterSubscriptionAtom(`${root}/port_count`));

  if (!AsyncResult.isSuccess(portsResult) || !AsyncResult.isSuccess(portCountResult)) {
    return (
      <div className="grid h-full place-items-center text-xs text-muted-foreground">
        Awaiting switch telemetry...
      </div>
    );
  }

  const portsValue = portsResult.value.value.engValue;
  const portCountValue = portCountResult.value.value.engValue;
  if (portsValue.type !== "ARRAY" || !("value" in portCountValue)) {
    return (
      <div className="grid h-full place-items-center text-xs text-error">
        Switch telemetry has an unexpected shape.
      </div>
    );
  }

  const portCount = Number(portCountValue.value);
  const ports = portsValue.value
    .slice(0, Number.isInteger(portCount) ? portCount : 0)
    .filter(
      (value): value is Extract<Value, { readonly type: "AGGREGATE" }> =>
        value.type === "AGGREGATE",
    );
  const usedPortCount = ports.filter(
    ({ value }) => enumeratedMember(value, "link_status") === "UP",
  ).length;
  const pairedRows = portCount > 10;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3">
      <div className="flex items-start justify-between gap-3 text-xs">
        <span className="truncate text-muted-foreground" title={root}>
          {root.split("/").filter(Boolean).at(-2) ?? "Switch"}
        </span>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="tabular-nums">
            Used <span className="text-success">{usedPortCount}</span>/{portCount}
          </span>
          <PortLegend />
        </div>
      </div>

      <div className="grid min-w-max flex-1 place-content-center">
        <div
          className="grid gap-x-2 gap-y-3"
          style={{
            gridAutoFlow: pairedRows ? "column" : "row",
            gridTemplateColumns: `repeat(${pairedRows ? Math.ceil(portCount / 2) : portCount}, minmax(2.75rem, 3.5rem))`,
            gridTemplateRows: pairedRows ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
          }}
        >
          {ports.map(({ value }, index) => (
            <Port key={numericMember(value, "port") ?? index} members={value} switchRoot={root} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PortLegend() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Port status legend"
            className="text-muted-foreground transition-colors hover:text-foreground"
          />
        }
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 gap-2">
        <PopoverTitle>Port status</PopoverTitle>
        <LegendItem className="border-success bg-success" label="1 or 10 Gbps" />
        <LegendItem className="border-yellow-500 bg-yellow-500" label="10 or 100 Mbps" />
        <LegendItem className="border-transparent bg-muted" label="Disconnected" />
        <LegendItem className="border-muted-foreground/40" label="Disabled" />
        <LegendItem className="border-muted ring-2 ring-success/40" label="Delivering PoE power" />
      </PopoverContent>
    </Popover>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-3 shrink-0 rounded-xs border", className)} />
      <span>{label}</span>
    </div>
  );
}

function Port({ members, switchRoot }: { members: AggregateMembers; switchRoot: string }) {
  const instance = useAtomValue(selectedInstanceAtom);
  const sendCommand = useAtomSet(YamcsAtomHttpClient.mutation("command", "issueCommand"));
  const port = numericMember(members, "port");
  const name = stringMember(members, "name");
  const linkStatus = enumeratedMember(members, "link_status");
  const linkSpeed = enumeratedMember(members, "link_speed");
  const disabled = booleanMember(members, "disabled");
  const supportsPoe = booleanMember(members, "support_poe");
  const poeMode = enumeratedMember(members, "poe_mode");
  const poeActive = booleanMember(members, "poe_active");
  const power = numericMember(members, "power_w");
  const clientCount = numericMember(members, "client_count") ?? 0;
  const clientNames = stringMember(members, "client_names");
  const connected = linkStatus === "UP";
  const poeEnabled = supportsPoe && poeMode === "ON";
  const poeDelivering = poeEnabled && (poeActive || (power ?? 0) > 0);
  const gigabit = linkSpeed === "1_GBPS" || linkSpeed === "10_GBPS";
  const label = poeEnabled ? "PoE" : connected ? speedLabel(linkSpeed) : "";
  const title = [
    `${name || `Port ${port ?? "--"}`}: ${disabled ? "Disabled" : connected ? "Connected" : "Disconnected"}`,
    connected && linkSpeed ? `Speed: ${linkSpeed.replaceAll("_", " ")}` : undefined,
    poeEnabled ? `PoE: ${poeDelivering ? `${power ?? 0} W` : "enabled"}` : undefined,
    clientCount > 0 ? `Clients (${clientCount}): ${clientNames}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="grid min-w-0 grid-rows-[auto_1fr] gap-1 text-center">
      <span className="text-xs tabular-nums text-muted-foreground">{port ?? "--"}</span>
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              title={title}
              className={cn(
                "grid aspect-square cursor-pointer place-items-center rounded-sm border text-xs font-medium transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                disabled && "border-muted-foreground/40 bg-transparent text-muted-foreground",
                !disabled && !connected && "border-transparent bg-muted text-muted-foreground",
                !disabled && connected && !gigabit && "border-yellow-500 bg-yellow-500 text-black",
                !disabled && connected && gigabit && "border-success bg-success text-black",
                poeDelivering && "ring-2 ring-success/40 ring-offset-1 ring-offset-background",
              )}
            />
          }
        >
          {label}
        </PopoverTrigger>
        <PopoverContent align="center" className="w-64 gap-3 text-left">
          <PopoverHeader>
            <PopoverTitle>{name || `Port ${port ?? "--"}`}</PopoverTitle>
            <span className="text-muted-foreground">
              {disabled ? "Disabled" : connected ? "Connected" : "Disconnected"}
              {connected && linkSpeed ? ` at ${linkSpeed.replaceAll("_", " ")}` : ""}
            </span>
          </PopoverHeader>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">Device name</dt>
            <dd className="min-w-0 break-words text-right">{clientNames || "Not reported"}</dd>
            <dt className="text-muted-foreground">Clients</dt>
            <dd className="text-right tabular-nums">{clientCount}</dd>
            <dt className="text-muted-foreground">PoE state</dt>
            <dd className="text-right">{supportsPoe ? poeMode : "Not supported"}</dd>
            <dt className="text-muted-foreground">PoE output power</dt>
            <dd className="text-right tabular-nums">{supportsPoe ? `${power ?? 0} W` : "N/A"}</dd>
          </dl>

          {port !== undefined ? (
            <div className="space-y-2 border-t border-border pt-2">
              {!disabled ? (
                <p className="text-muted-foreground">
                  Turning off the port disconnects Ethernet and cuts PoE power.
                </p>
              ) : null}
              <Button
                className="w-full"
                variant={disabled ? "default" : "destructive"}
                onClick={() =>
                  sendCommand({
                    params: {
                      instance,
                      processor: "realtime",
                      name: `${switchRoot}/set_port_status`,
                    },
                    payload: {
                      args: {
                        port: `PORT_${port}`,
                        status: disabled ? "ON" : "OFF",
                      },
                    },
                  })
                }
              >
                Turn Port {disabled ? "On" : "Off"}
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function member(members: AggregateMembers, name: string) {
  return members[name];
}

function numericMember(members: AggregateMembers, name: string) {
  const value = member(members, name);
  if (
    value?.type === "FLOAT" ||
    value?.type === "DOUBLE" ||
    value?.type === "SINT32" ||
    value?.type === "UINT32" ||
    value?.type === "SINT64" ||
    value?.type === "UINT64"
  ) {
    return value.value;
  }
  return undefined;
}

function stringMember(members: AggregateMembers, name: string) {
  const value = member(members, name);
  return value?.type === "STRING" ? value.value : undefined;
}

function enumeratedMember(members: AggregateMembers, name: string) {
  const value = member(members, name);
  return value?.type === "ENUMERATED" ? value.value : undefined;
}

function booleanMember(members: AggregateMembers, name: string) {
  const value = member(members, name);
  return value?.type === "BOOLEAN" ? value.value : false;
}

function speedLabel(speed: string | undefined) {
  switch (speed) {
    case "10_MBPS":
      return "10M";
    case "100_MBPS":
      return "100M";
    case "1_GBPS":
      return "1G";
    case "10_GBPS":
      return "10G";
    default:
      return "Up";
  }
}
