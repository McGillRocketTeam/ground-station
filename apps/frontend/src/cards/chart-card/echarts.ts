import type { ECharts } from "echarts";

import type { ChartSeriesConfig } from "./config";
import type { ChartSeriesData } from "./types";

function toAvgData(points: ChartSeriesData[string] = []) {
  const data: Array<[number, number | null]> = [];

  for (let index = 0; index < points.length; index++) {
    const point = points[index]!;
    const previous = points[index - 1];
    const next = points[index + 1];

    if (previous) {
      const previousGap = point.time - previous.time;
      const localBucketWidth = getBucketWidth(points, index);

      if (previousGap > localBucketWidth * 2.5) {
        data.push([previous.time + previousGap / 2, null]);
      }
    }

    data.push([point.time, point.avg]);

    if (!next) continue;
  }

  return data;
}

function getBucketWidth(points: ChartSeriesData[string] = [], index: number) {
  const point = points[index]!;
  const previous = points[index - 1];
  const next = points[index + 1];
  const previousGap = previous ? point.time - previous.time : undefined;
  const nextGap = next ? next.time - point.time : undefined;

  if (previousGap !== undefined && nextGap !== undefined) {
    return Math.max(1, Math.min(previousGap, nextGap));
  }

  return Math.max(1, previousGap ?? nextGap ?? 1);
}

function toRangeData(points: ChartSeriesData[string] = []) {
  return points.map((point, index) => {
    const bucketWidth = getBucketWidth(points, index);

    return [
      point.time,
      Math.min(point.min, point.max),
      Math.max(point.min, point.max),
      bucketWidth,
    ];
  });
}

export function updateChartData(
  chart: ECharts | null,
  seriesConfigs: ReadonlyArray<ChartSeriesConfig>,
  seriesData: ChartSeriesData,
) {
  chart?.setOption({
    series: seriesConfigs.flatMap((series) => [
      {
        data: toAvgData(seriesData[series.parameter]),
      },
      {
        data: toRangeData(seriesData[series.parameter]),
      },
    ]),
  });
}

export function setChartViewport(
  chart: ECharts | null,
  start: number,
  end: number,
) {
  chart?.setOption({
    xAxis: {
      max: end,
      min: start,
    },
  });
}

export function resizeChart(
  chart: ECharts | null,
  size?: { height: number; width: number },
) {
  requestAnimationFrame(() => {
    if (size) {
      chart?.resize(size);
      return;
    }

    chart?.resize();
  });
}
