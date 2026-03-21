import { useState, useRef, useEffect } from "react";
import Diagram from "./diagram.svg?react";
import "./pid.css";

// ✅ Allowed valves
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

// Dummy parameters - These will be replaced by actual backend parametrs
const DUMMY_PARAMS = ["valveA", "valveB", "valveC", "valveD", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

export function PID() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Valve -> param mapping
  const [valveToParam, setValveToParam] = useState<Record<string, string>>({});

  // Param values - Initialize all to false to start
  const [paramValues, setParamValues] = useState<Record<string, boolean>>(
    Object.fromEntries(DUMMY_PARAMS.map((param) => [param, false]))
  );

  // Popup state
  const [activeValve, setActiveValve] = useState<string | null>(null);
  // Search bar state for popup
  const [searchTerm, setSearchTerm] = useState("");

  // Handle clicking a valve
  const handleClick = (e: any) => {
    const target = e.target.closest("[data-cell-id]");
    if (!target) return;

    const id = target.getAttribute("data-cell-id");
    if (!id || !ALLOWED_IDS.has(id)) return;

    setActiveValve(id);
  };

  // Apply highlighting based on param values
  useEffect(() => {
    if (!containerRef.current) return;

    const elements = containerRef.current.querySelectorAll("[data-cell-id]");

    elements.forEach((el) => {
      const id = el.getAttribute("data-cell-id");
      if (!id) return;

      const param = valveToParam[id];
      const isOn = param ? paramValues[param] : false;

      if (isOn) {
        el.classList.add("selected-valve");
      } else {
        el.classList.remove("selected-valve");
      }
    });
  }, [paramValues, valveToParam]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full flex items-start justify-start"
    >
      {/* SVG */}
      <Diagram
        className="w-[80vw] h-[80vh]"
        onClick={handleClick}
      />

      {/* Popup menu to show available parameters when a valve is clicked */}
      {activeValve && (
        <div
          className="fixed top-9 right-2 bg-white border p-3 rounded shadow z-50 w-50 max-h-screen"
        >
          {/* Search bar */}
          <input
            type="text"
            placeholder="Search parameters..."
            className="w-full mb-2 px-2 py-1 border rounded text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <h3 className="font-semibold mb-2 text-sm">Select Parameter</h3>

          {/* Scrollable list */}
          <div className="overflow-y-auto max-h-40">
            {DUMMY_PARAMS.filter((param) =>
              param.toLowerCase().includes(searchTerm.toLowerCase())
            ).map((param) => (
              <button
                key={param}
                className="block w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm"
                onClick={() => {
                  setValveToParam((prev) => ({ ...prev, [activeValve]: param }));
                  setActiveValve(null);
                  setSearchTerm(""); // reset search when selecting
                }}
              >
                {param}
              </button>
            ))}
          </div>

          <button
            className="mt-2 text-red-500 text-sm"
            onClick={() => {
              setActiveValve(null);
              setSearchTerm("");
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Debug panel to toggle params */}
      <div className="fixed bottom-4 right-4 bg-white p-4 rounded shadow w-50 max-h-[60vh] overflow-y-auto">
        <h3 className="font-semibold mb-2">Toggle Params</h3>

        {DUMMY_PARAMS.map((param) => (
          <button
            key={param}
            className="block mb-1 px-2 py-1 bg-gray-200 rounded text-sm w-full text-left"
            onClick={() =>
              setParamValues((prev) => ({ ...prev, [param]: !prev[param] }))
            }
          >
            {param}: {paramValues[param] ? "ON" : "OFF"}
          </button>
        ))}
      </div>
    </div>
  );
}

/*
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
*/

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