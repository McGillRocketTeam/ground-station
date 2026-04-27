import type { EdgeProps, NodeProps } from "@xyflow/react";

import { Popover as PopoverPrimitive } from "@base-ui/react";
import { useAtomValue } from "@effect/atom-react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  getSmoothStepPath,
} from "@xyflow/react";
import { RadioTower, Server } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PopoverTrigger } from "@/components/ui/popover";
import { singleLinkSubscriptionAtom } from "@/lib/atom";
import { cn } from "@/lib/utils";

import type { Link } from "../links/utils";

import "./index.css";
import type { GroundStationNode, RadioLinkNode } from "./data";

import { colorByStatus } from "../links/utils";

function colorValueByStatus(linkStatus: string) {
  return linkStatus === "OK"
    ? "var(--color-success)"
    : linkStatus === "DISABLED"
      ? "var(--color-muted-foreground)"
      : "var(--color-error)";
}

type RateSample = {
  time: number;
  delta: number;
};

function useSlidingWindowRate(count: number | undefined) {
  const deltasRef = useRef<RateSample[]>([]);
  const previousCountRef = useRef<number | undefined>(undefined);
  const [rate, setRate] = useState(0);

  useEffect(() => {
    const now = Date.now();

    if (count !== undefined && previousCountRef.current !== undefined) {
      const delta = count - previousCountRef.current;

      if (delta > 0) {
        deltasRef.current.push({ time: now, delta });
      }
    }

    previousCountRef.current = count;
    deltasRef.current = deltasRef.current.filter(
      (sample) => now - sample.time <= 1000,
    );
    setRate(deltasRef.current.reduce((sum, sample) => sum + sample.delta, 0));

    const interval = window.setInterval(() => {
      const tick = Date.now();

      deltasRef.current = deltasRef.current.filter(
        (sample) => tick - sample.time <= 1000,
      );
      setRate(deltasRef.current.reduce((sum, sample) => sum + sample.delta, 0));
    }, 100);

    return () => window.clearInterval(interval);
  }, [count]);

  return rate;
}

function LinkEdge({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const linkResult = useAtomValue(singleLinkSubscriptionAtom(source));
  const dataInRate = useSlidingWindowRate(
    linkResult._tag === "Success" ? linkResult.value?.dataInCount : undefined,
  );

  if (
    linkResult._tag !== "Success" ||
    linkResult.value === undefined ||
    linkResult.value.status !== "OK"
  ) {
    return null;
  }

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 0,
  });
  const edgeColor = colorValueByStatus(linkResult.value.status);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className="links-graph__edge-path"
        style={{
          stroke: edgeColor,
          strokeWidth: 1.5,
          strokeDasharray: "6 4",
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            background: edgeColor,
          }}
          className="pointer-events-none px-1 font-mono text-xs text-background uppercase"
        >
          {dataInRate.toLocaleString()}/s
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

function RadioLinkNode({ data }: NodeProps<RadioLinkNode>) {
  const linkResult = useAtomValue(
    singleLinkSubscriptionAtom(data.qualifiedName),
  );
  const nodeClass =
    linkResult._tag === "Success"
      ? linkResult.value
        ? colorByStatus(linkResult.value.status)
        : "text-muted-foreground"
      : linkResult._tag === "Failure"
        ? "text-error"
        : "text-muted-foreground";

  const text = (
    <div
      className={cn(
        "flex h-[3lh] max-w-[15ch] flex-col font-mono whitespace-pre-line uppercase",
        data.textPosition === "bottom" ? "justify-start" : "justify-end",
      )}
    >
      {data.friendlyName}
    </div>
  );

  return (
    <PopoverTrigger
      className={cn(
        "group flex w-[15ch] flex-col items-center gap-2 rounded-none outline-none focus-visible:outline-none",
        nodeClass,
      )}
      payload={linkResult._tag === "Success" ? linkResult.value : undefined}
      handle={linksPopover}
      onClick={() => console.log(linkResult)}
    >
      {data.textPosition === "top" && text}
      <div className="relative grid aspect-square place-items-center border-[1.5px] border-dashed border-current bg-current/15 p-2 transition-[box-shadow,color,background-color] group-focus-visible:shadow-[0_0_0_2px_color-mix(in_oklab,currentColor_55%,transparent),0_0_0_6px_color-mix(in_oklab,currentColor_18%,transparent)]">
        <Handle
          type="source"
          id="top"
          position={Position.Top}
          className="!size-0 !border-0 !bg-transparent !opacity-0"
        />
        <Handle
          type="source"
          id="bottom"
          position={Position.Bottom}
          className="!size-0 !border-0 !bg-transparent !opacity-0"
        />
        <RadioTower strokeWidth={1.5} className="size-7.5" />
      </div>
      {data.textPosition === "bottom" && text}
    </PopoverTrigger>
  );
}

function GroundStationNode(_: NodeProps<GroundStationNode>) {
  return (
    <div className="flex w-[15ch] flex-col items-center gap-2 text-muted-foreground">
      <div className="relative grid aspect-square place-items-center border-[1.5px] border-current bg-current/15 p-2">
        <Handle
          type="target"
          id="left-top"
          position={Position.Left}
          style={{ top: "35%" }}
          className="!size-0 !border-0 !bg-transparent !opacity-0"
        />
        <Handle
          type="target"
          id="left-bottom"
          position={Position.Left}
          style={{ top: "65%" }}
          className="!size-0 !border-0 !bg-transparent !opacity-0"
        />
        <Handle
          type="target"
          id="right-top"
          position={Position.Right}
          style={{ top: "35%" }}
          className="!size-0 !border-0 !bg-transparent !opacity-0"
        />
        <Handle
          type="target"
          id="right-bottom"
          position={Position.Right}
          style={{ top: "65%" }}
          className="!size-0 !border-0 !bg-transparent !opacity-0"
        />
        <Server strokeWidth={1.5} className="size-7.5" />
      </div>
      <div className="text-center font-mono leading-tight uppercase">
        Ground Station <br /> Server
      </div>
    </div>
  );
}

export const nodeTypes = {
  radioLink: RadioLinkNode,
  groundStation: GroundStationNode,
};

export const edgeTypes = {
  link: LinkEdge,
};

export const linksPopover = PopoverPrimitive.createHandle<Link>();

export const noopNodeClick = () => {};
