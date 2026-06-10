# ASTRA Protocol Overview

ASTRA stands for **Avionics Standard for Radios Telemetry Adoption**.

Within MRT, "ASTRA" is often used to mean the entire telemetry stack, not just a
single wire protocol. In practice, ASTRA describes how devices communicate over
MQTT, how topics are named, and how commands, telemetry, and status updates are
represented.

This document is meant to help a new developer understand how the system is laid
out today, including a few MRT-specific conventions and edge cases.

## The Big Picture

- Every device has a **base MQTT topic**.
- Each base topic has a small set of **well-known subtopics**.
- Devices publish their own status, detail, telemetry, and acknowledgements.
- Devices listen for commands on their command topic.
- In redundant deployments, `SystemA` and `SystemB` are treated as two fully
  independent systems.

All messages are exchanged over MQTT.

## Topic Structure

A device's base topic is built from:

1. **System**: `SystemA`, `SystemB`, or just `System`
2. **Physical location**: `Rocket`, `Pad`, `ControlStation`, etc.
3. **Component name**: `FlightComputer`, `Radio`, `Thermocouple`, etc.

Examples:

- `SystemA/ControlStation/Radio`
- `SystemB/Rocket/FlightComputer`
- `System/Testsite/Thermocouple`

After the base topic come the standard device subtopics.

## Standard Device Subtopics

Each device may expose the following subtopics:

- `/status`: device health as an enum: `DISABLED`, `OK`, `UNAVAIL`, or `FAILED`
- `/detail`: a short human-readable explanation of the current state
- `/telemetry`: a binary packet whose structure is agreed on ahead of time
- `/commands`: a single command string published by an external source
- `/acks`: acknowledgement messages indicating command handling progress

These are shown as suffixes here. A full MQTT topic is the base topic plus one
of these suffixes, for example `SystemA/ControlStation/Radio/status`.

In the general ASTRA model:

- The device **publishes** `status`, `detail`, `telemetry`, and `acks`
- The device **subscribes** to `commands`

## Example Topic Tree

This is what a typical broker layout looks like when both redundant systems are
present:

```text
SystemA/
  Rocket/
    FlightComputer/
      status
      detail
      telemetry
      commands
      acks
  Pad/
    Radio/
      status
      detail
      telemetry
      commands
      acks
  ControlStation/
    Radio/
      status
      detail
      telemetry
      commands
      acks

SystemB/
  Rocket/
    FlightComputer/
      status
      detail
      telemetry
      commands
      acks
  Pad/
    Radio/
      status
      detail
      telemetry
      commands
      acks
  ControlStation/
    Radio/
      status
      detail
      telemetry
      commands
      acks
```

## Current MRT Deployment Model

At both Launch Canada and URRG, we usually operate two redundant systems:

- `SystemA`
- `SystemB`

Each system contains:

- 1 flight computer
- 1 pad radio
- 1 control station radio

These two systems are **not merged together**. They are treated as separate,
independent telemetry paths.

For display and processing purposes:

- System A data stays in System A
- System B data stays in System B
- If both produce similar data, they are still kept separate

## Important Device Behavior: Radios vs Flight Computers

One of the easiest things to misunderstand is the relationship between radio
topics and flight computer topics.

Although the radio is the physical device that sends and receives LoRa traffic,
the MQTT topics still distinguish between:

- **radio telemetry**, which describes the radio itself
- **flight computer telemetry**, which describes the rocket avionics data being
  carried by the radio link

For example:

- `SystemA/Pad/Radio/telemetry` might contain radio-specific values such as RSSI
  or SNR
- `SystemA/Rocket/FlightComputer/telemetry` contains the rocket telemetry packet

So even when a radio is the device physically receiving the packet over LoRa, it
may publish data on behalf of another device's MQTT topic.

That distinction is intentional and important.

## How Commands Are Routed

Commands are published to the topic of the device they logically target, even if
another device physically forwards the command.

Examples:

- To command the rocket flight computer, publish to:
  `SystemA/Rocket/FlightComputer/commands`
- To command the ground-side radio itself, publish to:
  `SystemA/Pad/Radio/commands`

In other words:

- the **topic owner** is the logical target of the command
- the **radio** may still be the hardware that actually transmits that command

## Command Format

Commands are always sent as a **single string**.

One MQTT publish corresponds to one command.

The exact command string format depends on the device.

### Flight Computer Commands

Flight computer commands use this format:

```text
ID,CMD
```

Where:

- `ID` is an integer from `1` to `255`
- `CMD` is a three-letter command code

Example:

```text
1,LAU # launch command
2,LAU
```

These are two separate launch commands with different IDs. The IDs allow the
system to distinguish repeated commands of the same type and acknowledge them
individually.

## Ack Behavior

The `/acks` topic is used for command progress acknowledgements.

However, there is one important MRT-specific exception:

- for the **flight computer**, the final acknowledgement comes back inside the
  telemetry packet itself
- because of that, the flight computer's `/acks` topic is typically not used for
  the final FC acknowledgement

## Command Sending Sequence

The current command path works like this:

1. A command is issued from the ground station.
2. The ground backend publishes the command to both:
   - `SystemA/Rocket/FlightComputer/commands`
   - `SystemB/Rocket/FlightComputer/commands`
3. The **pad radio** is the device responsible for sending commands over LoRa.
   It sees the command on the MQTT topic, adds it to its internal queue, and
   immediately publishes an acknowledgement on:
   - `System#/Pad/Radio/acks`
4. That first acknowledgement has the form:

```json
{ "cmd_id": 123, "status": "RX_OK" }
```

This means the radio has received the command from MQTT, but has not yet sent it
over the air.

5. When the radio gets the appropriate CTS signal from the rocket, it transmits
   the command over LoRa and publishes another acknowledgement to the same radio
   `/acks` topic:

```json
{ "cmd_id": 123, "status": "TX_OK" }
```

6. The flight computer executes the command and eventually returns an `ack_id`
   in the telemetry packet header.

## Practical Example

If you are looking at MQTT Explorer and you see:

```text
SystemA/ControlStation/Radio/status   = OK
SystemA/ControlStation/Radio/detail   = Radio is idle and ready to transmit telemetry.
SystemA/ControlStation/Radio/commands = radio clear
```

that means:

- the simulator or real device is publishing its current health to `status`
- it is publishing a human-readable explanation to `detail`
- some external system has published the string command `radio clear` to the
  `commands` topic

## Summary

If you remember only a few things, remember these:

- ASTRA is MRT's MQTT-based telemetry and command topic structure
- every device gets a base topic plus standard subtopics
- `SystemA` and `SystemB` are separate redundant systems, not merged streams
- radio topics describe the radio itself, while flight computer topics describe
  the rocket avionics data
- commands are single strings published to the logical target's `/commands`
  topic
- acknowledgements usually go to `/acks`, except that flight computer command
  completion is currently reported in telemetry
