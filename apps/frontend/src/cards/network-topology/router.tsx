import { duration, fixed, ROUTER_ROOT, TelemetryValue } from "./telemetry";
import { UplinkSummary } from "./uplink";

export function RouterModule() {
  return (
    <section className="network-topology__router network-topology__module">
      <div className="network-topology__eyebrow">ROUTER</div>
      <div className="grid gap-1">
        <span className="text-sm text-orange-text">GL-SFT1200</span>
        <div className="grid grid-cols-[auto_1fr] gap-x-3">
          <span className="text-muted-foreground">PROTOCOL</span>
          <TelemetryValue parameter={`${ROUTER_ROOT}/Wan/protocol`} />
          <span className="text-muted-foreground">MAC</span>
          <TelemetryValue parameter={`${ROUTER_ROOT}/Interface/mac_address`} />
          <span className="text-muted-foreground">UPTIME</span>
          <TelemetryValue parameter={`${ROUTER_ROOT}/Router/uptime_seconds`} format={duration} />
          <span className="text-muted-foreground">LOAD 1M</span>
          <TelemetryValue parameter={`${ROUTER_ROOT}/Router/load_1m`} format={fixed(2)} />
        </div>
      </div>
      <UplinkSummary />
    </section>
  );
}
