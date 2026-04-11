import { useAtomSuspense } from "@effect/atom-react";
import { Schema } from "effect";
import { DateTime } from "effect";
import { Suspense } from "react";

import { parameterSubscriptionAtom } from "@/lib/atom";
import { timeSubscriptionAtom } from "@/lib/atom";
import { makeCard } from "@/lib/cards.ts";

// import { formatDate } from "@/lib/utils";
// import {AsyncResult} from "effect/unstable/reactivity";

function Time() {
  const { value: time } = useAtomSuspense(timeSubscriptionAtom).value;

  const date = DateTime.toDate(time);

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function FlightStage() {
  const { value: stage } = useAtomSuspense(
    parameterSubscriptionAtom("flight_stage"),
  );
  console.log("Flight Stage" + stage);

  const eng: any = stage.engValue;

  return (
    <div className="w-full text-center font-mono text-xs text-orange-text">
      {eng?.value ?? eng?.stringValue ?? "—"}
    </div>
  );
}

export const FlightStageCard = makeCard({
  id: "test",
  name: "Test Card",
  schema: Schema.Struct({}),
  component: () => {
    const componentWidth = 512;
    const unit = componentWidth / 12;
    const buffer = unit / 4;

    const debug = false;

    return (
      <div className="relative flex h-full w-full justify-center">
        {/* Test Button */}
        <div className="absolute top-2 left-2">
          <button
            onClick={() => {
              console.log("Button clicked");
            }}
            className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white"
          >
            TEST
          </button>
        </div>

        {/* Card Element */}
        <div
          className="absolute flex aspect-[5/1] justify-center border"
          style={{
            width: componentWidth,
            top: buffer,
          }}
        >
          {debug && (
            <>
              {/* Unit Grid */}
              <div
                className="pointer-events-none absolute inset-0 opacity-25"
                style={{
                  backgroundImage: `
                                        linear-gradient(to right, blue 1px, transparent 1px),
                                        linear-gradient(to bottom, blue 1px, transparent 1px)
                                        `,
                  backgroundSize: `${buffer}px ${buffer}px`,
                  left: -1,
                  top: -1,
                }}
              />

              {/* Base Debug Text */}
              <div
                className="absolute text-center text-xs font-semibold text-red-500 opacity-25"
                style={{
                  left: -(buffer + unit),
                }}
              >
                {" "}
                DEBUG{" "}
              </div>

              {/* Base Debug Line */}
              <div
                className="absolute h-px bg-red-500 opacity-25"
                style={{
                  width: unit,
                  top: buffer * 1.5,
                  left: -(buffer + unit),
                }}
              />
            </>
          )}

          {/* Stage and Time Element */}
          <div
            className="absolute flex flex-col border border-zinc-700 bg-zinc-800 font-mono text-xs"
            style={{
              width: unit * 3,
              top: unit / 2 + (buffer - 1),
              transform: "translateY(-50%)",
            }}
          >
            <div className="w-full bg-zinc-700 text-center font-semibold text-zinc-300">
              STAGE:
              <Suspense fallback="LOADING">
                <FlightStage />
              </Suspense>
            </div>
            <div className="w-full text-center font-semibold text-amber-400">
              T+{" "}
              <Suspense fallback="LOADING">
                <Time />
              </Suspense>
            </div>
          </div>

          {/* Dial Cluster 1 */}
          <div
            className="absolute flex flex-col font-mono text-xs"
            style={{
              width: unit * 4,
              height: unit,
              top: buffer - 1,
              left: buffer - 1,
            }}
          >
            {/* Fuel Gauge Dial Element */}
            <div
              className="absolute overflow-hidden border border-zinc-700"
              style={{
                width: unit / 2,
                height: unit * (3 / 4), // half height = chops the circle
                left: unit,
                bottom: 0,
              }}
            >
              <div
                className="absolute rounded-full border border-zinc-700 bg-zinc-800"
                style={{
                  width: unit / 2,
                  height: unit / 2,
                  left: unit,
                  bottom: 0,
                }}
              />
            </div>

            {/* Altitude Gauge Dial Element */}
            <div
              className="absolute rounded-full border border-zinc-700 bg-zinc-800"
              style={{
                width: unit,
                height: unit,
                right: unit / 2,
                bottom: 0,
              }}
            />
          </div>

          {/* Dial Cluster 2 */}
          <div
            className="absolute flex flex-col font-mono text-xs"
            style={{
              width: unit * 4,
              height: unit,
              top: buffer - 1,
              right: buffer - 1,
            }}
          >
            {/* Speed Gauge Dial Element */}
            <div
              className="absolute rounded-full border border-zinc-700 bg-zinc-800"
              style={{
                width: unit,
                height: unit,
                left: unit / 2,
                bottom: 0,
              }}
            />

            {/* Acceleration Gauge Dial Element */}
            <div
              className="absolute rounded-full border border-zinc-700 bg-zinc-800"
              style={{
                width: unit,
                height: unit,
                right: unit,
                bottom: 0,
              }}
            />
          </div>

          {/* Progress Section */}
          <div
            className="absolute flex"
            style={{
              width: unit * 9.5,
              height: unit / 2,
              bottom: buffer - 1,
              left: unit + unit / 8 + buffer - 1,
            }}
          >
            {/* Pre-Flight Section */}
            <div
              className="absolute flex"
              style={{
                width: unit * 1.5,
                height: unit / 4,
              }}
            >
              {/* Pre-Flight Bar */}
              <div
                className="absolute rounded-full border border-zinc-700 bg-zinc-800"
                style={{
                  width: unit * 1.5,
                  height: unit / 8,
                  left: unit / 8,
                  transform: "translateY(50%)",
                }}
              />

              {/* Pad Indicator */}
              <div
                className="absolute rounded-full border border-zinc-700 bg-zinc-800"
                style={{
                  width: unit / 4,
                  height: unit / 4,
                }}
              />

              {/* Pad Text */}
              <div
                className="absolute text-[6px] font-semibold text-green-500"
                style={{
                  top: unit / 4,
                  left: unit / 8,
                  transform: "translateX(-50%)",
                }}
              >
                {" "}
                Pad{" "}
              </div>
            </div>

            {/* Ascent Section */}
            <div
              className="absolute flex"
              style={{
                width: unit * 1.5,
                height: unit / 4,
                left: unit * 1.5,
              }}
            >
              {/* Ascent Bar */}
              <div
                className="absolute rounded-full border border-zinc-700 bg-zinc-800"
                style={{
                  width: unit * 1.5,
                  height: unit / 8,
                  left: unit / 8,
                  transform: "translateY(50%)",
                }}
              />

              {/* Take-off Indicator */}
              <div
                className="absolute rounded-full border border-zinc-700 bg-zinc-800"
                style={{
                  width: unit / 4,
                  height: unit / 4,
                }}
              />

              {/* Take-off Text */}
              <div
                className="absolute text-[6px] text-green-500"
                style={{
                  top: unit / 4,
                  left: unit / 8,
                  transform: "translateX(-50%)",
                }}
              >
                {" "}
                Take-off{" "}
              </div>
            </div>

            {/* Pre-Apogee Section */}
            <div
              className="absolute flex"
              style={{
                width: unit * 1.5,
                height: unit / 4,
                left: unit * 1.5 * 2,
              }}
            >
              {/* Pre-Apogee Bar */}
              <div
                className="absolute rounded-full border border-zinc-700 bg-zinc-800"
                style={{
                  width: unit * 1.5,
                  height: unit / 8,
                  left: unit / 8,
                  transform: "translateY(50%)",
                }}
              />

              {/* Take-Off Indicator */}
              <div
                className="absolute rounded-full border border-zinc-700 bg-zinc-800"
                style={{
                  width: unit / 4,
                  height: unit / 4,
                }}
              />

              {/* Burnout Text */}
              <div
                className="absolute text-[6px] text-green-500"
                style={{
                  top: unit / 4,
                  left: unit / 8,
                  transform: "translateX(-50%)",
                }}
              >
                {" "}
                Burnout{" "}
              </div>
            </div>

            {/* Free Descent Section */}
            <div
              className="absolute flex"
              style={{
                width: unit * 1.5,
                height: unit / 4,
                left: unit * 1.5 * 3,
              }}
            >
              {/* Free Descent Bar */}
              <div
                className="absolute rounded-full border border-zinc-700 bg-zinc-800"
                style={{
                  width: unit * 1.5,
                  height: unit / 8,
                  left: unit / 8,
                  transform: "translateY(50%)",
                }}
              />

              {/* Apogee Indicator */}
              <div
                className="absolute rounded-full border border-zinc-700 bg-zinc-800"
                style={{
                  width: unit / 4,
                  height: unit / 4,
                }}
              />

              {/* Apogee Text */}
              <div
                className="absolute text-[6px] text-amber-400"
                style={{
                  top: unit / 4,
                  left: unit / 8,
                  transform: "translateX(-50%)",
                }}
              >
                {" "}
                Apogee{" "}
              </div>
            </div>

            {/* Drogue Descent Section */}
            <div
              className="absolute flex"
              style={{
                width: unit * 1.5,
                height: unit / 4,
                left: unit * 1.5 * 4,
              }}
            >
              {/* Drogue Descent Bar */}
              <div
                className="absolute rounded-full border border-zinc-700 bg-zinc-800"
                style={{
                  width: unit * 1.5,
                  height: unit / 8,
                  left: unit / 8,
                  transform: "translateY(50%)",
                }}
              />

              {/* Drogue Ejection Indicator */}
              <div
                className="absolute rounded-full border border-zinc-700 bg-zinc-800"
                style={{
                  width: unit / 4,
                  height: unit / 4,
                }}
              />

              {/* Drogue Ejection Text */}
              <div
                className="absolute text-[6px] text-amber-400"
                style={{
                  top: unit / 4,
                  left: unit / 8,
                  transform: "translateX(-50%)",
                }}
              >
                {" "}
                Drogue Ejection{" "}
              </div>
            </div>

            {/* Main Descent Section */}
            <div
              className="absolute flex"
              style={{
                width: unit * 1.5,
                height: unit / 4,
                left: unit * 1.5 * 5,
              }}
            >
              {/* Main Descent Bar */}
              <div
                className="absolute rounded-full border border-zinc-700 bg-zinc-800"
                style={{
                  width: unit * 1.5,
                  height: unit / 8,
                  left: unit / 8,
                  transform: "translateY(50%)",
                }}
              />

              {/* Main Ejection Indicator */}
              <div
                className="absolute rounded-full border border-zinc-700 bg-zinc-800"
                style={{
                  width: unit / 4,
                  height: unit / 4,
                }}
              />

              {/* Main Ejection Text */}
              <div
                className="absolute text-[6px] text-amber-400"
                style={{
                  top: unit / 4,
                  left: unit / 8,
                  transform: "translateX(-50%)",
                }}
              >
                {" "}
                Main Ejection{" "}
              </div>
            </div>

            {/* Recovery Section */}
            <div
              className="absolute flex"
              style={{
                width: unit,
                height: unit / 4,
                left: unit * 1.5 * 6,
              }}
            >
              {/* Touch-Down Indicator */}
              <div
                className="absolute rounded-full border border-zinc-700 bg-zinc-800"
                style={{
                  width: unit / 4,
                  height: unit / 4,
                }}
              />

              {/* Touch-Down Text */}
              <div
                className="absolute text-[6px] text-amber-400"
                style={{
                  top: unit / 4,
                  left: unit / 8,
                  transform: "translateX(-50%)",
                }}
              >
                {" "}
                Touch-down{" "}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
});
