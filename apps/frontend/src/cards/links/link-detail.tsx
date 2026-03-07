import type { ReactNode } from "react";

import { useAtomSet } from "@effect/atom-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { YamcsAtomHttpClient } from "@/lib/atom";

import { colorByStatus, type Link } from "./utils";

function Label({ children }: { children: ReactNode }) {
  return <div className="font-sans text-xs font-semibold">{children}</div>;
}

export function LinkDetail({ link }: { link: Link }) {
  const enableLinkAction = useAtomSet(
    YamcsAtomHttpClient.mutation("link", "enableLink"),
  );
  const disableLinkAction = useAtomSet(
    YamcsAtomHttpClient.mutation("link", "disableLink"),
  );
  const resetCounterAction = useAtomSet(
    YamcsAtomHttpClient.mutation("link", "resetCounters"),
  );

  const params = {
    instance: import.meta.env.YAMCS_INSTANCE,
    link: link.name,
  };

  return (
    <div className="grid gap-2 font-mono text-sm">
      <div className="space-y-0.5">
        <Label>Link Name</Label>
        <div>{link.name}</div>
      </div>
      <div className="space-y-0.5">
        <Label>Type</Label>
        <div>{link.type}</div>
      </div>
      <div className="grid w-full grid-cols-3 gap-1">
        <div className="space-y-0.5">
          <Label>Status</Label>
          <div className={colorByStatus(link.status)}>{link.status}</div>
        </div>
        <div className="space-y-0.5">
          <Label>In Count</Label>
          <div>{link.dataInCount.toLocaleString()}</div>
        </div>
        <div className="space-y-0.5">
          <Label>Out Count</Label>
          <div>{link.dataOutCount.toLocaleString()}</div>
        </div>
      </div>
      <div className="space-y-0.5">
        <Label>Detailed Status</Label>
        <div>{link.detailedStatus}</div>
      </div>

      {link.parentName === undefined && (
        <>
          <Separator />
          <div className="grid grid-cols-2 gap-1 font-sans">
            {link.disabled ? (
              <Button onClick={() => enableLinkAction({ params })}>
                Enable Link
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() => disableLinkAction({ params })}
              >
                Disable Link
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => resetCounterAction({ params })}
            >
              Reset Counters
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
