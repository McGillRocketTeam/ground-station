# Ground-station glossary

Names in this glossary refer to their role in this ground station, not to
general software concepts. For system relationships, see the
[architecture overview](ARCHITECTURE.md); for file locations, see the
[repository map](../README.md#repository-map).

## Mission and equipment

- **Control station** — the operator site hosting the main operations computer,
  controls, and ground-side radios. The **pad** or **launch pad** is the separate
  site near the rocket. See the [physical layout](ground-station.md#physical-layout).
- **Pad Box** — the weatherproof enclosure at the pad that houses equipment for
  filling, arming, and launch. See [Pad Box devices](ground-station.md#pad-box-devices).
- **EGSE** — electrical ground-support equipment, named under `EGSE` in the
  Yamcs mission database; it includes pad and control-station equipment.
- **Control Box** — the team's physical switch, key-switch, and push-button
  controller at the control station. Its backend link maps inputs to LabJack
  outputs or flight-computer commands. See the
  [Control Box description](ground-station.md#control-station) and
  [link behavior](ground-station.md#control-box-link).
- **Flight computer** — rocket avionics whose telemetry and commands retain
  their own identity even when a radio relays them. See
  [ASTRA's radio/flight-computer distinction](ASTRA.md#important-device-behavior-radios-vs-flight-computers).
- **System A / System B** (`SystemA` / `SystemB`) — two independent avionics
  systems, each with its own flight computer and radio path. See
  [ASTRA's deployment model](ASTRA.md#current-mrt-deployment-model).
- **ASTRA** — the team's name for its telemetry and command conventions. The
  name is also used for the rocket–ground packet format; this repo's
  [ASTRA protocol overview](ASTRA.md) details the MQTT-side conventions.

## Mission data and communication

- **Yamcs** — the mission-data system used here to ingest, process, archive,
  replay, and serve telemetry and commands to the operator GUI. See
  [Yamcs and the custom backend](ARCHITECTURE.md#yamcs-and-custom-backend).
- **Yamcs instance** — a named mission configuration served by Yamcs, such as
  `launch-canada`; the GUI asks the operator to select one before opening its
  pages. See the [instance configurations](../apps/backend/src/main/yamcs/etc/).
- **Yamcs link** — a backend integration that connects a device or its protocol
  to Yamcs, such as the LabJack or Control Box link. See
  [backend link pattern](ground-station.md#backend-link-pattern).
- **MDB (mission database)** — the Yamcs definitions of parameters, commands,
  and packet containers for the equipment in this deployment. The files live
  in the [backend MDB directory](../apps/backend/src/main/yamcs/mdb/); see the
  [backend architecture](ground-station.md#custom-backend-architecture).
- **XTCE** — the XML format used for mission-database definitions; the
  `apps/xtce-generator/` tool generates flight-computer definitions. See
  [flight-computer telemetry links](ground-station.md#flight-computer-telemetry-links).
- **MQTT** — the messaging protocol carrying device telemetry, status,
  acknowledgements, and commands on the ground network. See the
  [ASTRA topic structure](ASTRA.md#topic-structure) for this project's usage.
- **Mosquitto** — the MQTT broker run by the local stack. See
  [hosted services](ground-station.md#hosted-services-on-the-mini-pc).
- **ASTRA device topic** — a device's base MQTT topic, such as
  `SystemA/Pad/Radio`, with `/telemetry`, `/status`, `/detail`, `/commands`, and
  `/acks` subtopics. See [standard device subtopics](ASTRA.md#standard-device-subtopics).
- **Yamcs MQTT integration** — the backend's MQTT-facing Yamcs link code;
  it is distinct from the Mosquitto broker. See the
  [backend link pattern](ground-station.md#backend-link-pattern).

## Hardware and integrations

- **LabJack T7** — the pad's data-acquisition and digital-output device,
  connected to Yamcs by a custom link. **LJM** is the LabJack driver library
  used by that link. See the [LabJack walkthrough](labjack-code-walkthrough.md).
- **Thermocouple Board** — the team's Teensy-based pad device publishing
  thermocouple readings over MQTT. See the
  [Thermocouple link](ground-station.md#thermocouple-link).
- **Teensy 4.1** — the board used in the team's Control Box, thermocouple
  device, and ground radios. See [equipment](ground-station.md#physical-layout).
- **Pad radio / control-station radio** — the radio units on opposite ends of
  each avionics path. **LoRa** is the radio path to the rocket; the radios also
  exchange ground-side data via MQTT. See
  [flight-computer telemetry links](ground-station.md#flight-computer-telemetry-links).
- **EcoFlow DELTA 2 Max** — the control station's battery. The optional
  **EcoFlow BLE-to-MQTT bridge** reads its local Bluetooth metrics and publishes
  them for Yamcs. See the [EcoFlow integration](ground-station.md#ecoflow-ble-metric-script).
- **Featherweight Ground Station V2** — a serial telemetry source with a Yamcs
  link configured disabled at startup in the
  [`launch-canada` instance](../apps/backend/src/main/yamcs/etc/yamcs.launch-canada.yaml).
- **Omada** — the network-management system queried by Yamcs links for the
  **Omada switches** and **BeamBridge**, the control-station–pad wireless
  bridge, in the
  [`launch-canada` configuration](../apps/backend/src/main/yamcs/etc/yamcs.launch-canada.yaml).
- **GL.iNet GL-SFT1200** — the control-station Wi-Fi router, monitored by a
  Yamcs link. See the [control-station layout](ground-station.md#control-station).
- **ToughSwitch** — a managed pad switch described in the
  [equipment notes](ground-station.md#toughswitch-link); its link is commented
  out in the current
  [`launch-canada` configuration](../apps/backend/src/main/yamcs/etc/yamcs.launch-canada.yaml).

## Media, maps, and remote access

- **MediaMTX** — the service that accepts camera feeds and makes them
  browser-accessible for the GUIs; see the [media stack](ARCHITECTURE.md#media-stack).
- **UniFi Video** — the legacy camera application described as a source of
  pad-camera streams for MediaMTX in the
  [equipment notes](ground-station.md#mediamtx).
- **MBTileserver** — the local map-tile service serving preloaded imagery when
  the ground station is offline. See [offline maps](ARCHITECTURE.md#offline-maps-and-device-bridges).
- **NetBird** — the optional remote-network resource enabled by Tilt's
  `--remote` flag; see [local startup](../README.md#run-locally-with-tilt).

## Applications in this repository

- **Operator frontend** (`apps/frontend/`) — the primary dashboard and other
  operator pages. **Yamcs backend** (`apps/backend/`) — Yamcs configuration and
  custom device links. See the [repository map](../README.md#repository-map).
- **Media frontend / overlays** (`apps/media-frontend/`) — browser-rendered
  production overlays. **Media backend** (`apps/media-backend/`) — production-feed
  state service. See the [media stack](ARCHITECTURE.md#media-stack).
- **Simulator** (`apps/simulator/`) — simulated telemetry through the deployed
  paths. **Ops simulator** (`apps/ops-simulator/`) — ground-operations simulation.
  See [simulation and mission definitions](ARCHITECTURE.md#simulation-and-mission-definitions).
- **XTCE generator** (`apps/xtce-generator/`) — generates Yamcs mission
  definitions from shared descriptions. See the [repository map](../README.md#repository-map).
