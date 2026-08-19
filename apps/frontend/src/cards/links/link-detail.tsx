import type { ReactNode } from "react";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { YamcsAtomHttpClient, selectedInstanceAtom } from "@/lib/atom";

import {
  TelemetryValue,
  duration,
  fixed,
  integer,
  numberValue,
} from "../network-topology/telemetry";
import { colorByStatus, type Link } from "./utils";

function Label({ children }: { children: ReactNode }) {
  return <div className="font-sans text-xs font-semibold">{children}</div>;
}

export function LinkDetail({ link }: { link: Link }) {
  const instance = useAtomValue(selectedInstanceAtom);
  const enableLinkAction = useAtomSet(YamcsAtomHttpClient.mutation("link", "enableLink"));
  const disableLinkAction = useAtomSet(YamcsAtomHttpClient.mutation("link", "disableLink"));
  const resetCounterAction = useAtomSet(YamcsAtomHttpClient.mutation("link", "resetCounters"));
  const issueCommand = useAtomSet(YamcsAtomHttpClient.mutation("command", "issueCommand"));

  const params = {
    instance,
    link: link.name,
  };
  const issueRadioCommand = (name: "enable_tx" | "disable_tx") => {
    issueCommand({
      params: {
        instance,
        processor: "realtime",
        name: `/${link.name}/${name}`,
      },
      payload: {},
    });
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

      {link.name.endsWith("/BeamBridge") ? <BeamBridgeTelemetry root={`/${link.name}`} /> : null}

      {link.parentName === undefined && (
        <>
          <Separator />
          <div className="grid grid-cols-2 gap-1 font-sans">
            {link.disabled ? (
              <Button onClick={() => enableLinkAction({ params })}>Enable Link</Button>
            ) : (
              <Button variant="destructive" onClick={() => disableLinkAction({ params })}>
                Disable Link
              </Button>
            )}
            <Button variant="secondary" onClick={() => resetCounterAction({ params })}>
              Reset Counters
            </Button>
            {link.name.endsWith("/Radio") ? (
              <>
                <Button variant="secondary" onClick={() => issueRadioCommand("enable_tx")}>
                  Enable TX
                </Button>
                <Button variant="secondary" onClick={() => issueRadioCommand("disable_tx")}>
                  Disable TX
                </Button>
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function BeamBridgeTelemetry({ root }: { root: string }) {
  return (
    <>
      <Separator />
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <Metric label="Role">
          <TelemetryValue parameter={`${root}/role`} />
        </Metric>
        <Metric label="IP Address">
          <TelemetryValue parameter={`${root}/ip_address`} />
        </Metric>
        <Metric label="Model" className="col-span-2">
          <TelemetryValue parameter={`${root}/model`} />
        </Metric>
        <Metric label="Peer">
          <TelemetryValue parameter={`${root}/peer_device_name`} />
        </Metric>
        <Metric label="Bridge">
          <TelemetryValue
            parameter={`${root}/bridge_connected`}
            format={(value) => (value === true ? "CONNECTED" : "DISCONNECTED")}
          />
        </Metric>
        <Metric label="Channel">
          <TelemetryValue parameter={`${root}/channel`} />
        </Metric>
        <Metric label="Width / Mode">
          <TelemetryValue parameter={`${root}/channel_width`} /> /{" "}
          <TelemetryValue parameter={`${root}/radio_mode`} />
        </Metric>
        <Metric label="Signal / SNR">
          <TelemetryValue parameter={`${root}/signal_dbm`} format={fixed(0, " dBm")} /> /{" "}
          <TelemetryValue parameter={`${root}/snr_db`} format={fixed(0, " dB")} />
        </Metric>
        <Metric label="TX / RX Rate">
          <TelemetryValue parameter={`${root}/tx_rate_mbps`} format={integer(" Mbps")} /> /{" "}
          <TelemetryValue parameter={`${root}/rx_rate_mbps`} format={integer(" Mbps")} />
        </Metric>
        <Metric label="Channel Util." className="col-span-2">
          <TelemetryValue parameter={`${root}/channel_util_percent`} format={integer("%")} /> in use
          {" / "}
          <TelemetryValue parameter={`${root}/rx_util_percent`} format={integer("%")} /> RX
          {" / "}
          <TelemetryValue parameter={`${root}/tx_util_percent`} format={integer("%")} /> TX
          {" / "}
          <TelemetryValue parameter={`${root}/interference_util_percent`} format={integer("%")} />
          {" interference"}
        </Metric>
        <Metric label="TX Packets / Bytes">
          <TelemetryValue parameter={`${root}/tx_packets`} format={integer()} /> /{" "}
          <TelemetryValue parameter={`${root}/tx_bytes`} format={bytes} />
        </Metric>
        <Metric label="RX Packets / Bytes">
          <TelemetryValue parameter={`${root}/rx_packets`} format={integer()} /> /{" "}
          <TelemetryValue parameter={`${root}/rx_bytes`} format={bytes} />
        </Metric>
        <Metric label="TX Error / Dropped">
          <TelemetryValue parameter={`${root}/tx_error_percent`} format={fixed(2, "%")} /> /{" "}
          <TelemetryValue parameter={`${root}/tx_dropped_percent`} format={fixed(2, "%")} />
        </Metric>
        <Metric label="RX Error / Dropped">
          <TelemetryValue parameter={`${root}/rx_error_percent`} format={fixed(2, "%")} /> /{" "}
          <TelemetryValue parameter={`${root}/rx_dropped_percent`} format={fixed(2, "%")} />
        </Metric>
        <Metric label="CPU / Memory">
          <TelemetryValue parameter={`${root}/cpu_percent`} format={integer("%")} /> /{" "}
          <TelemetryValue parameter={`${root}/memory_percent`} format={integer("%")} />
        </Metric>
        <Metric label="Uptime">
          <TelemetryValue parameter={`${root}/uptime_seconds`} format={duration} />
        </Metric>
      </div>
    </>
  );
}

function Metric({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <div>{children}</div>
    </div>
  );
}

function bytes(value: unknown) {
  const count = numberValue(value);
  if (count === undefined) return "--";
  if (count < 1024) return `${count} B`;
  if (count < 1024 ** 2) return `${(count / 1024).toFixed(1)} KB`;
  if (count < 1024 ** 3) return `${(count / 1024 ** 2).toFixed(2)} MB`;
  return `${(count / 1024 ** 3).toFixed(2)} GB`;
}
