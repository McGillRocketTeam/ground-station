import type { QualifiedName } from "@mrt/yamcs-effect";
import type { ReactNode } from "react";

import { Popover } from "@base-ui/react";
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";

import { RealtimePlot } from "@/cards/realtime-chart";
import { Separator } from "@/components/ui/separator";
import { parameterInfoAtom } from "@/lib/atom";
import { cn } from "@/lib/utils";

export const parameterDetailPopoverHandle = Popover.createHandle<QualifiedName>();

export function ParameterDetail({
  qualifiedName,
  className,
}: {
  qualifiedName: QualifiedName;
  className?: string;
}) {
  const parameterResult = useAtomValue(parameterInfoAtom(qualifiedName));

  return AsyncResult.builder(parameterResult)
    .onInitial(() => <div>Loading...</div>)
    .onError((error) => <div>{error.message}</div>)
    .onSuccess((info) => (
      <div className={cn("grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 ", className)}>
        <div className="col-span-full text-sm">Metadata</div>
        {info.shortDescription && (
          <>
            <Label>Name</Label>
            <LabelValue>{info.shortDescription}</LabelValue>
          </>
        )}
        {info.longDescription && (
          <>
            <Label>Description</Label>
            <LabelValue>{info.longDescription}</LabelValue>
          </>
        )}

        <Label>Parameter</Label>
        <LabelValue>{info.name}</LabelValue>
        <Label>System</Label>
        <LabelValue>{info.qualifiedName.split("/").slice(-2, -1).join("/")}</LabelValue>
        <Label>Source</Label>
        <LabelValue>{info.dataSource}</LabelValue>

        <Separator className="col-span-full" />

        {info.type.dataEncoding && (
          <>
            <div className="col-span-full text-sm">Data Encoding</div>
            <Label>Size in Bits</Label>
            <LabelValue>{info.type.dataEncoding.sizeInBits ?? "unknown"}</LabelValue>
            <Label>Byte Order</Label>
            <LabelValue>
              {info.type.dataEncoding.littleEndian ? "Little endian" : "Big endian"}
            </LabelValue>
            <Label>Encoding</Label>
            <LabelValue>{info.type.dataEncoding.encoding ?? "unknown"}</LabelValue>
          </>
        )}

        <Separator className="col-span-full" />

        <div className="col-span-full text-sm">Live Value</div>
        <RealtimePlot
          className="col-span-full h-52 mb-4"
          seriesConfigs={[
            {
              color: "#FD9900",
              label: info.shortDescription ?? info.name,
              parameter: qualifiedName,
            },
          ]}
        />
      </div>
    ))
    .render();
}

function Label({ children }: { children: ReactNode }) {
  return <div className="text-nowrap">{children}</div>;
}

function LabelValue({ children }: { children: ReactNode }) {
  return <div className="font-mono">{children}</div>;
}
