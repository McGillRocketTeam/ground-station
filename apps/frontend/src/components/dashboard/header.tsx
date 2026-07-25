import { useAtom, useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { DateTime } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { Suspense, useEffect } from "react";

import { AlarmList } from "@/components/dashboard/alarm-list";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { alarmSummaryAtom, redFlagTimeAtom, timeSubscriptionAtom } from "@/lib/atom";
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

function formatDayKey(date: Date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function AlarmIndicator() {
  const summary = useAtomValue(alarmSummaryAtom);

  return AsyncResult.builder(summary)
    .onInitial(() => <AlarmIndicatorState>LOADING</AlarmIndicatorState>)
    .onFailure((cause) => (
      <AlarmIndicatorState className="text-error" title={String(cause)}>
        ERROR
      </AlarmIndicatorState>
    ))
    .onSuccess(({ acknowledgedCount, hasUnacked, highestSeverity, unacknowledgedCount }) => {
      const alarmTone =
        highestSeverity === undefined
          ? undefined
          : highestSeverity === "CRITICAL" || highestSeverity === "SEVERE"
            ? "error"
            : "warning";

      return (
        <AlarmIndicatorState
          alarmTone={alarmTone}
          className={cn(
            hasUnacked && alarmTone === "error" && "text-error",
            hasUnacked && alarmTone === "warning" && "text-foreground",
          )}
        >
          {hasUnacked ? `${unacknowledgedCount} UNACKED` : `${acknowledgedCount} ACKED`}
        </AlarmIndicatorState>
      );
    })
    .render();
}

function TMinus() {
  const { value: time } = useAtomSuspense(timeSubscriptionAtom).value as MissionTimeData;
  const [redFlagTime, setRedFlagTime] = useAtom(redFlagTimeAtom);
  const missionTime = toDate(time);
  const missionDay = formatDayKey(missionTime);
  const targetTime = redFlagTime.day === missionDay ? redFlagTime.time : "";
  const countdown = targetTime
    ? formatCountdown(createTargetTime(missionTime, targetTime).getTime() - missionTime.getTime())
    : "SET RED FLAG";

  useEffect(() => {
    if (redFlagTime.day && redFlagTime.day !== missionDay) {
      setRedFlagTime({ day: "", time: "" });
    }
  }, [missionDay, redFlagTime.day, setRedFlagTime]);

  return (
    <Popover>
      <PopoverTrigger
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
            setRedFlagTime(
              event.target.value
                ? { day: missionDay, time: event.target.value }
                : { day: "", time: "" },
            );
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
        <AlarmIndicator />
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

function AlarmIndicatorState({
  alarmTone,
  children,
  className,
  title,
}: {
  alarmTone?: "warning" | "error";
  children: string | number;
  className?: string;
  title?: string;
}) {
  return (
    <Popover>
      <PopoverContent
        align="end"
        className="max-h-[70vh] w-[min(90vw,72rem)] overflow-auto no-scrollbar border-primary border p-2"
      >
        <AlarmList />
      </PopoverContent>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex flex-col border font-mono text-xs",
              alarmTone === "warning" && "border-warning",
              alarmTone === "error" && "border-error",
            )}
          />
        }
      >
        <div
          className={cn(
            "w-full bg-border text-center font-semibold text-muted-foreground",
            alarmTone === "warning" && "bg-warning text-warning-foreground",
            alarmTone === "error" && "bg-error text-error-foreground",
          )}
        >
          ALARMS
        </div>

        <div
          className={cn("w-[16.5ch] text-center text-xs text-orange-text", className)}
          title={title}
        >
          {children}
        </div>
      </PopoverTrigger>
    </Popover>
  );
}
