import type { LinkInfo } from "@mrt/yamcs-effect";

export type Link = typeof LinkInfo.Type;
export type LinkNode = Link & {
  children: LinkNode[];
};

export function buildLinkTree(links: ReadonlyArray<Link>): LinkNode[] {
  const nodes: Record<string, LinkNode> = {};
  const roots: LinkNode[] = [];

  // Create all nodes
  for (const link of links) {
    nodes[link.name] = {
      ...link,
      children: [],
    };
  }

  // Assign parents / collect roots
  for (const link of links) {
    const node = nodes[link.name];

    if (link.parentName) {
      const parent = nodes[link.parentName];

      if (parent) {
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}
