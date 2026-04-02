import type { CommandHistoryEvent } from "@mrt/yamcs-effect";

import { stringifyValue } from "@/lib/utils";

export type CommandHistoryEntry = (typeof CommandHistoryEvent.Type)["data"];

export function extractAttribute(command: CommandHistoryEntry, attr: string) {
  return command.attr.find((a) => a.name === attr)?.value;
}

function extractAttributeVariant(
  command: CommandHistoryEntry,
  attributes: ReadonlyArray<string>,
) {
  for (const attribute of attributes) {
    const value = extractAttribute(command, attribute);

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

export type Ack = {
  name: string;
  label: string;
  status: string;
  time: CommandHistoryEntry["generationTime"] | undefined;
  message: string | undefined;
};

interface Acks {
  yamcs: Ack[];
  systemA: Ack[];
  systemB: Ack[];
  other: Ack[];
  completion: Ack | null;
}

const systemAAckOrder = ["uplink_a_rx", "uplink_a_tx", "fc_a"] as const;

const systemBAckOrder = ["uplink_b_rx", "uplink_b_tx", "fc_b"] as const;

const extraAckOrder = [...systemAAckOrder, ...systemBAckOrder] as const;

function validAck(ack: Ack): boolean {
  return ack.status !== "??";
}

export function collectAcks(command: CommandHistoryEntry): Acks {
  const ackNames = listAckNames(command);
  const extraAckNames = [
    ...extraAckOrder,
    ...ackNames.filter(
      (ack) =>
        !extraAckOrder.includes(ack as (typeof extraAckOrder)[number]) &&
        ack !== "Queued" &&
        ack !== "Released" &&
        ack !== "Sent" &&
        ack !== "CommandComplete",
    ),
  ];
  const completion = extractAcknowledgement(command, "CommandComplete", true);

  return {
    yamcs: [
      extractAcknowledgement(command, "Queued"),
      extractAcknowledgement(command, "Released"),
      extractAcknowledgement(command, "Sent"),
    ].filter(validAck),
    systemA: systemAAckOrder
      .map((ack) => extractAcknowledgement(command, ack))
      .filter(validAck),
    systemB: systemBAckOrder
      .map((ack) => extractAcknowledgement(command, ack))
      .filter(validAck),
    other: extraAckNames
      .filter(
        (ack) =>
          !systemAAckOrder.includes(ack as (typeof systemAAckOrder)[number]) &&
          !systemBAckOrder.includes(ack as (typeof systemBAckOrder)[number]),
      )
      .map((ack) => extractAcknowledgement(command, ack))
      .filter(validAck),
    completion: validAck(completion) ? completion : null,
  };
}

export function hasNokAck(command: CommandHistoryEntry) {
  const acks = collectAcks(command);

  return [
    ...acks.yamcs,
    ...acks.systemA,
    ...acks.systemB,
    ...acks.other,
    ...(acks.completion ? [acks.completion] : []),
  ].some((ack) => ack.status === "NOK");
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
    return "completion";
  }

  if (ack === "uplink_a_tx" || ack === "uplink_b_tx") {
    return "tx";
  }

  if (ack === "uplink_a_rx" || ack === "uplink_b_rx") {
    return "rx";
  }

  if (ack === "fc_a" || ack === "fc_b") {
    return "fc";
  }

  return ack.replaceAll("_", " ");
}

export function extractAcknowledgement(
  command: CommandHistoryEntry,
  ack: string,
  customPrefix?: boolean,
) {
  const baseName = `${ack}`;
  const prefixedName = `Acknowledge_${ack}`;
  const candidateNames = customPrefix ? [baseName] : [prefixedName, baseName];

  const statusValue = extractAttributeVariant(
    command,
    candidateNames.map((name) => `${name}_Status`),
  );
  const timeValue = extractAttributeVariant(
    command,
    candidateNames.map((name) => `${name}_Time`),
  );
  const messageValue = extractAttributeVariant(
    command,
    candidateNames.map((name) => `${name}_Message`),
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
