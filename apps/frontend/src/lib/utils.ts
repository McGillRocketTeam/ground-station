import type { Value } from "@mrt/yamcs-effect";

import { clsx, type ClassValue } from "clsx";
import { DateTime } from "effect";
import { twMerge } from "tailwind-merge";

const utcDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function createId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return [...bytes]
    .map((byte, index) => {
      const value = byte.toString(16).padStart(2, "0");
      return [4, 6, 8, 10].includes(index) ? `-${value}` : value;
    })
    .join("");
}

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
    case "ENUMERATED":
      return value.value.toLocaleString();
    case "TIMESTAMP":
      return formatUtcDateTime(value.value);
    case "AGGREGATE":
    default:
      return fallback ?? "Unknown";
  }
}

export function formatUtcDateTime(date: Date | DateTime.DateTime) {
  return date instanceof Date
    ? utcDateTimeFormatter.format(date)
    : DateTime.formatIntl(date, utcDateTimeFormatter);
}

export function formatDate(date: Date | DateTime.DateTime) {
  const value = date instanceof Date ? date : DateTime.toDate(date);
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

  const day = String(value.getDate()).padStart(2, "0");
  const month = months[value.getMonth()];

  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  const seconds = String(value.getSeconds()).padStart(2, "0");

  return `${day} ${month} ${hours}:${minutes}:${seconds}`;
}
