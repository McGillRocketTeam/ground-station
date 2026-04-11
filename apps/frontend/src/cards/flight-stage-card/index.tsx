import { Schema } from "effect";
import { Suspense } from "react";
import { useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";

import { makeCard } from "@/lib/cards";
import {
    timeSubscriptionAtom,
    parameterSubscriptionAtom,
} from "@/lib/atom";
import { formatDate } from "@/lib/utils";

const SYSTEM_A_PREFIX = "SystemA/Rocket/FlightComputer";

function Time() {
    const { value: time } = useAtomSuspense(timeSubscriptionAtom).value;
    return formatDate(time);
}

function FlightStage() {
    const result = useAtomValue(
        parameterSubscriptionAtom(`/${SYSTEM_A_PREFIX}/flight_stage`)
    );

    return AsyncResult.match(result, {
        onInitial: () => (
            <span className="text-muted-foreground">LOADING</span>
        ),
        onFailure: () => (
            <span className="text-error">ERROR</span>
        ),
        onSuccess: ({ value }) => {
            if (!("value" in value.engValue)) {
                return <span>UNKNOWN</span>;
            }

            const v = value.engValue.value;

            // Ensure it's renderable (fixes TS2322)
            if (
                typeof v === "string" ||
                typeof v === "number" ||
                typeof v === "boolean"
            ) {
                return <span>{v.toString()}</span>;
            }

            return <span>UNSUPPORTED</span>;
        },
    });
}

export const FlightStageCard = makeCard({
    id: "flight-stage-card",
    name: "Flight Stage Card",
    schema: Schema.Struct({}),
    component: () => {
        return (
            <div className="flex h-full w-full items-center justify-center">

                {/* OUTER RECTANGLE (4:1 ratio) */}
                <div className="border aspect-[4/1] w-[400px] flex items-center justify-center">

                    {/* INNER CARD */}
                    <div className="flex flex-col border font-mono text-xs">

                        {/* Header (flight stage value) */}
                        <div className="w-full bg-border text-center font-semibold text-muted-foreground">
                            <Suspense fallback="LOADING">
                                <FlightStage />
                            </Suspense>
                        </div>

                        {/* Time (no background) */}
                        <div className="w-[16.5ch] text-center text-xs text-orange-text">
                            <Suspense fallback="LOADING">
                                <Time />
                            </Suspense>
                        </div>

                    </div>

                </div>
            </div>
        );
    },
});