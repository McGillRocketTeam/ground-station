import "@xyflow/react/dist/style.css";
import { Background, BackgroundVariant, ReactFlow } from "@xyflow/react";
import { Schema } from "effect";

import { Popover, PopoverContent } from "@/components/ui/popover";
import { makeCard } from "@/lib/cards";

import { LinkDetail } from "../links/link-detail";
import {
  edgeTypes,
  linksPopover,
  nodeTypes,
  noopNodeClick,
} from "./custom-elements";
import { initialEdges, initialNodes } from "./data";

export const LinksGraphCard = makeCard({
  id: "links-graph-card",
  name: "Links Graph",
  schema: Schema.Struct({}),
  component: () => {
    return (
      <div className="h-full w-full">
        <Popover handle={linksPopover}>
          {({ payload }) =>
            payload && (
              <PopoverContent className="w-96">
                <LinkDetail link={payload} />
              </PopoverContent>
            )
          }
        </Popover>
        <ReactFlow
          proOptions={{ hideAttribution: true }}
          attributionPosition={undefined}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodes={initialNodes}
          edges={initialEdges}
          onNodeClick={noopNodeClick}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          panOnDrag={false}
          panOnScroll={false}
          preventScrolling={false}
          fitView
        >
          <Background
            color="var(--color-border)"
            size={5}
            variant={BackgroundVariant.Cross}
          />
        </ReactFlow>
      </div>
    );
  },
});
