import type { Edge, EdgeProps, NodeProps } from "@xyflow/react";

import { Popover as PopoverPrimitive } from "@base-ui/react";
import { useAtomValue } from "@effect/atom-react";
import { BaseEdge, EdgeLabelRenderer, Handle, Position, getSmoothStepPath } from "@xyflow/react";
import { RadioTower, Server } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PopoverTrigger } from "@/components/ui/popover";
import {
  parameterSubscriptionAtom,
  selectedInstanceAtom,
  singleLinkSubscriptionAtom,
  YamcsAtomHttpClient,
} from "@/lib/atom";
import { cn } from "@/lib/utils";

import type { Link } from "../links/utils";

import "./index.css";
import type { GroundStationNode, LinkEdgeData, RadioLinkNode, WifiAntennaEdgeData } from "./data";

import { colorByStatus, isLinkTransmitting } from "../links/utils";

function colorValueByStatus(link: Link) {
  if (link.status === "OK" && !isLinkTransmitting(link)) {
    return "var(--color-blue-500)";
  }

  return link.status === "OK"
    ? "var(--color-success)"
    : link.status === "DISABLED"
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
    deltasRef.current = deltasRef.current.filter((sample) => now - sample.time <= 1000);
    setRate(deltasRef.current.reduce((sum, sample) => sum + sample.delta, 0));

    const interval = window.setInterval(() => {
      const tick = Date.now();

      deltasRef.current = deltasRef.current.filter((sample) => tick - sample.time <= 1000);
      setRate(deltasRef.current.reduce((sum, sample) => sum + sample.delta, 0));
    }, 100);

    return () => window.clearInterval(interval);
  }, [count]);

  return rate;
}

function LinkEdge({
  id,
  source,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps<Edge<LinkEdgeData, "link">>) {
  const qualifiedName = data?.qualifiedName ?? source;
  const linkResult = useAtomValue(singleLinkSubscriptionAtom(qualifiedName));
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
  const edgeColor = colorValueByStatus(linkResult.value);

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

function extractNumericParameterValue(parameterResult: unknown) {
  if (
    typeof parameterResult !== "object" ||
    parameterResult === null ||
    !("_tag" in parameterResult) ||
    parameterResult._tag !== "Success" ||
    !("value" in parameterResult)
  ) {
    return undefined;
  }

  const value = parameterResult.value;
  if (typeof value !== "object" || value === null || !("value" in value)) {
    return undefined;
  }

  const parameterValue = value.value;
  if (
    typeof parameterValue !== "object" ||
    parameterValue === null ||
    !("engValue" in parameterValue)
  ) {
    return undefined;
  }

  const engValue = parameterValue.engValue;
  if (typeof engValue !== "object" || engValue === null || !("value" in engValue)) {
    return undefined;
  }

  const numericValue = Number(engValue.value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function getLinkParameterName(links: ReadonlyArray<Link>, linkName: string, suffix: string) {
  return links
    .find((link) => link.name === linkName)
    ?.parameters?.find((parameter) => parameter.endsWith(suffix));
}

function useConnectedStationsParameter(linkName: string) {
  const instance = useAtomValue(selectedInstanceAtom);
  const linksResult = useAtomValue(
    YamcsAtomHttpClient.query("link", "listLinks", {
      params: { instance },
    }),
  );

  return linksResult._tag === "Success"
    ? getLinkParameterName(linksResult.value.links, linkName, "/Connected Stations")
    : undefined;
}

function ResolvedWifiAntennaEdge({
  id,
  flip,
  parameterName,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: {
  id: string;
  flip?: boolean;
  parameterName: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
}) {
  const connectedStationsResult = useAtomValue(parameterSubscriptionAtom(parameterName));
  const connectedStations = extractNumericParameterValue(connectedStationsResult);
  const isActive = (connectedStations ?? 0) > 0;

  if (!isActive) {
    return null;
  }

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 0,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      className={cn("links-graph__edge-path", flip && "links-graph__edge-path--reverse")}
      style={{
        stroke: "var(--color-success)",
        strokeWidth: 1.5,
        strokeDasharray: "6 4",
      }}
    />
  );
}

function WifiAntennaEdge({
  id,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps<Edge<WifiAntennaEdgeData, "wifiAntenna">>) {
  const connectedStationsLinkName = data?.connectedStationsLinkName ?? "";
  const parameterName = useConnectedStationsParameter(connectedStationsLinkName);

  if (!parameterName) {
    return null;
  }

  return (
    <ResolvedWifiAntennaEdge
      id={id}
      flip={data?.flip}
      parameterName={parameterName}
      sourceX={sourceX}
      sourceY={sourceY}
      targetX={targetX}
      targetY={targetY}
      sourcePosition={sourcePosition}
      targetPosition={targetPosition}
    />
  );
}

function WifiAntennaNodeContent({
  data,
  link,
  parameterName,
}: {
  data: RadioLinkNode["data"];
  link: Link | undefined;
  parameterName: string;
}) {
  const connectedStationsResult = useAtomValue(parameterSubscriptionAtom(parameterName));
  const connectedStations = extractNumericParameterValue(connectedStationsResult);
  const nodeClass =
    (connectedStations ?? 0) > 0
      ? "text-success"
      : link
        ? colorByStatus(link.status, link)
        : "text-muted-foreground";

  return renderRadioLinkNode(data, link, nodeClass);
}

function renderRadioLinkNode(
  data: RadioLinkNode["data"],
  link: Link | undefined,
  nodeClass: string,
) {
  const text = (
    <div
      className={cn(
        "flex h-[3lh] max-w-[20ch] flex-col font-mono whitespace-pre-line uppercase",
        data.textPosition === "bottom"
          ? "justify-start"
          : data.textPosition === "right"
            ? "pointer-events-none absolute top-1/2 left-full ml-4 h-auto -translate-y-1/2 justify-center text-left"
            : "justify-end",
      )}
    >
      {data.friendlyName}
    </div>
  );

  return (
    <PopoverTrigger
      className={cn(
        "group flex w-[20ch] flex-col items-center gap-2 rounded-none outline-none focus-visible:outline-none",
        nodeClass,
      )}
      payload={link}
      handle={linksPopover}
      onClick={() => console.log(link)}
    >
      {data.textPosition === "top" && text}
      <div className="relative grid aspect-square place-items-center border-[1.5px] border-dashed border-current bg-current/15 p-2 transition-[box-shadow,color,background-color] group-focus-visible:shadow-[0_0_0_2px_color-mix(in_oklab,currentColor_55%,transparent),0_0_0_6px_color-mix(in_oklab,currentColor_18%,transparent)]">
        <Handle
          type="target"
          id="top"
          position={Position.Top}
          className="!size-0 !border-0 !bg-transparent !opacity-0"
        />
        <Handle
          type="source"
          id="top"
          position={Position.Top}
          className="!size-0 !border-0 !bg-transparent !opacity-0"
        />
        <Handle
          type="target"
          id="bottom"
          position={Position.Bottom}
          className="!size-0 !border-0 !bg-transparent !opacity-0"
        />
        <Handle
          type="source"
          id="bottom"
          position={Position.Bottom}
          className="!size-0 !border-0 !bg-transparent !opacity-0"
        />
        <Handle
          type="target"
          id="left"
          position={Position.Left}
          className="!size-0 !border-0 !bg-transparent !opacity-0"
        />
        <Handle
          type="target"
          id="right"
          position={Position.Right}
          className="!size-0 !border-0 !bg-transparent !opacity-0"
        />
        <RadioTower strokeWidth={1.5} className="size-7.5" />
        {data.textPosition === "right" && text}
      </div>
      {data.textPosition === "bottom" && text}
    </PopoverTrigger>
  );
}

function RadioLinkNode({ data }: NodeProps<RadioLinkNode>) {
  const linkResult = useAtomValue(singleLinkSubscriptionAtom(data.qualifiedName));
  const isWifiAntennaNode =
    data.qualifiedName === "PAD Wifi Antenna (Client)" ||
    data.qualifiedName === "CS WiFi Antenna (Access Point)";
  const parameterName = useConnectedStationsParameter("CS WiFi Antenna (Access Point)");
  const fallbackNodeClass =
    linkResult._tag === "Success"
      ? linkResult.value
        ? colorByStatus(linkResult.value.status, linkResult.value)
        : "text-muted-foreground"
      : linkResult._tag === "Failure"
        ? "text-error"
        : "text-muted-foreground";

  if (isWifiAntennaNode && parameterName) {
    return (
      <WifiAntennaNodeContent
        data={data}
        link={linkResult._tag === "Success" ? linkResult.value : undefined}
        parameterName={parameterName}
      />
    );
  }

  return renderRadioLinkNode(
    data,
    linkResult._tag === "Success" ? linkResult.value : undefined,
    fallbackNodeClass,
  );
}

function GroundStationNode(_: NodeProps<GroundStationNode>) {
  return (
    <div className="flex w-[20ch] flex-col items-center gap-2 text-muted-foreground">
      <div className="relative grid aspect-square place-items-center border-[1.5px] border-current bg-current/15 p-2">
        <Handle
          type="target"
          id="left"
          position={Position.Left}
          className="!size-0 !border-0 !bg-transparent !opacity-0"
        />
        <Handle
          type="target"
          id="right"
          position={Position.Right}
          className="!size-0 !border-0 !bg-transparent !opacity-0"
        />
        <Handle
          type="source"
          id="top"
          position={Position.Top}
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
  wifiAntenna: WifiAntennaEdge,
};

export const linksPopover = PopoverPrimitive.createHandle<Link>();

export const noopNodeClick = () => {};
