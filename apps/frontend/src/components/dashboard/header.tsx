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
      <div className="bg-border text-muted-foreground w-full text-center font-semibold">
        MISSION TIME
      </div>

      <div className="text-orange-text w-[16.5ch] text-center text-xs">
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
      <div className="flex flex-col font-mono text-xs uppercase items-start">
        <div className="text-mrt">McGill Rocket Team</div>
        <div className="text-muted-foreground">Ground Station Controls</div>
      </div>
      <MissionTime />
    </div>
  );
}
