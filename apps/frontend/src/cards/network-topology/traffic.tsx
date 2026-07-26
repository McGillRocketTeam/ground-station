import { useAtomSuspense } from "@effect/atom-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Suspense } from "react";

import type { LiveParameterUpdate } from "@/lib/atom";

import { parameterSubscriptionAtom } from "@/lib/atom";

import { boolean, fixed, integer, ROUTER_ROOT, TelemetryValue } from "./telemetry";

function Direction({ direction }: { direction: "rx" | "tx" }) {
  const Icon = direction === "rx" ? ArrowDown : ArrowUp;
  const label = direction.toUpperCase();

  return (
    <div className="network-topology__direction grid grid-cols-[1lh_1fr] items-start gap-x-2 p-2">
      <Icon className="size-[1lh]" strokeWidth={1.5} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <span className="col-span-2 text-muted-foreground">{label} CURRENT</span>
        <TelemetryValue
          parameter={`${ROUTER_ROOT}/Traffic/${direction}_mbps`}
          format={fixed(1, " Mbps")}
          className="col-span-2 text-sm text-white-text"
        />
        <span className="text-muted-foreground">UTIL</span>
        <TelemetryValue
          parameter={`${ROUTER_ROOT}/Traffic/${direction}_utilization_percent`}
          format={fixed(0, "%")}
        />
        <span className="text-muted-foreground">AVG 5M</span>
        <TelemetryValue
          parameter={`${ROUTER_ROOT}/Traffic/${direction}_average_5m_mbps`}
          format={fixed(1, " Mbps")}
        />
        <span className="text-muted-foreground">PEAK 1M</span>
        <TelemetryValue
          parameter={`${ROUTER_ROOT}/Traffic/${direction}_peak_1m_mbps`}
          format={fixed(1, " Mbps")}
        />
      </div>
    </div>
  );
}

function InterfaceHealth() {
  const update = useAtomSuspense(parameterSubscriptionAtom(`${ROUTER_ROOT}/Wan/uplink_type`))
    .value as LiveParameterUpdate;
  const engValue = update.value.engValue;
  const uplinkType = "value" in engValue ? String(engValue.value) : "NONE";

  if (uplinkType === "ETHERNET") {
    return (
      <>
        <div className="bg-background p-2">
          <span>
            <TelemetryValue
              parameter={`${ROUTER_ROOT}/Interface/speed_mbps`}
              format={integer(" Mbps")}
            />
            <span className="block text-muted-foreground">LINK</span>
          </span>
        </div>
        <div className="bg-background p-2">
          <span>
            <TelemetryValue parameter={`${ROUTER_ROOT}/Interface/duplex`} />
            <span className="block text-muted-foreground">DUPLEX</span>
          </span>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="bg-background p-2">
        <span>
          <TelemetryValue parameter={`${ROUTER_ROOT}/Interface/carrier`} format={boolean} />
          <span className="block text-muted-foreground">CARRIER</span>
        </span>
      </div>
      <div className="bg-background p-2">
        <span>
          <TelemetryValue parameter={`${ROUTER_ROOT}/Interface/rx_errors`} />
          <span className="text-muted-foreground"> / </span>
          <TelemetryValue parameter={`${ROUTER_ROOT}/Interface/tx_errors`} />
          <span className="block text-muted-foreground">RX / TX ERRORS</span>
        </span>
      </div>
    </>
  );
}

export function TrafficModule() {
  return (
    <section className="network-topology__traffic network-topology__module">
      <div className="network-topology__eyebrow">THROUGHPUT</div>
      <div className="network-topology__full-bleed grid grid-cols-2 gap-px bg-border">
        <Direction direction="rx" />
        <Direction direction="tx" />
      </div>
      <div className="network-topology__full-bleed grid grid-cols-3 gap-px border-t border-border bg-border">
        <Suspense
          fallback={
            <>
              <div className="bg-background p-2">--</div>
              <div className="bg-background p-2">--</div>
            </>
          }
        >
          <InterfaceHealth />
        </Suspense>
        <div className="bg-background p-2">
          <span>
            <TelemetryValue
              parameter={`${ROUTER_ROOT}/Traffic/bottlenecked`}
              format={boolean}
              className={(value) => (value === true ? "text-error" : "text-white-text")}
            />
            <span className="block text-muted-foreground">BOTTLENECK</span>
          </span>
        </div>
      </div>
    </section>
  );
}
