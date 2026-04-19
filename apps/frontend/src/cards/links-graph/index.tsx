import type { BuiltInEdge, Edge, Node, NodeProps } from "@xyflow/react";

import { Background, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Schema } from "effect";
import { useState } from "react";

import { makeCard } from "@/lib/cards";

type RadioLinkNode = Node<{ qualifiedName: string }, "radioLink">;

export default function RadioLinkNode({ data }: NodeProps<RadioLinkNode>) {
  return <div className="h-20 text-black">{data.qualifiedName}</div>;
}

const nodeTypes = {
  radioLink: RadioLinkNode,
};

const initialNodes = [
  {
    type: "radioLink",
    id: "n1",
    position: { x: 0, y: 0 },
    data: { qualifiedName: "Node 1" },
  },
];

export type CustomNodeType = RadioLinkNode;
export type CustomEdgeType = BuiltInEdge;

export const LinksGraphCard = makeCard({
  id: "links-graph-card",
  name: "Links Graph",
  schema: Schema.Struct({}),
  component: () => {
    const [nodes] = useState(initialNodes);
    const [edges] = useState([]);

    return (
      <div className="h-20 w-20">
        <ReactFlow nodeTypes={nodeTypes} nodes={nodes} edges={edges} fitView>
          <Background />
        </ReactFlow>
      </div>
    );
  },
});
