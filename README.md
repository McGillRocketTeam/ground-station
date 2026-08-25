<p align="center">
  <img width="595.5" height="101.25" src="assets/logo.svg" alt="McGill Rocket Team">
</p>

# Ground station

This repository contains the software used to observe and control the McGill
Rocket Team's rocket and electrical ground support equipment. It is one part of
a distributed system spread across the control station, launch pad, and rocket.

Operators need more than flight data on a screen. They need a coherent view of
the whole operation: avionics, pad equipment, communications, power, networking,
and video. If a device can tell us something useful about its state, we want that
information recorded and visible.

## The operating environment

A launch site is a poor place to depend on ideal conditions. The control station
and pad may be about a kilometre apart, Internet access may be absent, and no
single communications path should be assumed healthy. The system therefore runs
locally, carries its own maps and services, and treats degraded links as normal
operating conditions rather than exceptional ones.

The ground network joins the control station and pad over a point-to-point
wireless bridge. Separate radio links connect the ground to the rocket. Two
avionics systems preserve independent telemetry and command paths so a failure in
one does not silently contaminate the other.

## One operational picture

The system brings purpose-built MRT hardware and commercial off-the-shelf
equipment into one operational model. Team-built devices generally communicate
over MQTT using the team's custom ASTRA conventions. Commercial equipment keeps
its native interface, such as Bluetooth, a vendor API, a device driver, a serial
connection, or a video stream. Small adapters translate those interfaces into
telemetry the rest of the ground station can understand.

MQTT is the common message bus, not the definition of the system. Telemetry is
decoded, calibrated, checked, archived, and presented through a mission-control
backend, [Yamcs](https://yamcs.org/). Operator interfaces subscribe to live state
and issue commands through that same model. Video follows its own media path, but
remains part of the same operator experience.

Logical identity matters more than transport. Rocket telemetry belongs to the
flight computer even when a ground radio receives and republishes it. A command
targets the device that should act on it even when another device forwards it.
This keeps the operator's view stable while the route underneath it changes.

## The services

The operations computer runs a handful of services with distinct jobs. This is
not a collection of microservices for its own sake. Video transport, mission
data, hardware protocols, and operator displays have different failure modes, so
keeping those responsibilities separate makes the system easier to operate and
repair.

### MQTT broker

The local MQTT broker carries telemetry, device health, acknowledgements, and
commands. Most team-built devices speak MQTT directly through ASTRA. Bridges can
also publish on behalf of equipment that only speaks a vendor protocol. Producers
do not need to know which displays, recorders, or control systems are listening.

### Yamcs and the custom backend

[Yamcs](https://yamcs.org/) is the mission data system. It decodes packets,
converts raw measurements into engineering values, evaluates alarms, records
telemetry and events, keeps command history, and supports replay. It also gives
the operator applications one API for live and recorded data.

Our backend extends Yamcs with the links and mission definitions needed for MRT
hardware. Those integrations connect Yamcs to MQTT devices, radio paths, pad data
acquisition, the control box, and network equipment with vendor-specific
interfaces. This is where a mixed collection of hardware becomes a set of named
devices, parameters, and commands.

### Operator frontend

The custom frontend is the main workspace during testing and launch operations.
It builds task-specific dashboards on top of Yamcs rather than making each screen
talk to hardware directly. Operators can arrange live telemetry, plots, maps,
network state, events, procedures, command controls, command history, and camera
feeds around the job at hand. The same interface can inspect archived flights and
replayed telemetry after the live operation ends.

### Media stack

Video has different demands from packet telemetry, so it has a separate path.
MediaMTX accepts camera and external feeds, makes them available to browsers over
WebRTC, and can record them locally. This keeps the operator displays from having
to understand every camera protocol.

The media backend holds the shared state used to control what appears in a
production feed. The media frontend renders that state as telemetry, countdown,
procedure, mission notice, and flight-tracking overlays. Together they let a
stream show useful mission context without turning the main operator dashboard
into broadcast graphics.

### Offline maps

A local tile server provides the satellite maps used by the ground station and
recovery views. The team loads the relevant imagery before deployment, so maps
continue to work when the launch site has no Internet access.

### Device bridges

Some useful telemetry is trapped behind an interface that the rest of the system
should not need to understand. The EcoFlow bridge, for example, reads the
control-station battery over Bluetooth and republishes its state on MQTT. Similar
adapters can be added for commercial hardware without teaching every downstream
service about another vendor protocol.

### Simulation and mission definitions

The repository also contains tools that do not run as part of the production
stack. Simulators stand in for flight computers and ground equipment while using
the real telemetry and command paths. Mission-definition tools turn shared
parameter and packet descriptions into the formats Yamcs uses. These tools keep
testing close to the deployed system and reduce the chance that firmware, backend,
and frontend disagree about the data on the wire.

## What is connected

The ground station brings together several kinds of equipment:

- The rocket flight computers and their independent avionics systems.
- Ground radios at both the control station and pad, which carry rocket traffic
  and report the health of the radio links themselves.
- A physical control box for launch, emergency, arming, and pad controls.
- Pad data acquisition and control hardware for sensors, actuators, and analog
  measurements (LabJack T7).
- A team-built thermocouple unit for pad temperature measurements.
- Cameras around the pad, plus optional external feeds such as a drone, for
  watching mechanisms, panels, gauges, and the launch area.
- The control-station battery, including charge, load, and remaining capacity.
- The router, managed PoE switches, and point-to-point wireless bridge that make
  up the field network.
- Independent recovery or tracking equipment when it is present in the mission
  setup.

This inventory will change as the vehicle and ground equipment change. The guiding
rule does not: infrastructure is operational equipment.

## Design principles

### Telemetry by default

Anything that can expose useful state should do so. Values alone are not enough.
Operators also need timestamps, health, connection state, and a short explanation
when a device is unavailable or failed.

### Preserve independent evidence

Redundant systems remain separate through ingestion, display, recording, and
command handling. The ground station may show them together, but it does not blur
them into a synthetic source that hides disagreement.

### Record what operators saw

Telemetry, alarms, events, and command history are archived for replay. This
supports post-flight analysis, but it is equally useful before launch: recorded
runs make procedures, displays, alarms, and recovery tools testable without live
hardware.

### Make the real system testable

Simulators should speak the same protocols and exercise the same command paths as
real devices. Development against a convenient mock is not enough if it bypasses
the failure modes found in the field. Replays and simulations let the team test
loss, delay, stale data, conflicting redundant sources, and incomplete flights.

### Work without the cloud

Core operations must continue on the local network. Telemetry transport, command
handling, maps, video, archives, and operator interfaces should not require an
Internet connection once the system is deployed.

### Treat commands differently from telemetry

Telemetry can be frequent and lossy. Commands represent operator intent and need
clear routing, acknowledgement, history, and visible failure. Software controls
complement physical controls and safety procedures; they do not replace them.

## The shape of the system

At a high level, information moves inward from devices and commands move outward
from operators:

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

The implementation has several applications and packages because the deployed
system has several jobs. Those boundaries are less important than the contract
between them: every device has an identity, every useful state has a timestamp,
every command has a destination, and operators can tell when any part of that
chain stops working.
