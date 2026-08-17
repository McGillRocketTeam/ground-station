import type { DateTime } from "effect";

import { useAtomValue } from "@effect/atom-react";
import { DateTime as EffectDateTime } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import { missionTimeAtom } from "../state/parameter-atoms.ts";
import { MrtLogo } from "./mrt-logo.tsx";
import { OverlayCard } from "./overlay-card.tsx";

export function MediaHeader({ redFlagAt }: { redFlagAt: DateTime.Utc | null }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <MrtLogo />
      {redFlagAt !== null && <RedFlagCard redFlagAt={redFlagAt} />}
    </div>
  );
}

function RedFlagCard({ redFlagAt }: { redFlagAt: DateTime.Utc }) {
  const missionTime = useAtomValue(missionTimeAtom);
  const countdown = AsyncResult.match(missionTime, {
    onInitial: () => "LOADING",
    onFailure: () => "ERROR",
    onSuccess: ({ value }) =>
      formatCountdown(
        EffectDateTime.toEpochMillis(redFlagAt) - EffectDateTime.toEpochMillis(value.value),
      ),
  });

  return (
    <OverlayCard
      title="Red Flag"
      animateAppearance={false}
      inlineLayout
      layoutMode={false}
      showCutCornerBorder
    >
      <div className="w-[11ch] translate-y-[4px] text-center text-xl leading-none tabular-nums">
        {countdown}
      </div>
    </OverlayCard>
  );
}

function formatCountdown(milliseconds: number) {
  const sign = milliseconds < 0 ? "+" : "-";
  const totalSeconds = Math.min(Math.floor(Math.abs(milliseconds) / 1_000), 99 * 3_600 + 3_599);
  const hours = String(Math.floor(totalSeconds / 3_600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3_600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return `T${sign}${hours}:${minutes}:${seconds}`;
}
