import { Popover } from "@base-ui/react";
import { useAtomValue } from "@effect/atom-react";
import { Cause, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { memo, useState, type ReactNode } from "react";

import type { LiveParameterUpdate } from "@/lib/atom";

import { parameterDetailPopoverHandle } from "@/components/parameter-detail";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parameterListAtom, parameterSubscriptionAtom } from "@/lib/atom";
import { makeCard } from "@/lib/cards";
import { FormTitleAnnotationId, FormTypeAnnotationId } from "@/lib/form";
import { cn } from "@/lib/utils";

type DeviceParameter = {
  readonly name: string;
  readonly qualifiedName: string;
  readonly shortDescription?: string | undefined;
};

type ParameterGroup = {
  readonly name: string;
  readonly parameters: ReadonlyArray<DeviceParameter>;
};

const GENERAL_GROUP = "General";

export function groupDeviceParameters(
  parameters: ReadonlyArray<DeviceParameter>,
  device: string,
): ReadonlyArray<ParameterGroup> {
  const deviceSegments = device.split("/").filter(Boolean);
  const groups = new Map<string, Array<DeviceParameter>>();

  for (const parameter of parameters) {
    const segments = parameter.qualifiedName.split("/").filter(Boolean);
    if (
      segments.length <= deviceSegments.length ||
      !deviceSegments.every((segment, index) => segments[index] === segment)
    ) {
      continue;
    }

    const groupName = segments.slice(deviceSegments.length, -1).join(" / ") || GENERAL_GROUP;
    const group = groups.get(groupName) ?? [];
    group.push(parameter);
    groups.set(groupName, group);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => {
      if (left === GENERAL_GROUP) return -1;
      if (right === GENERAL_GROUP) return 1;
      return left.localeCompare(right);
    })
    .map(([name, groupParameters]) => ({
      name,
      parameters: groupParameters.sort(
        (left, right) =>
          left.name.localeCompare(right.name) ||
          left.qualifiedName.localeCompare(right.qualifiedName),
      ),
    }));
}

export const ParameterDeviceTable = makeCard({
  id: "parameter-device-table",
  name: "Parameter Device Table",
  schema: Schema.Struct({
    device: Schema.String.pipe(
      Schema.annotate({
        [FormTitleAnnotationId]: "Device",
        [FormTypeAnnotationId]: "parameterDevice",
      }),
    ),
  }),
  component: ({ params }) => {
    const parametersResult = useAtomValue(parameterListAtom);

    return AsyncResult.builder(parametersResult)
      .onInitial(() => (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">
          Loading parameters...
        </div>
      ))
      .onFailure((cause) => (
        <pre className="grid h-full place-items-center text-error">{Cause.pretty(cause)}</pre>
      ))
      .onSuccess((parameters) => {
        const groups = groupDeviceParameters(parameters, params.device);

        return (
          <ScrollArea className="h-full">
            <div className="grid grid-cols-[auto_1fr] gap-px font-mono">
              <TableHeader />
              {groups.length === 0 ? (
                <div className="col-span-full p-4 text-center text-sm text-muted-foreground">
                  No parameters found for {params.device}.
                </div>
              ) : (
                groups.map((group) => (
                  <TableGroup key={group.name} name={group.name}>
                    {group.parameters.map((parameter) => (
                      <TableRow key={parameter.qualifiedName} parameter={parameter} />
                    ))}
                  </TableGroup>
                ))
              )}
            </div>
          </ScrollArea>
        );
      })
      .render();
  },
});

const TableHeader = memo(function TableHeader() {
  return (
    <div className="sticky top-0 z-10 col-span-full grid grid-cols-subgrid text-sm text-white-text uppercase">
      <div className="border-t border-t-background-secondary-highlight bg-background-secondary px-1">
        Parameter
      </div>
      <div className="border-t border-t-background-secondary-highlight bg-background-secondary px-1 text-right">
        Value
      </div>
    </div>
  );
});

const TableGroup = memo(function TableGroup({
  children,
  name,
}: {
  children: ReactNode;
  name: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        className="col-span-full border-t border-t-background-secondary-highlight bg-background-secondary text-left text-sm text-white-text hover:bg-background-secondary-highlight"
      >
        <span
          data-collapsed={collapsed}
          className="mr-1 inline-block w-6 text-center transition-transform data-[collapsed=true]:-rotate-90"
        >
          ▼
        </span>
        {name}
      </button>
      {!collapsed && (
        <div className="col-span-full grid grid-cols-subgrid gap-px bg-border text-orange-text">
          {children}
        </div>
      )}
    </>
  );
});

const TableRow = memo(function TableRow({ parameter }: { parameter: DeviceParameter }) {
  return (
    <Popover.Trigger
      handle={parameterDetailPopoverHandle}
      payload={parameter.qualifiedName}
      className={cn(
        "col-span-full grid grid-cols-subgrid text-sm *:bg-background *:px-1",
        "hover:*:bg-selection-background data-popup-open:*:bg-[color-mix(in_oklab,var(--color-selection-background)_50%,var(--background))]",
      )}
    >
      <div className="line-clamp-1 text-left text-ellipsis" title={parameter.qualifiedName}>
        {parameter.shortDescription ?? parameter.name}
      </div>
      <ParameterValue qualifiedName={parameter.qualifiedName} />
    </Popover.Trigger>
  );
});

const ParameterValue = memo(function ParameterValue({ qualifiedName }: { qualifiedName: string }) {
  const result: AsyncResult.AsyncResult<LiveParameterUpdate, unknown> = useAtomValue(
    parameterSubscriptionAtom(qualifiedName),
  );

  return AsyncResult.match(result, {
    onInitial: () => <div className="text-right text-muted-foreground">Awaiting Value</div>,
    onFailure: ({ cause }) => <pre className="text-center text-error">{Cause.pretty(cause)}</pre>,
    onSuccess: ({ value }) => (
      <div className="line-clamp-1 text-right text-ellipsis">
        {"value" in value.value.engValue
          ? value.value.engValue.value.toLocaleString()
          : "Unknown Value Type"}{" "}
        {value.info.type.unitSet?.map((unit) => unit.unit).join("")}
      </div>
    ),
  });
});
