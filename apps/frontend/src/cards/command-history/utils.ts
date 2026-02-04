import { stringifyValue } from "@/lib/utils";
import type { CommandHistoryEvent } from "@mrt/yamcs-effect";

export type CommandHistoryEntry = (typeof CommandHistoryEvent.Type)["data"];

export function extractAttribute(command: CommandHistoryEntry, attr: string) {
  return command.attr.find((a) => a.name === attr)?.value;
}

export type Ack = {
  name: string;
  status: string;
  time: Date | undefined;
  message: string | undefined;
};

interface Acks {
  groundStation: Ack[];
  radio: Ack[];
  flightComputer: Ack[];
}

function validAck(ack: Ack): boolean {
  return ack.status !== "??";
}

export function collectAcks(command: CommandHistoryEntry): Acks {
  return {
    groundStation: [
      extractAcknowledgement(command, "Queued"),
      extractAcknowledgement(command, "Released"),
      extractAcknowledgement(command, "Sent"),
    ].filter(validAck),

    radio: [
      extractAcknowledgement(command, "Radio_RX"),
      extractAcknowledgement(command, "Radio_TX"),
    ].filter(validAck),

    flightComputer: [
      extractAcknowledgement(command, "CommandComplete", true),
    ].filter(validAck),
  };
}

export function extractAcknowledgement(
  command: CommandHistoryEntry,
  ack: string,
  customPrefix?: boolean,
) {
  const statusValue = extractAttribute(
    command,
    `${customPrefix ? "" : "Acknowledge_"}${ack}_Status`,
  );
  const timeValue = extractAttribute(
    command,
    `${customPrefix ? "" : "Acknowledge_"}${ack}_Time`,
  );

  const messageValue = extractAttribute(
    command,
    `${customPrefix ? "" : "Acknowledge_"}${ack}_Message`,
  );

  return {
    name: ack,
    status: stringifyValue(statusValue, "??"),
    time: timeValue?.type === "TIMESTAMP" ? timeValue.value : undefined,
    message: messageValue?.type === "STRING" ? messageValue.value : undefined,
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
