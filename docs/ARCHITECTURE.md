# Ground Station Architecture

The ground station observes and controls McGill Rocket Team's rocket and
electrical ground-support equipment. It is one part of a distributed system
across the control station, launch pad, and rocket. This document describes the
software architecture and the operational constraints that shape it.

For the physical deployment, equipment inventory, and detailed Yamcs links, see
[ground-station.md](ground-station.md). For the MQTT conventions shared by MRT
devices, see [ASTRA.md](ASTRA.md).

## Operating environment

The control station and pad can be about a kilometre apart without Internet
access. The system runs on the local network, provides its own maps and
services, and treats unavailable or degraded links as normal operating
conditions. A point-to-point wireless bridge joins the ground networks, while
separate radio links carry the redundant avionics systems.

## System model

Team-built devices generally communicate over MQTT using ASTRA conventions.
Commercial equipment retains its native interface, such as Bluetooth, a vendor
API, a device driver, serial connection, or video stream. Device bridges adapt
those interfaces into telemetry the rest of the ground station can consume.

MQTT is the common message bus. Yamcs decodes, calibrates, checks, archives, and
serves telemetry, events, and commands to operator applications. Video follows
a separate media path while remaining part of the same operator experience.

Logical identity is independent of transport: rocket telemetry belongs to the
flight computer even when a radio receives and republishes it, and commands
target the device that should act even when another device forwards them.

```text
rocket and ground equipment
        | telemetry, status, video
        v
device protocols and adapters
        |
        v
local message, mission-control, and media services
        |
        v
operator displays, alarms, archives, and replay

operator command -> mission-control model -> target device or forwarding path
```

## Services

### MQTT broker

The local broker carries telemetry, health, acknowledgements, and commands.
ASTRA-capable devices connect directly; bridges publish for equipment with
vendor-specific interfaces. Producers do not need to know which displays,
recorders, or control systems consume their data.

### Yamcs and custom backend

[Yamcs](https://yamcs.org/) is the mission-data system. It converts raw values
to engineering values, evaluates alarms, records telemetry and events, keeps
command history, and supports replay. The custom backend provides the MRT
mission definitions and links for MQTT devices, radios, pad data acquisition,
the control box, and network equipment.

### Operator frontend

The frontend builds task-specific dashboards on Yamcs rather than communicating
with hardware directly. It supports live telemetry, plots, maps, network state,
events, procedures, command controls, command history, and camera feeds. It can
also inspect archives and replayed telemetry.

### Media stack

MediaMTX accepts camera and external feeds, makes them browser-accessible over
WebRTC, and can record locally. The media backend maintains production-feed
state; the media frontend renders telemetry, countdown, procedure, mission
notice, and flight-tracking overlays.

### Offline maps and device bridges

A local tile server provides preloaded satellite imagery when the deployment has
no Internet connection. Bridges, such as the EcoFlow Bluetooth-to-MQTT adapter,
integrate commercial equipment without requiring downstream services to know
its vendor protocol.

### Simulation and mission definitions

Simulators use the deployed telemetry and command paths to stand in for flight
computers and ground equipment. Mission-definition tools generate Yamcs formats
from shared parameter and packet descriptions. Together, they keep testing close
to field behavior and reduce disagreement between firmware, backend, and UI.

## Connected equipment

The system integrates flight computers, ground radios, a physical control box,
LabJack pad data acquisition, thermocouple hardware, cameras, the EcoFlow
control-station battery, and network infrastructure such as routers, PoE
switches, and the wireless bridge. Independent recovery and tracking equipment
can be included when a mission requires it. See
[ground-station.md](ground-station.md) for the current field inventory.

## Design principles

### Telemetry by default

Useful state includes values, timestamps, health, connection state, and a brief
explanation when a device is unavailable or failed.

### Preserve independent evidence

Redundant systems remain separate through ingestion, display, recording, and
command handling. The system may show them together, but does not merge them in
a way that hides disagreement.

### Record what operators saw

Telemetry, alarms, events, and command history are archived for replay. This
supports post-flight analysis and makes procedures, displays, alarms, and
recovery tools testable before deployment.

### Make the real system testable

Simulators should use the real protocols and command paths. Replays and
simulation exercise loss, delay, stale data, conflicting redundant sources, and
incomplete flights.

### Work without the cloud

Telemetry transport, command handling, maps, video, archives, and operator
interfaces must continue on the local network without Internet access.

### Treat commands differently from telemetry

Telemetry can be frequent and lossy. Commands represent operator intent and
need clear routing, acknowledgement, history, and visible failure. Software
controls complement rather than replace physical controls and safety procedures.
