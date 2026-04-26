import type { ChartSeriesKey } from "./config";

export type ChartPoint = {
  time: number;
  avg: number;
  min: number;
  max: number;
};

export type ChartSeriesData = Record<ChartSeriesKey, ChartPoint[]>;

export type ChartViewport = {
  mode: "live" | "paused";
  start: number;
  end: number;
};

export type PanelApi = {
  height: number;
  width: number;
  onDidDimensionsChange: (
    listener: (event: { height: number; width: number }) => void,
  ) => { dispose: () => void };
};
