import { useAtomSuspense } from "@effect/atom-react";
import { Suspense } from "react";

import { timeSubscriptionAtom } from "@/lib/atom";
import { cn, formatDate } from "@/lib/utils";

function Time() {
  const { value: time } = useAtomSuspense(timeSubscriptionAtom).value;

  return formatDate(time);
}

function MissionTime() {
  return (
    <div className="flex flex-col border font-mono text-xs">
      <div className="w-full bg-border text-center font-semibold text-muted-foreground">
        MISSION TIME
      </div>

      <div className="w-[16.5ch] text-center text-xs text-orange-text">
        <Suspense fallback="LOADING">
          <Time />
        </Suspense>
      </div>
    </div>
  );
}

export function DashboardHeader({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-row justify-between", className)}>
      <div className="flex flex-col items-start font-mono text-xs uppercase">
        <div className="text-mrt">McGill Rocket Team</div>
        <div className="text-muted-foreground">Ground Station Controls</div>
      </div>
      <MissionTime />
    </div>
  );
}
