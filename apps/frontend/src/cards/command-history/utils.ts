import { stringifyValue } from "@/lib/utils";
import type { CommandHistoryEvent } from "@mrt/yamcs-effect";

export type CommandHistoryEntry = (typeof CommandHistoryEvent.Type)["data"];

export function extractAttribute(command: CommandHistoryEntry, attr: string) {
  return command.attr.find((a) => a.name === attr)?.value;
}

export function extractAcknowledgement(
  command: CommandHistoryEntry,
  ack: string,
) {
  const statusValue = extractAttribute(command, `Acknowledge_${ack}_Status`);
  const timeValue = extractAttribute(command, `Acknowledge_${ack}_Time`);

  return {
    status: stringifyValue(statusValue, "??"),
    time: timeValue?.type === "TIMESTAMP" ? timeValue.value : undefined,
  };
}

export function formatCommandDate(d: Date) {
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

  return (isToday ? "Today" : d.toLocaleDateString()) + ", " + time;
}
