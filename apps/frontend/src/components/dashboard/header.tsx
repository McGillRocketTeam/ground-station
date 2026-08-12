import { useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { DateTime } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { Suspense } from "react";

import { AlarmList } from "@/components/dashboard/alarm-list";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { alarmSummaryAtom, timeSubscriptionAtom } from "@/lib/atom";
import { mediaStateAtom, selectMediaState } from "@/lib/atom/media-state";
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
          {hasUnacked
            ? `${unacknowledgedCount} UNACKED`
            : acknowledgedCount > 0
              ? `${acknowledgedCount} ACKED`
              : "NONE"}
        </AlarmIndicatorState>
      );
    })
    .render();
}

function TMinus() {
  const { value: time } = useAtomSuspense(timeSubscriptionAtom).value as MissionTimeData;
  const mediaState = useAtomValue(mediaStateAtom, selectMediaState);
  const missionTime = toDate(time);
  const countdown = mediaState.redFlagAt
    ? formatCountdown(DateTime.toEpochMillis(mediaState.redFlagAt) - missionTime.getTime())
    : "SET RED FLAG";

  return (
    <div className="flex flex-col border font-mono text-xs">
      <div className="w-full bg-border text-center font-semibold text-muted-foreground">
        RED FLAG
      </div>
      <div className="w-[16.5ch] text-center text-xs text-orange-text">{countdown}</div>
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
        className="max-h-[70vh] w-[min(90vw,72rem)] overflow-auto no-scrollbar p-2"
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
