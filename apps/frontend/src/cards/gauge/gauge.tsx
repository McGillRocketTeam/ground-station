import NumberFlow from "@number-flow/react";

import type { GaugeVisualRange, GaugeVisualRangePattern } from "./config";

type GaugeProps = {
  min?: number;
  max?: number;
  ranges?: ReadonlyArray<GaugeVisualRange>;
  value?: number;
  label?: string;
};

type Point = {
  x: number;
  y: number;
};

type GaugeGeometry = {
  centerX: number;
  centerY: number;
  endAngle: number;
  radius: number;
  startAngle: number;
  viewBoxHeight: number;
  viewBoxWidth: number;
};

const GEOMETRY: GaugeGeometry = {
  centerX: 160,
  centerY: 162,
  endAngle: 490,
  radius: 122,
  startAngle: 230,
  viewBoxHeight: 300,
  viewBoxWidth: 320,
};

function polarToCartesian(radius: number, angleDegrees: number): Point {
  const angleRadians = ((angleDegrees - 90) * Math.PI) / 180;

  return {
    x: GEOMETRY.centerX + radius * Math.cos(angleRadians),
    y: GEOMETRY.centerY + radius * Math.sin(angleRadians),
  };
}

function arcPath(radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(radius, startAngle);
  const end = polarToCartesian(radius, endAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  const sweepFlag = 1;

  return [
    `M ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`,
  ].join(" ");
}

function valueToAngle(value: number, min: number, max: number) {
  const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return (
    GEOMETRY.startAngle + (GEOMETRY.endAngle - GEOMETRY.startAngle) * ratio
  );
}

function niceStep(range: number, targetTicks: number) {
  const roughStep = range / Math.max(1, targetTicks - 1);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const niceNormalized =
    normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 2.5
          ? 2.5
          : normalized <= 5
            ? 5
            : 10;

  return niceNormalized * magnitude;
}

function tickValues(min: number, max: number) {
  const majorStep = niceStep(max - min, 5);
  const minorStep = majorStep / 5;
  const majorTicks: number[] = [];
  const minorTicks: number[] = [];
  const firstMajor = Math.ceil(min / majorStep) * majorStep;
  const firstMinor = Math.ceil(min / minorStep) * minorStep;

  for (let value = firstMajor; value <= max; value += majorStep) {
    majorTicks.push(Number(value.toFixed(10)));
  }

  for (let value = firstMinor; value <= max; value += minorStep) {
    const rounded = Number(value.toFixed(10));
    const isMajor = majorTicks.some(
      (majorTick) => Math.abs(majorTick - rounded) < minorStep / 10,
    );

    if (!isMajor) {
      minorTicks.push(rounded);
    }
  }

  return { majorTicks, minorTicks };
}

function needlePath(angleDegrees: number): string {
  const angleRadians = ((angleDegrees - 90) * Math.PI) / 180;
  const direction = {
    x: Math.cos(angleRadians),
    y: Math.sin(angleRadians),
  };
  const normal = {
    x: -direction.y,
    y: direction.x,
  };
  const baseDistance = 12;
  const baseHalfWidth = 4.5;
  const tip = polarToCartesian(GEOMETRY.radius - 7, angleDegrees);
  const tipHalfWidth = 1.4;
  const leftTip = {
    x: tip.x + normal.x * tipHalfWidth,
    y: tip.y + normal.y * tipHalfWidth,
  };
  const rightTip = {
    x: tip.x - normal.x * tipHalfWidth,
    y: tip.y - normal.y * tipHalfWidth,
  };
  const baseCenter = {
    x: GEOMETRY.centerX - direction.x * baseDistance,
    y: GEOMETRY.centerY - direction.y * baseDistance,
  };
  const leftBase = {
    x: baseCenter.x + normal.x * baseHalfWidth,
    y: baseCenter.y + normal.y * baseHalfWidth,
  };
  const rightBase = {
    x: baseCenter.x - normal.x * baseHalfWidth,
    y: baseCenter.y - normal.y * baseHalfWidth,
  };

  return [
    `M ${leftTip.x} ${leftTip.y}`,
    `L ${leftBase.x} ${leftBase.y}`,
    `L ${rightBase.x} ${rightBase.y}`,
    `L ${rightTip.x} ${rightTip.y}`,
    "Z",
  ].join(" ");
}

function rangePatternClassName(pattern: GaugeVisualRangePattern) {
  switch (pattern) {
    case "success":
    case "success-chevron":
      return "stroke-green-500";
    case "yellow":
    case "yellow-chevron":
      return "stroke-yellow-300";
    case "red":
    case "red-chevron":
      return "stroke-[#ff0000]";
  }
}

function isChevronPattern(pattern: GaugeVisualRangePattern) {
  return pattern.endsWith("-chevron");
}

function renderVisualRange(
  range: GaugeVisualRange,
  min: number,
  max: number,
  index: number,
) {
  const start = Math.max(min, Math.min(max, range.start));
  const end = Math.max(min, Math.min(max, range.end));
  if (start === end) return null;

  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const className = rangePatternClassName(range.pattern);

  if (!isChevronPattern(range.pattern)) {
    return (
      <path
        key={`${range.start}-${range.end}-${range.pattern}-${index}`}
        className={className}
        d={arcPath(
          GEOMETRY.radius + 20,
          valueToAngle(from, min, max),
          valueToAngle(to, min, max),
        )}
        fill="none"
        strokeLinecap="butt"
        strokeWidth="8"
      />
    );
  }

  const segments = 12;
  const segmentSize = (to - from) / segments;

  return Array.from({ length: segments }, (_, segmentIndex) => {
    const segmentStart = from + segmentSize * segmentIndex;
    const segmentEnd = segmentStart + segmentSize;

    return (
      <path
        key={`${range.start}-${range.end}-${range.pattern}-${index}-${segmentIndex}`}
        className={segmentIndex % 2 === 0 ? className : "stroke-white"}
        d={arcPath(
          GEOMETRY.radius + 20,
          valueToAngle(segmentStart, min, max),
          valueToAngle(segmentEnd, min, max),
        )}
        fill="none"
        strokeLinecap="butt"
        strokeWidth="8"
      />
    );
  });
}

export function Gauge({
  min = 0,
  max = 100,
  ranges = [],
  value = 42,
  label = "PSI",
}: GaugeProps) {
  const angle = valueToAngle(value, min, max);
  const { majorTicks, minorTicks } = tickValues(min, max);

  return (
    <svg
      className="h-full w-full"
      role="img"
      viewBox={`0 0 ${GEOMETRY.viewBoxWidth} ${GEOMETRY.viewBoxHeight}`}
    >
      <title>{`${label} gauge`}</title>
      <rect
        className="fill-background"
        width={GEOMETRY.viewBoxWidth}
        height={GEOMETRY.viewBoxHeight}
      />
      <path
        className="stroke-muted/40"
        d={arcPath(
          GEOMETRY.radius + 20,
          GEOMETRY.startAngle,
          GEOMETRY.endAngle,
        )}
        fill="none"
        strokeLinecap="butt"
        strokeWidth="18"
      />

      <path
        className="stroke-primary/25"
        d={arcPath(
          GEOMETRY.radius + 20,
          GEOMETRY.startAngle,
          GEOMETRY.endAngle,
        )}
        fill="none"
        strokeLinecap="butt"
        strokeWidth="8"
      />

      {ranges.map((range, index) => renderVisualRange(range, min, max, index))}

      <g strokeLinecap="square">
        {majorTicks.map((tickValue) => {
          const tickAngle = valueToAngle(tickValue, min, max);
          const outer = polarToCartesian(GEOMETRY.radius, tickAngle);
          const inner = polarToCartesian(GEOMETRY.radius - 15, tickAngle);

          return (
            <line
              key={`major-${tickValue}`}
              className="stroke-foreground"
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              strokeWidth="3"
            />
          );
        })}
        {minorTicks.map((tickValue) => {
          const tickAngle = valueToAngle(tickValue, min, max);
          const outer = polarToCartesian(GEOMETRY.radius, tickAngle);
          const inner = polarToCartesian(GEOMETRY.radius - 7, tickAngle);

          return (
            <line
              key={`minor-${tickValue}`}
              className="stroke-muted-foreground"
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              strokeWidth="1.5"
            />
          );
        })}
      </g>

      <g textAnchor="middle">
        {majorTicks.map((tickValue) => {
          const tickAngle = valueToAngle(tickValue, min, max);
          const position = polarToCartesian(GEOMETRY.radius - 34, tickAngle);

          return (
            <text
              key={`label-${tickValue}`}
              className="fill-muted-foreground font-mono text-[17px]"
              x={position.x}
              y={position.y + 6}
            >
              {Math.round(tickValue)}
            </text>
          );
        })}
      </g>

      <g
        className="transition-transform duration-200 ease-out"
        style={{
          transform: `rotate(${angle}deg)`,
          transformBox: "view-box",
          transformOrigin: `${GEOMETRY.centerX}px ${GEOMETRY.centerY}px`,
        }}
      >
        <path className="fill-primary" d={needlePath(0)} />
      </g>
      <circle
        className="fill-foreground"
        cx={GEOMETRY.centerX}
        cy={GEOMETRY.centerY}
        r="9"
      />

      <g transform="translate(122 193)">
        <text
          className="fill-muted-foreground font-mono text-[20px]"
          x="38"
          y="24"
          textAnchor="middle"
        >
          {label}
        </text>
      </g>

      <g transform="translate(92 232)">
        <rect
          className="fill-background stroke-border"
          width="136"
          height="42"
        />
        <foreignObject width="136" height="42">
          <div className="grid h-full place-items-center font-mono text-[25px] leading-none text-foreground">
            <NumberFlow
              format={{
                minimumFractionDigits: 2,
                minimumIntegerDigits: 2,
                useGrouping: true,
              }}
              trend={0}
              value={value}
            />
          </div>
        </foreignObject>
      </g>
    </svg>
  );
}
