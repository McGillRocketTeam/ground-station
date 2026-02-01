import type { Value } from "@mrt/yamcs-effect";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type DisplayNumber = { kind: "number"; value: number };
type DisplayString = { kind: "string"; value: string };
type DisplayNone = { kind: "none" };

type Display = DisplayNumber | DisplayString | DisplayNone;

export function stringifyValue(value?: typeof Value.Type, fallback?: string) {
  if (!value) return fallback ?? "Unknown";
  switch (value.type) {
    case "FLOAT":
    case "DOUBLE":
    case "SINT32":
    case "UINT32":
    case "SINT64":
    case "UINT64":
    case "STRING":
    case "BOOLEAN":
    case "TIMESTAMP":
      return value.value.toLocaleString();
    case "ENUMERATED":
    case "AGGREGATE":
    default:
      return fallback ?? "Unknown";
  }
}

export function displayValue(value: typeof Value.Type): Display {
  switch (value.type) {
    case "FLOAT":
    case "DOUBLE":
    case "SINT32":
    case "UINT32":
    case "SINT64":
    case "UINT64":
      return { kind: "number", value: value.value };
    case "ENUMERATED":
    case "AGGREGATE":
      return { kind: "none" };
    default:
      return { kind: "string", value: value.value.toString() };
  }
}
