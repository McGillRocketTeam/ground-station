import { useState, useRef, useEffect } from "react";
import Diagram from "./diagram.svg?react";
import "./pid.css";

// Only these valves are interactive
const ALLOWED_IDS = new Set([
  "o4R9D08Z0cDARhqoL5Nh-6",
  "o4R9D08Z0cDARhqoL5Nh-42",
  "o4R9D08Z0cDARhqoL5Nh-40",
  "o4R9D08Z0cDARhqoL5Nh-9",
  "o4R9D08Z0cDARhqoL5Nh-7",
  "o4R9D08Z0cDARhqoL5Nh-43",
  "o4R9D08Z0cDARhqoL5Nh-133",
  "o4R9D08Z0cDARhqoL5Nh-145",
  "JHZkuTzufEzapov2jROR-5",
  "o4R9D08Z0cDARhqoL5Nh-173",
  "o4R9D08Z0cDARhqoL5Nh-248",
  "o4R9D08Z0cDARhqoL5Nh-163",
  "o4R9D08Z0cDARhqoL5Nh-225",
  "o4R9D08Z0cDARhqoL5Nh-217",
  "o4R9D08Z0cDARhqoL5Nh-140",
  "o4R9D08Z0cDARhqoL5Nh-59",
  "o4R9D08Z0cDARhqoL5Nh-128",
  "o4R9D08Z0cDARhqoL5Nh-127",
  "o4R9D08Z0cDARhqoL5Nh-123",
  "o4R9D08Z0cDARhqoL5Nh-57",
  "o4R9D08Z0cDARhqoL5Nh-52",
  "o4R9D08Z0cDARhqoL5Nh-55",
  "o4R9D08Z0cDARhqoL5Nh-177",
  "o4R9D08Z0cDARhqoL5Nh-170",
  "o4R9D08Z0cDARhqoL5Nh-13",
  "o4R9D08Z0cDARhqoL5Nh-235",
  "o4R9D08Z0cDARhqoL5Nh-151",
  "o4R9D08Z0cDARhqoL5Nh-48",
  "o4R9D08Z0cDARhqoL5Nh-18",
  "o4R9D08Z0cDARhqoL5Nh-19",
  "o4R9D08Z0cDARhqoL5Nh-211",
  "o4R9D08Z0cDARhqoL5Nh-196",
  "o4R9D08Z0cDARhqoL5Nh-204",
  "o4R9D08Z0cDARhqoL5Nh-192",
  "o4R9D08Z0cDARhqoL5Nh-20",
  "o4R9D08Z0cDARhqoL5Nh-32",
  "o4R9D08Z0cDARhqoL5Nh-190",
  "o4R9D08Z0cDARhqoL5Nh-155",
  "o4R9D08Z0cDARhqoL5Nh-15",
  "o4R9D08Z0cDARhqoL5Nh-251",
]);

export function PID() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleValve = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      // if valve currently selected, unselect it
      if (next.has(id)) {
        next.delete(id);
      // if valve not currently selected, select it
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Apply highlighting only to allowed valves
  useEffect(() => {
    if (!containerRef.current) return;

    const elements = containerRef.current.querySelectorAll("[data-cell-id]");

    elements.forEach((el) => {
      const id = el.getAttribute("data-cell-id");
      if (!id) return;

      // Remove highlight from non-allowed elements
      if (!ALLOWED_IDS.has(id)) {
        el.classList.remove("selected-valve");
        return;
      }

      if (selected.has(id)) {
        el.classList.add("selected-valve");
      } else {
        el.classList.remove("selected-valve");
      }
    });
  }, [selected]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full flex flex-col items-center justify-center gap-4"
    >
      <Diagram
        className="max-h-full max-w-full"
        onClick={(e: any) => {
          const target = e.target.closest("[data-cell-id]");
          if (!target) return;

          const id = target.getAttribute("data-cell-id");
          if (!id) return;

          // Only allow specific valves
          if (!ALLOWED_IDS.has(id)) return;

          toggleValve(id);
        }}
      />

      {/* Display selected IDs */}
      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded w-full max-w-xl text-center">
        <h2 className="font-semibold mb-2">Selected Valves:</h2>

        {selected.size === 0 ? (
          <p className="text-gray-500">None selected</p>
        ) : (
          <ul className="flex flex-wrap gap-2 justify-center">
            {[...selected].map((id) => (
              <li
                key={id}
                className="px-2 py-1 bg-green-200 dark:bg-green-700 rounded text-sm"
              >
                {id}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


/*
export function PID() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleValve = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const elements = containerRef.current.querySelectorAll("[data-cell-id]");

    elements.forEach((el) => {
      const id = el.getAttribute("data-cell-id");
      if (!id) return;

      if (selected.has(id)) {
        el.classList.add(
          "selected-valve",
          "[&_*]:stroke-lime-500",
          "[&_*]:stroke-[4]"
        );
      } else {
        el.classList.remove(
          "selected-valve",
          "[&_*]:stroke-lime-500",
          "[&_*]:stroke-[4]"
        );
      }
    });
  }, [selected]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full flex items-center justify-center"
    >
      <Diagram
        className="max-h-full max-w-full"
        onClick={(e: any) => {
          const target = e.target.closest("[data-cell-id]");
          if (!target) return;

          const id = target.getAttribute("data-cell-id");
          if (!id) return;

          toggleValve(id);
        }}
      />
    </div>
  );
}
*/