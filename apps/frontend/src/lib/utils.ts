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

export function formatDate(date: Date) {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${day} ${month} ${hours}:${minutes}:${seconds}`;
}
