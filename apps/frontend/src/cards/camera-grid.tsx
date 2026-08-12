import { Schema } from "effect";
import { useEffect, useRef, useState } from "react";

import { makeCard } from "@/lib/cards";
import { CameraArrayField } from "@/lib/dashboard-field-types";

import { WebRtcVideo } from "./video-card";

const CAMERA_ASPECT_RATIO = 16 / 9;
const GRID_GAP = 4;

type GridLayout = {
  columns: number;
  tileHeight: number;
  tileWidth: number;
};

function getOptimalLayout(width: number, height: number, cameraCount: number): GridLayout {
  let best: GridLayout = { columns: 1, tileHeight: 0, tileWidth: 0 };

  for (let columns = 1; columns <= cameraCount; columns += 1) {
    const rows = Math.ceil(cameraCount / columns);
    const maxTileWidth = Math.max(0, (width - GRID_GAP * (columns - 1)) / columns);
    const maxTileHeight = Math.max(0, (height - GRID_GAP * (rows - 1)) / rows);
    const tileWidth = Math.min(maxTileWidth, maxTileHeight * CAMERA_ASPECT_RATIO);
    const tileHeight = tileWidth / CAMERA_ASPECT_RATIO;

    if (tileWidth * tileHeight > best.tileWidth * best.tileHeight) {
      best = { columns, tileHeight, tileWidth };
    }
  }

  return best;
}

export const CameraGridCard = makeCard({
  id: "camera-grid-card",
  name: "Camera Grid",
  schema: Schema.Struct({ cameras: CameraArrayField }),
  component: (props) => <CameraGrid cameras={props.params.cameras} />,
});

function CameraGrid({ cameras }: { cameras: ReadonlyArray<string> }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ height: 0, width: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const bounds = container.getBoundingClientRect();
      setSize({ height: bounds.height, width: bounds.width });
    };
    const observer = new ResizeObserver(updateSize);

    updateSize();
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const layout = getOptimalLayout(size.width, size.height, cameras.length);

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden bg-black">
      {cameras.length === 0 ? (
        <div className="grid h-full place-items-center text-sm text-white/60">
          Configure cameras to populate the grid.
        </div>
      ) : (
        <div
          className="grid h-full w-full place-content-center"
          style={{
            gap: GRID_GAP,
            gridAutoRows: layout.tileHeight,
            gridTemplateColumns: `repeat(${layout.columns}, ${layout.tileWidth}px)`,
          }}
        >
          {cameras.map((camera, index) => (
            <div
              key={`${camera}-${index}`}
              className="relative overflow-hidden border border-white/15 bg-black"
            >
              <WebRtcVideo camera={camera} url={undefined} />
              <div className="pointer-events-none absolute top-0 left-0 max-w-full bg-black/65 px-2 py-1 text-xs text-white">
                <span className="block truncate">{camera}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
