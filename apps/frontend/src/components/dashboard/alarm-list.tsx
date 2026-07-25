import type { AlarmData } from "@mrt/yamcs-effect";

import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";

import { DataGridBody, DataGridHead, DataGridHeader, DataGridRow } from "@/components/ui/data-grid";
import { acknowledgeAlarmAtom, alarmsSubscriptionAtom } from "@/lib/atom";
import { cn, formatDate, stringifyValue } from "@/lib/utils";

type Alarm = typeof AlarmData.Type;

function alarmTone(severity: Alarm["severity"]) {
  return severity === "CRITICAL" || severity === "SEVERE" ? "error" : "warning";
}

function alarmName(alarm: Alarm) {
  return alarm.parameterDetail?.parameter?.qualifiedName ?? alarm.id.name;
}

function alarmValue(alarm: Alarm, source: "triggerValue" | "currentValue") {
  if (alarm.type !== "PARAMETER") {
    return "-";
  }

  return stringifyValue(alarm.parameterDetail?.[source].engValue, "Unknown");
}

export function AlarmList() {
  const alarms = useAtomValue(alarmsSubscriptionAtom);
  const acknowledgeAlarm = useAtomSet(acknowledgeAlarmAtom);

  return AsyncResult.builder(alarms)
    .onInitial(() => (
      <div className="p-6 text-center font-mono text-muted-foreground uppercase">
        Loading alarms
      </div>
    ))
    .onFailure(() => (
      <div className="p-6 text-center font-mono text-error uppercase">Unable to load alarms</div>
    ))
    .onSuccess((alarms) => {
      const visibleAlarms = alarms.filter((alarm) => alarm.shelveInfo === undefined);

      if (visibleAlarms.length === 0) {
        return (
          <div className="p-6 text-center font-mono text-muted-foreground uppercase">
            No active alarms
          </div>
        );
      }

      return (
        <div className="grid min-w-5xl grid-cols-[5rem_6rem_11rem_minmax(18rem,1fr)_8rem_10rem_10rem] gap-px overflow-auto bg-border">
          <DataGridHeader className="sticky top-0 z-10 bg-background">
            <DataGridHead>State</DataGridHead>
            <DataGridHead>Severity</DataGridHead>
            <DataGridHead>Alarm time</DataGridHead>
            <DataGridHead>Alarm name</DataGridHead>
            <DataGridHead>Type</DataGridHead>
            <DataGridHead>Trigger value</DataGridHead>
            <DataGridHead>Live value</DataGridHead>
          </DataGridHeader>

          <DataGridBody className="">
            {visibleAlarms.map((alarm) => {
              const acknowledge = () => {
                if (alarm.acknowledged) return;

                acknowledgeAlarm({
                  alarmName: alarmName(alarm),
                  seqNum: alarm.seqNum,
                });
              };

              return (
                <DataGridRow
                  key={`${alarm.id.namespace ?? ""}:${alarm.id.name}:${alarm.seqNum}`}
                  role={alarm.acknowledged ? undefined : "button"}
                  tabIndex={alarm.acknowledged ? undefined : 0}
                  aria-label={alarm.acknowledged ? undefined : `Acknowledge ${alarmName(alarm)}`}
                  title={alarm.acknowledged ? undefined : "Click to acknowledge alarm"}
                  className={cn(
                    !alarm.acknowledged && "cursor-pointer *:text-error-foreground",
                    !alarm.acknowledged &&
                      alarmTone(alarm.severity) === "warning" &&
                      "*:bg-warning *:text-warning-foreground hover:*:bg-warning/20",
                    !alarm.acknowledged &&
                      alarmTone(alarm.severity) === "error" &&
                      "*:bg-error hover:*:bg-error/20",
                  )}
                  onClick={acknowledge}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    acknowledge();
                  }}
                >
                  <div>{alarm.acknowledged ? "ACK" : "UNACK"}</div>
                  <div>{alarm.severity}</div>
                  <div>{formatDate(alarm.triggerTime)}</div>
                  <div className="truncate" title={alarmName(alarm)}>
                    {alarmName(alarm)}
                  </div>
                  <div>{alarm.type}</div>
                  <div>{alarmValue(alarm, "triggerValue")}</div>
                  <div>{alarmValue(alarm, "currentValue")}</div>
                </DataGridRow>
              );
            })}
          </DataGridBody>
        </div>
      );
    })
    .render();
}
