import { useAtomSuspense } from "@effect/atom-react";
import { DateTime } from "effect";
import { Suspense, useState } from "react";

import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { timeSubscriptionAtom } from "@/lib/atom";
import { cn, formatDate } from "@/lib/utils";

type MissionTimeData = (typeof import("@mrt/yamcs-effect").TimeEvent.Type)["data"];

function Time() {
  const { value: time } = useAtomSuspense(timeSubscriptionAtom).value as MissionTimeData;

  return formatDate(time);
}

function toDate(value: Date | DateTime.DateTime) {
  return value instanceof Date ? value : DateTime.toDate(value);
}

function formatCountdown(milliseconds: number) {
  const sign = milliseconds < 0 ? "+" : "-";
  const totalSeconds = Math.floor(Math.abs(milliseconds) / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return `T${sign}${hours}:${minutes}:${seconds}`;
}

function createTargetTime(date: Date, value: string) {
  const [hours = "0", minutes = "0", seconds = "0"] = value.split(":");
  const target = new Date(date);
  target.setHours(Number(hours), Number(minutes), Number(seconds), 0);

  return target;
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

function TMinus() {
  const { value: time } = useAtomSuspense(timeSubscriptionAtom).value as MissionTimeData;
  const [targetTime, setTargetTime] = useState("");
  const missionTime = toDate(time);
  const countdown = targetTime
    ? formatCountdown(createTargetTime(missionTime, targetTime).getTime() - missionTime.getTime())
    : "SET RED FLAG";

  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        render={
          <button
            type="button"
            className="flex flex-col border font-mono text-xs transition-colors hover:bg-accent/40 data-popup-open:bg-accent/40"
          />
        }
      >
        <div className="w-full bg-border text-center font-semibold text-muted-foreground">
          RED FLAG
        </div>

        <div className="w-[16.5ch] text-center text-xs text-orange-text">{countdown}</div>
      </PopoverTrigger>

      <PopoverContent className="w-52 gap-2">
        <div className="font-medium">Set red flag time</div>
        <Input
          type="time"
          step={1}
          value={targetTime}
          onChange={(event) => {
            setTargetTime(event.target.value);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function DashboardHeader({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-row justify-between", className)}>
      <div className="flex flex-col items-start font-mono text-xs uppercase">
        <div className="text-mrt">McGill Rocket Team</div>
        <div className="text-muted-foreground">Ground Station Controls</div>
      </div>
      <div className="flex flex-row gap-2">
        <Suspense fallback={<TMinusFallback />}>
          <TMinus />
        </Suspense>
        <MissionTime />
      </div>
    </div>
  );
}

function TMinusFallback() {
  return (
    <div className="flex flex-col border font-mono text-xs">
      <div className="w-full bg-border text-center font-semibold text-muted-foreground">
        RED FLAG
      </div>

      <div className="w-[16.5ch] text-center text-xs text-orange-text">LOADING</div>
    </div>
  );
}
