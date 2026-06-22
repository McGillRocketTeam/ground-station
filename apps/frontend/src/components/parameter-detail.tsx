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
      <div className={cn("grid grid-cols-[auto_1fr] gap-x-4 gap-y-2", className)}>
        <div className="col-span-full text-sm">Metadata</div>
        <Label>Parameter</Label>
        <LabelValue>{info.name}</LabelValue>
        <Label>System</Label>
        <LabelValue>{info.qualifiedName.split("/").slice(-2, -1).join("/")}</LabelValue>
        <Label>Source</Label>
        <LabelValue>{info.dataSource}</LabelValue>

        <div className="col-span-full">{info.longDescription}</div>

        <Separator className="col-span-full" />

        <div className="col-span-full text-sm">Live Value</div>
        <RealtimePlot
          className="w-md h-72 mb-4 col-span-full"
          seriesConfigs={[
            {
              color: "#00FF00",
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
  return <div>{children}</div>;
}

function LabelValue({ children }: { children: ReactNode }) {
  return <div className="font-mono">{children}</div>;
}
