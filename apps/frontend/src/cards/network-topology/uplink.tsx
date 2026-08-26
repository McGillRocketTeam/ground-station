import { ROUTER_ROOT, TelemetryValue } from "./telemetry";

export function UplinkSummary() {
  return (
    <div className="network-topology__uplink-summary">
      <div className="text-orange-text">UPLINK</div>
      <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3">
        <span className="text-muted-foreground">MODE</span>
        <TelemetryValue parameter={`${ROUTER_ROOT}/Wan/uplink_type`} />
        <span className="text-muted-foreground">DEVICE</span>
        <TelemetryValue parameter={`${ROUTER_ROOT}/Wan/physical_device`} />
        <span className="text-muted-foreground">IPV4</span>
        <TelemetryValue parameter={`${ROUTER_ROOT}/Wan/ipv4_address`} />
        <span className="text-muted-foreground">GATEWAY</span>
        <TelemetryValue parameter={`${ROUTER_ROOT}/Wan/default_gateway`} />
      </div>
    </div>
  );
}
