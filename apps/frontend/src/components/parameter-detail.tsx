import type { QualifiedName } from "@mrt/yamcs-effect";
import type { ReactNode } from "react";

import { Popover } from "@base-ui/react";
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";

import { RealtimePlot } from "@/cards/realtime-chart";
import { Separator } from "@/components/ui/separator";
import { parameterDetailAtom } from "@/lib/atom";
import { cn } from "@/lib/utils";

export const parameterDetailPopoverHandle = Popover.createHandle<QualifiedName>();

export function ParameterDetail({
  qualifiedName,
  className,
}: {
  qualifiedName: QualifiedName;
  className?: string;
}) {
  const parameterResult = useAtomValue(parameterDetailAtom(qualifiedName));

  return AsyncResult.builder(parameterResult)
    .onInitial(() => <div>Loading...</div>)
    .onError((error) => <div>{error.message}</div>)
    .onSuccess((info) => {
      const usedByRows = [
        ...(info.usedBy?.container?.map((container) => ({
          description: container.shortDescription ?? container.longDescription ?? "-",
          ref: container.name,
          type: "Container",
        })) ?? []),
        ...(info.usedBy?.algorithm?.map((algorithm) => ({
          description: algorithm.shortDescription ?? algorithm.longDescription ?? "-",
          ref: algorithm.name,
          type: "Algorithm",
        })) ?? []),
      ];
      const units = info.type.unitSet?.map((unit) => unit.unit).join(", ");
      const system = getSystemName(info.qualifiedName);
      const dataEncoding = info.type.dataEncoding;
      const defaultAlarm = info.type.defaultAlarm;
      const staticAlarmRanges = defaultAlarm?.staticAlarmRanges ?? defaultAlarm?.staticAlarmRange;

      return (
        <div className={cn("w-[36rem] max-w-[78vw] space-y-2", className)}>
          <div className="space-y-1">
            <div className="break-all font-mono text-sm text-foreground">{info.qualifiedName}</div>
            {(info.shortDescription || info.longDescription) && (
              <div className="text-xs text-muted-foreground">
                {info.shortDescription ?? info.longDescription}
              </div>
            )}
          </div>

          <Section title="">
            <DetailGrid>
              <DetailRow label="Parameter" value={info.name} />
              <DetailRow label="System" value={system} />
              <DetailRow label="Type" value={info.type.engType.toLowerCase()} />
              {units && <DetailRow label="Units" value={units} />}
              {info.type.sizeInBits !== undefined && (
                <DetailRow label="Size in Bits" value={info.type.sizeInBits} />
              )}
              <DetailRow label="Source" value={formatEnum(info.dataSource)} />
              {info.shortDescription && (
                <DetailRow label="Short Description" value={info.shortDescription} />
              )}
              {info.longDescription && (
                <DetailRow label="Long Description" value={info.longDescription} />
              )}
            </DetailGrid>
          </Section>

          <Separator />

          <Section title="Live Value">
            <RealtimePlot
              className="h-52"
              seriesConfigs={[
                {
                  color: "#FD9900",
                  label: info.shortDescription ?? info.name,
                  parameter: qualifiedName,
                },
              ]}
            />
          </Section>

          {usedByRows.length > 0 && (
            <>
              <Separator />
              <Section title="Used By">
                <SimpleTable
                  columns={["Type", "Ref", "Description"]}
                  rows={usedByRows.map((row) => [row.type, row.ref, row.description])}
                />
              </Section>
            </>
          )}

          {dataEncoding && (
            <>
              <Separator />
              <Section title="Data Encoding">
                <DetailGrid>
                  {dataEncoding.sizeInBits !== undefined && (
                    <DetailRow label="Size in Bits" value={dataEncoding.sizeInBits} />
                  )}
                  {dataEncoding.littleEndian !== undefined && (
                    <DetailRow
                      label="Byte Order"
                      value={dataEncoding.littleEndian ? "Little endian" : "Big endian"}
                    />
                  )}
                  {dataEncoding.encoding && (
                    <DetailRow label="Encoding" value={dataEncoding.encoding} />
                  )}
                </DetailGrid>
              </Section>
            </>
          )}

          {dataEncoding?.defaultCalibrator && (
            <>
              <Separator />
              <Section title="Calibration">
                <SimpleTable
                  columns={["Calibrator", "Type", "Definition"]}
                  rows={[
                    [
                      "default",
                      formatEnum(dataEncoding.defaultCalibrator.type),
                      formatCalibratorDefinition(dataEncoding.defaultCalibrator),
                    ],
                  ]}
                />
              </Section>
            </>
          )}

          {defaultAlarm && (
            <>
              <Separator />
              <Section title="Alarm Info">
                <DetailGrid>
                  {defaultAlarm.minViolations !== undefined && (
                    <DetailRow label="Min. Violations" value={defaultAlarm.minViolations} />
                  )}
                  {defaultAlarm.defaultLevel && (
                    <DetailRow label="Default Level" value={defaultAlarm.defaultLevel} />
                  )}
                </DetailGrid>
                {staticAlarmRanges && staticAlarmRanges.length > 0 && (
                  <div className="pt-3">
                    <SimpleTable
                      columns={["Alarm Level", "Range"]}
                      rows={staticAlarmRanges.map((range) => [
                        range.level,
                        formatAlarmRange(range),
                      ])}
                    />
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      );
    })
    .render();
}

function getSystemName(qualifiedName: string) {
  const parts = qualifiedName.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return "/";
  }

  return `/${parts.slice(0, -1).join("/")}`;
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCalibratorDefinition(calibrator: {
  readonly type: string;
  readonly coefficients?: ReadonlyArray<number> | undefined;
  readonly formula?: string | undefined;
  readonly points?:
    | ReadonlyArray<{ readonly raw: number; readonly calibrated: number }>
    | undefined;
}) {
  switch (calibrator.type) {
    case "POLYNOMIAL":
      return calibrator.coefficients?.join(", ") ?? "-";
    case "JAVA_EXPRESSION":
      return calibrator.formula ?? "-";
    case "SPLINE":
      return (
        calibrator.points?.map((point) => `(${point.raw}, ${point.calibrated})`).join(", ") ?? "-"
      );
    default:
      return "-";
  }
}

function formatAlarmRange(range: {
  readonly minInclusive?: number | undefined;
  readonly minExclusive?: number | undefined;
  readonly maxInclusive?: number | undefined;
  readonly maxExclusive?: number | undefined;
}) {
  const min =
    range.minInclusive !== undefined
      ? `[${range.minInclusive}`
      : range.minExclusive !== undefined
        ? `(${range.minExclusive}`
        : "(-inf";
  const max =
    range.maxInclusive !== undefined
      ? `${range.maxInclusive}]`
      : range.maxExclusive !== undefined
        ? `${range.maxExclusive})`
        : "+inf)";

  return `${min}, ${max}`;
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="space-y-3">
      <div className="text-xs uppercase tracking-wide">{title}</div>
      {children}
    </section>
  );
}

function DetailGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[12rem_1fr] gap-x-4 gap-y-2">{children}</div>;
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <div className="text-nowrap text-foreground">{label}</div>
      <div className="font-mono text-foreground break-anywhere">{value}</div>
    </>
  );
}

function SimpleTable({
  columns,
  rows,
}: {
  columns: ReadonlyArray<string>;
  rows: ReadonlyArray<ReadonlyArray<ReactNode>>;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border/80">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="bg-muted/30 text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column} className="border-b border-border/80 px-3 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border-t border-border/60 px-3 py-2 font-mono">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
