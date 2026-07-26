import { useAtomValue } from "@effect/atom-react";

import { singleLinkSubscriptionAtom } from "@/lib/atom";

import { fixed, integer, TelemetryValue } from "./telemetry";

function Antenna({ location }: { location: "ControlStation" | "Pad" }) {
  const root = `/EGSE/${location}/WifiAntenna`;
  const linkName = `EGSE/${location}/WifiAntenna`;
  const label = location === "ControlStation" ? "CONTROL STATION" : "PAD";
  const linkResult = useAtomValue(singleLinkSubscriptionAtom(linkName));
  const link = linkResult._tag === "Success" ? linkResult.value : undefined;

  if (linkResult._tag !== "Success" || link?.status !== "OK") {
    const status = linkResult._tag === "Failure" ? "ERROR" : (link?.status ?? "LOADING");
    return (
      <div className="network-topology__antenna grid grid-cols-[1fr_auto] gap-3 p-2">
        <span className="text-orange-text">{label} ANTENNA</span>
        <span className={status === "ERROR" ? "text-error" : "text-muted-foreground"}>
          {status}
        </span>
      </div>
    );
  }

  return (
    <div className="network-topology__antenna p-2">
      <div className="min-w-0">
        <div className="text-orange-text">{label} ANTENNA</div>
        <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <span className="text-muted-foreground">DEVICE</span>
          <TelemetryValue parameter={`${root}/DeviceInformation/device_name`} />
          <span className="text-muted-foreground">UPTIME</span>
          <TelemetryValue parameter={`${root}/DeviceInformation/uptime`} />
          <span className="text-muted-foreground">RSSI</span>
          <TelemetryValue
            parameter={`${root}/WirelessSignalQuality/signal_strength`}
            format={integer(" dB")}
          />
          <span className="text-muted-foreground">SNR</span>
          <TelemetryValue parameter={`${root}/WirelessSignalQuality/snr`} format={integer(" dB")} />
          <span className="text-muted-foreground">CHANNEL</span>
          <TelemetryValue parameter={`${root}/WirelessSettings/channel`} />
          <span className="text-muted-foreground">STATIONS</span>
          <TelemetryValue parameter={`${root}/RadioStatus/connected_stations`} format={fixed(0)} />
        </div>
      </div>
    </div>
  );
}

export function AntennasModule() {
  return (
    <section className="network-topology__antennas network-topology__module">
      <div className="network-topology__eyebrow">WIFI ANTENNAS</div>
      <div className="network-topology__antenna-grid network-topology__full-bleed grid gap-px">
        <Antenna location="ControlStation" />
        <Antenna location="Pad" />
      </div>
    </section>
  );
}
