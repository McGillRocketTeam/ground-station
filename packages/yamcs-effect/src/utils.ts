import type { StreamingCommandHisotryEntry } from "./schema.js";

export function mergeCommandEntries(
  current: typeof StreamingCommandHisotryEntry.Type,
  incoming: typeof StreamingCommandHisotryEntry.Type,
): typeof StreamingCommandHisotryEntry.Type {
  // Merge attributes by "name" key
  const currentAttr = current.attr ?? [];
  const incomingAttr = incoming.attr ?? [];

  const mergedAttrMap = new Map<string, (typeof current.attr)[number]>();

  for (const attr of currentAttr) {
    mergedAttrMap.set(attr.name, attr);
  }

  for (const attr of incomingAttr) {
    mergedAttrMap.set(attr.name, attr);
  }

  const mergedAttr = Array.from(mergedAttrMap.values());

  // Same logic could apply to `assignments` if both sides define them
  const mergedAssignments =
    current.assignments || incoming.assignments
      ? mergeAssignments(current.assignments, incoming.assignments)
      : undefined;

  // Merge the rest of the fields -- prefer fresh metadata from `incoming`
  return {
    ...current,
    ...incoming,
    attr: mergedAttr,
    assignments: mergedAssignments,
  };
}

function mergeAssignments(
  current?: readonly {
    readonly name: string;
    readonly value: any;
  }[],
  incoming?: readonly {
    readonly name: string;
    readonly value: any;
  }[],
) {
  if (!current && !incoming) return undefined;
  const result = new Map<string, any>();
  for (const a of current ?? []) {
    result.set(a.name, a);
  }
  for (const a of incoming ?? []) {
    result.set(a.name, a);
  }
  return Array.from(result.values());
}
