import { Atom, useAtomValue } from "@effect-atom/atom-react";
import { parameterSubscriptionAtom } from "@mrt/yamcs-atom";
import Dygraph from "dygraphs";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Option } from "effect";

const chartDataAtom = Atom.make<[Date, number][]>((get) => {
  // Subscribe to realtime updates
  get.subscribe(
    parameterSubscriptionAtom("/FlightComputer/acceleration_x"),
    (result) => {
      if (result._tag !== "Success") return;

      const self: any[] | undefined = Option.getOrUndefined(get.self());
      if (self) {
        get.setSelf([
          ...self,
          [result.value.generationTime, result.value.engValue.value],
        ]);
      }
    },
  );

  return [];
});

// Format of DyGraphs data is csv seperated by newline
// where the series is in order and the first column is
// the x-axis
export function ParameterChart() {
  const parentRef = useRef<HTMLDivElement>(null);

  const chartRef = useRef<Dygraph>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useAtomValue(chartDataAtom, (data) => {
    if (!chartRef.current && containerRef.current && data.length > 0) {
      chartRef.current = new Dygraph(containerRef.current, data, {
        labels: ["X-Axis", "Y-Axis"],
        connectSeparatedPoints: true,
      });
    } else if (data.length > 0) {
      chartRef.current!.updateOptions({ file: data });
    }
  });

  useLayoutEffect(() => {
    if (!parentRef.current) return;

    const observer = new ResizeObserver((entries) => {
      // We can get the new dimensions from the entry's contentRect
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chartRef?.current?.resize(width, height);
      }
    });

    observer.observe(parentRef.current);

    // Cleanup function to disconnect the observer when the component unmounts
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={parentRef} className="absolute inset-0 grid">
      <div ref={containerRef} />
    </div>
  );
}
