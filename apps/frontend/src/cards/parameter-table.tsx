import { Popover } from "@base-ui/react";
import { useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { Cause, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { memo, useState, type ReactNode } from "react";

import type { LiveParameterUpdate } from "@/lib/atom";

import { parameterDetailPopoverHandle } from "@/components/parameter-detail";
import { parameterInfoAtom, parameterSubscriptionAtom } from "@/lib/atom";
import { makeCard } from "@/lib/cards";
import { FormTitleAnnotationId, FormTypeAnnotationId } from "@/lib/form";
import { cn } from "@/lib/utils";

const ParameterTableSectionSchema = Schema.Struct({
  parameters: Schema.Array(Schema.String).pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Parameters" }),
  ),
  title: Schema.String.pipe(Schema.annotate({ [FormTitleAnnotationId]: "Section Title" })),
});

export type ParameterTableSection = typeof ParameterTableSectionSchema.Type;

export const ParameterTable = makeCard({
  id: "parameter-table",
  name: "Parameter Table",
  schema: Schema.Struct({
    sections: Schema.optional(Schema.Array(ParameterTableSectionSchema)).pipe(
      Schema.annotate({
        [FormTitleAnnotationId]: "Sections",
        [FormTypeAnnotationId]: "parameterTableSections",
      }),
    ),
  }),
  component: ({ params }) => {
    return (
      <div className="h-full overflow-auto">
        <div className="grid grid-cols-[1.5rem_minmax(12rem,1fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)] gap-px font-mono">
          <TableHeader />
          {params.sections &&
            params.sections.map((section) => (
              <TableGroup key={section.title} name={section.title}>
                {section.parameters.map((parameter) => (
                  <TableRow key={parameter} parameter={parameter} />
                ))}
              </TableGroup>
            ))}
        </div>
      </div>
    );
  },
});

const TableHeader = memo(function TableHeader() {
  return (
    <div className="sticky top-0 z-10 col-span-full grid grid-cols-subgrid text-sm text-white-text uppercase">
      <div className="border-t border-t-background-secondary-highlight bg-background-secondary px-1" />
      <div className="border-t border-t-background-secondary-highlight bg-background-secondary px-1">
        Parameter
      </div>
      <div className="border-t border-t-background-secondary-highlight bg-background-secondary px-1">
        System A
      </div>
      <div className="border-t border-t-background-secondary-highlight bg-background-secondary px-1">
        System B
      </div>
      {/* <div className="bg-background-secondary border-t-background-secondary-highlight border-t px-1"> */}
      {/*   Unit */}
      {/* </div> */}
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
  const [collapse, setCollapse] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setCollapse((prev) => !prev)}
        className="col-span-full border-t border-t-background-secondary-highlight bg-background-secondary text-left text-sm text-white-text hover:bg-background-secondary-highlight"
      >
        <span
          data-collapsed={collapse}
          className="mr-1 inline-block w-6 text-center transition-transform data-[collapsed=true]:-rotate-90"
        >
          ▼
        </span>
        {name}
      </button>

      {!collapse && (
        <div className="col-span-full grid grid-cols-subgrid gap-px bg-border text-orange-text">
          {children}
        </div>
      )}
    </>
  );
});

const TableRow = memo(function TableRow({ parameter }: { parameter: string }) {
  const info = useAtomSuspense(parameterInfoAtom(parameter)).value;

  return (
    <Popover.Trigger
      handle={parameterDetailPopoverHandle}
      payload={parameter}
      className="col-span-full grid grid-cols-subgrid text-sm *:bg-background *:px-1 hover:*:bg-selection-background data-popup-open:*:bg-[color-mix(in_oklab,var(--color-selection-background)_50%,var(--background))]"
    >
      <div />
      <div className="line-clamp-1 text-ellipsis text-left" title={parameter}>
        {info.shortDescription ?? info.qualifiedName}
      </div>
      <Value name={parameter.replace("SystemB", "SystemA")} />
      {parameter.includes("SystemA") && <Value name={parameter.replace("SystemA", "SystemB")} />}
      {/* <div /> */}
    </Popover.Trigger>
  );
});

const Value = memo(function Value({ name }: { name: string }) {
  const result: AsyncResult.AsyncResult<LiveParameterUpdate, unknown> = useAtomValue(
    parameterSubscriptionAtom(name),
  );

  const double = !name.includes("SystemA") && !name.includes("SystemB");

  return AsyncResult.match(result, {
    onInitial: () => (
      <>
        <div className={cn("text-right text-muted-foreground", double && "col-span-2")}>
          Awaiting Value
        </div>
      </>
    ),
    onFailure: ({ cause }) => (
      <pre className="col-span-full min-h-full text-center text-error uppercase">
        {Cause.pretty(cause)}
      </pre>
    ),
    onSuccess: ({ value }) => (
      <>
        <div className={cn("line-clamp-1 text-right text-ellipsis", double && "col-span-2")}>
          {"value" in value.value.engValue
            ? value.value.engValue.value.toLocaleString()
            : "Unknown Value Type"}
        </div>
      </>
    ),
  });
});
