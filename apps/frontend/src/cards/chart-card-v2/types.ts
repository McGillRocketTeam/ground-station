export type ChartPoint = {
  time: number;
  avg: number;
  min: number;
  max: number;
};

export type ChartSeriesData = {
  x: ChartPoint[];
  y: ChartPoint[];
};

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
