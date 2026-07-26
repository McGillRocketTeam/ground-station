import { useAtomSuspense } from "@effect/atom-react";
import { Suspense } from "react";

import type { LiveParameterUpdate } from "@/lib/atom";

import { parameterSubscriptionAtom } from "@/lib/atom";
import { cn } from "@/lib/utils";

export const ROUTER_ROOT = "/EGSE/ControlStation/WifiRouter";

function readValue(update: LiveParameterUpdate) {
  const value = update.value.engValue;
  return "value" in value ? value.value : undefined;
}

function ResolvedTelemetryValue({
  className,
  format,
  parameter,
}: {
  className?: string | ((value: unknown) => string);
  format?: (value: unknown) => string;
  parameter: string;
}) {
  const update = useAtomSuspense(parameterSubscriptionAtom(parameter)).value as LiveParameterUpdate;
  const value = readValue(update);

  return (
    <span className={typeof className === "function" ? className(value) : className}>
      {format ? format(value) : String(value ?? "--")}
    </span>
  );
}

export function TelemetryValue({
  className,
  fallback = "--",
  format,
  parameter,
}: {
  className?: string | ((value: unknown) => string);
  fallback?: string;
  format?: (value: unknown) => string;
  parameter: string;
}) {
  return (
    <Suspense
      fallback={
        <span className={cn("text-muted-foreground", typeof className === "string" && className)}>
          {fallback}
        </span>
      }
    >
      <ResolvedTelemetryValue className={className} format={format} parameter={parameter} />
    </Suspense>
  );
}

export function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function fixed(decimals: number, suffix = "") {
  return (value: unknown) => {
    const number = numberValue(value);
    return number === undefined ? "--" : `${number.toFixed(decimals)}${suffix}`;
  };
}

export function integer(suffix = "") {
  return (value: unknown) => {
    const number = numberValue(value);
    return number === undefined ? "--" : `${Math.round(number).toLocaleString()}${suffix}`;
  };
}

export function duration(value: unknown) {
  const seconds = numberValue(value);
  if (seconds === undefined) return "--";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return days > 0 ? `${days}D ${hours}H` : `${hours}H ${minutes}M`;
}

export function boolean(value: unknown) {
  return typeof value === "boolean" ? String(value).toUpperCase() : "--";
}
