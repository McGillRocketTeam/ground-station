import type { CommandHistoryEvent } from "@mrt/yamcs-effect";

import { stringifyValue } from "@/lib/utils";

export type CommandHistoryEntry = (typeof CommandHistoryEvent.Type)["data"];

export function extractAttribute(command: CommandHistoryEntry, attr: string) {
  return command.attr.find((a) => a.name === attr)?.value;
}

export type Ack = {
  name: string;
  label: string;
  status: string;
  time: CommandHistoryEntry["generationTime"] | undefined;
  message: string | undefined;
};

interface Acks {
  groundStation: Ack[];
  uplink: Ack[];
  flightComputer: Ack[];
}

function validAck(ack: Ack): boolean {
  return ack.status !== "??";
}

export function collectAcks(command: CommandHistoryEntry): Acks {
  const ackNames = listAckNames(command);

  return {
    groundStation: [
      extractAcknowledgement(command, "Queued"),
      extractAcknowledgement(command, "Released"),
      extractAcknowledgement(command, "Sent"),
    ].filter(validAck),

    uplink: ackNames
      .filter((ack) => ack.startsWith("uplink_"))
      .map((ack) => extractAcknowledgement(command, ack))
      .filter(validAck),

    flightComputer: [
      ...ackNames
        .filter((ack) => ack.startsWith("fc_"))
        .map((ack) => extractAcknowledgement(command, ack)),
      extractAcknowledgement(command, "CommandComplete", true),
    ].filter(validAck),
  };
}

function listAckNames(command: CommandHistoryEntry) {
  const ackNames = new Set<string>();

  for (const attribute of command.attr) {
    if (!attribute.name.endsWith("_Status")) {
      continue;
    }

    if (attribute.name.startsWith("Acknowledge_")) {
      ackNames.add(
        attribute.name.slice("Acknowledge_".length, -"_Status".length),
      );
      continue;
    }

    if (attribute.name === "CommandComplete_Status") {
      ackNames.add("CommandComplete");
    }
  }

  return Array.from(ackNames).sort();
}

function formatAckLabel(ack: string) {
  if (ack === "CommandComplete") {
    return "overall";
  }

  return ack.replace(/^(uplink_|fc_)/, "").replaceAll("_", " ");
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
    label: formatAckLabel(ack),
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

  return isToday
    ? d.toLocaleTimeString()
    : d.toLocaleDateString() + ", " + time;
}
