# McGill Rocket Team Ground Station

## Purpose

This document captures the McGill Rocket Team ground station setup based only on information provided in conversation.

## Scope

This document will be expanded incrementally to describe:

- Physical network topology
- Devices and hardware
- Software components
- Control and operating procedures
- Interfaces between subsystems
- Known constraints, failure modes, and operational notes

## Source Of Information

All content in this document is derived from direct conversation and should not include assumptions beyond what has been explicitly stated.

## System Overview

The McGill Rocket Team ground station is typically deployed as two physically separated areas:

- A control station
- A launch pad, referred to as the pad

The team can operate anywhere, but the usual setup places the control station and pad approximately 1 km apart. The two sides may not always have direct visual line of sight.

Each side has its own LAN. The two LANs are connected by a TP-Link 5 GHz AC867 WiFi antenna link. The WiFi antennas are mounted on telescopic poles.

There are two WiFi antennas total:

- One antenna at the control station configured as the access point
- One antenna at the launch pad configured as the client

## Physical Layout

### Control Station

The control station side contains the following network infrastructure:

- A GL.iNet GL-SFT1200 portable WiFi travel router, referred to as the main WiFi router
- An 8-port PoE network switch

The control station also contains one main operations computer:

- A GMKtec K12 Mini PC with an AMD Ryzen 7 H 255 and 64 GB of RAM

The main operations computer is connected to the control-station network switch over Ethernet.

There is also another desktop PC at the control station. It does not host services, but it connects to the frontend hosted on the main operations computer and serves as an additional workstation during operations.

Display hardware currently identified at the control station:

- Two monitors connected to the GMKtec K12 Mini PC
- Two monitors connected to the secondary desktop PC

The control station also includes another set of radios, one for each avionics band.

These control-station-side radios are connected by Ethernet and are powered using PoE splitters at the device end.

The control-station radios are Teensy 4.1 based.

Another control-station-side device is a Teensy 4.1-based unit referred to as the Control Box.

The Control Box is connected by Ethernet and is powered using a PoE splitter at the device end.

The Control Box communicates over MQTT.

The Control Box is connected to the following physical controls:

- Several ON/OFF switches
- One 2-position key switch
- Two resettable push buttons

The two resettable push buttons are:

- Emergency stop
- Launch

The control station power source is an EcoFlow DELTA 2 Max battery.

This battery acts as the power source for the entire control station and can be topped up with a generator.

The EcoFlow battery is also connected to two solar panels. No further details about the solar panels are currently documented.

### Launch Pad

The launch pad side contains a weatherproof enclosure called the Pad Box.

The Pad Box houses electronics necessary to support:

- Filling
- Arming
- Launch of the rocket

The launch pad side contains two network switches inside the Pad Box.

## Network Topology

The control station LAN and the pad LAN are bridged using a TP-Link 5 GHz AC867 WiFi antenna link.

On the pad side, multiple devices inside or associated with the Pad Box are wired over Ethernet.

## Pad Box Devices

The following devices are currently identified as connected on the pad-side Ethernet network:

- A LabJack T7
- A custom Teensy 4.1 board capable of reading thermocouple sensors, referred to as the Thermocouple Board
- Two Teensy 4.1 radio units developed by the McGill Rocket Team
- Three PoE cameras mounted around the pad area

The exact hardware model of the WiFi antennas is not considered important for this document at this stage.

## Redundant Avionics Systems

The radio architecture is part of an overarching design based on two redundant avionics systems:

- System A operates in the 433 MHz band
- System B operates in the 903 MHz band

There is one radio for each system at the launch pad and one corresponding radio for each system at the control station.

The radio units on both sides are Teensy 4.1 based.

The two Teensy 4.1 radio units on the pad side correspond to these redundant systems.

The two radio units are physically mounted outside the Pad Box and are connected back to the pad-side Ethernet network.

The radio units are powered using PoE with a splitter that extracts power to micro-USB at the device side.

## Pad Monitoring Cameras

There are three PoE cameras mounted around the launch area.

These cameras are not used only for spectating. They are part of the operational monitoring setup and are used to observe physical controls and indicators related to the rocket and pad systems.

Examples of stated uses include:

- Monitoring the fill disconnect system
- Monitoring the fill panel
- Pointing at analog gauges in case of an electronics error

## Device Communications

The radios and the Thermocouple Board communicate back to the control station via MQTT.

MQTT is described as a common pattern among team-made devices.

For the Teensy 4.1-based devices discussed so far, the custom MQTT protocol can be referred to as `ASTRA`.

The term `ASTRA` is used in two different ways:

- The actual packet format between the rocket and the ground
- The MQTT topic structure used by ground-station-connected devices

The over-the-air ASTRA packet between the rocket and the ground is a variable-length packet structure with a header.

That packet format is out of scope for this document.

The exact protocol details are not yet documented in this section and will be added later.

## Control Station Compute Role

The GMKtec K12 Mini PC is responsible for:

- Running all custom server software
- Hosting the frontend used for viewing data and live operations
- Performing additional tasks that will be described later

The secondary desktop PC does not host services. It consumes the frontend hosted on the main operations computer and serves as another operator workstation during operations.

## Hosted Services On The Mini PC

The GMKtec K12 Mini PC hosts a mixture of Dockerized services, custom applications, and utility scripts.

### Docker Containers

The following services run in Docker containers:

- `mbtileserver`
- MQTT broker using `mosquitto`
- `mediamtx`

#### mbtileserver

`mbtileserver` distributes high-resolution satellite imagery for a given location.

This is used because the team usually does not have Internet access during operations and still needs to render map tiles.

The tiles are downloaded onto the Mini PC beforehand.

#### MQTT Broker

The Mini PC hosts an MQTT broker using `mosquitto`.

MQTT is a common communication pattern among team-made devices.

#### MediaMTX

`mediamtx` is used for reading camera streams from the UniFi Video application.

The team is using the legacy UniFi Video application rather than the newer UniFi Protect platform.

The pad cameras are able to be used with UniFi software in general, but without UniFi hardware the team cannot run a better UniFi Video application.

UniFi Video runs on the Mini PC.

`mediamtx` allows the system to take the RTSP stream from UniFi Video and stream it to the custom frontend using WebRTC.

`mediamtx` is also used to accept external camera feeds, for example from a DJI drone when that is used.

### Custom Applications And Scripts

The following additional software is hosted directly on the Mini PC:

- A custom frontend built with Vite and React
- A custom backend built with Yamcs and custom Java code
- A script that reads BLE metrics from the EcoFlow battery and publishes them on MQTT

#### EcoFlow BLE Metric Script

The EcoFlow battery only allows a local, non-cloud Bluetooth connection in offline environments.

Because of this, the Mini PC uses its own Bluetooth interface to read battery metrics.

Those battery metrics are then published onto MQTT by the script.

#### Frontend Hosting

The frontend runs as a JavaScript build directly from the `dist` folder.

Everything is managed with Tilt on the frontend.

## Documentation Structure

This document should describe all software hosted on the Mini PC before going into the internal details of the custom backend, how the backend reads from specific devices, and how the frontend works.

The next major section should cover the custom backend architecture, which also overlaps with MQTT usage.

## Custom Backend Architecture

The main backend process is a Java server run using the Yamcs Maven plugin.

The backend is structured around a number of Yamcs links. These links are the main integration points between Yamcs and the physical devices or device-facing protocols used by the ground station.

At a high level, Yamcs is responsible for:

- Reading telemetry from all devices in the system
- Issuing commands back to those devices
- Acting as a common API for the frontend to control any device in the system

The custom code is implemented as Java link implementations inside Yamcs.

### Backend Link Pattern

The backend includes a reusable MQTT-based link layer built around the team's custom MQTT protocol.

For the Teensy 4.1-based devices discussed so far, this protocol is referred to as `ASTRA`.

Some Teensy-based devices support commands and some do not.

### ASTRA MQTT Topic Structure

For the MQTT-side usage of ASTRA, the base topic is the qualified name of the Yamcs link.

An example base topic is:

- `/SystemA/Pad/Radio`

Subtopics are then appended under that base topic.

The currently described subtopics are:

- `/telemetry` for the main telemetry of the device
- `/status` for device status values such as `OK`, `NOK`, `FAILED`, or `DISABLED`
- `/detail` for a longer device status description of one to two sentences
- `/commands` for device-specific commands, usually represented in a string form the device can read
- `/acks` for acknowledgements corresponding to commands

The `/status` values map to the Yamcs status enum.

The exact MQTT protocol format is documented separately and is not yet described in this section.

In addition to the reusable MQTT link behavior, the backend includes device-specific Java links for systems that need custom integration logic.

### Flight Computer Telemetry Links

The flight computer links read telemetry packets from all four radios over MQTT.

The radio path is:

- The rocket communicates with the radios over LoRa
- The radios publish telemetry onto MQTT
- The backend consumes that telemetry from MQTT through Yamcs links

The radios also publish their own telemetry and status information.

All radio telemetry is published by the radio itself.

Examples of radio-published data include:

- Whether TX mode is enabled
- RSSI
- SNR
- Temperature

For command transmission toward the rocket, only one radio per frequency is responsible for transmitting. This is done to avoid ordering problems.

Packets are timestamped when they arrive at the backend.

For radio-originated telemetry handling:

- The last packet per frequency wins for radios
- Each packet has a sequence number
- If a packet sequence number is lower than the current one, the packet is dropped
- If two packets have the same sequence number, the latest one wins

For many parameters, the backend receives a raw value and then applies a calculation or calibration to produce an engineering value.

Packet definitions are described by XTCE XML.

### Flight Computer Command Path

When sending a command to the rocket, the backend sends the command to both frequencies.

Within each frequency, exactly one radio is intended to transmit to the rocket.

The radio selected to transmit is controlled by whether TX mode is enabled on that radio.

All radios with TX enabled will forward the command to the rocket.

### Device-Specific Yamcs Links

The backend includes several custom Yamcs link implementations.

#### Reusable MQTT Link

The backend includes a reusable MQTT link that subscribes to topics according to the team's custom MQTT protocol.

#### LabJack Link

The LabJack link uses the LJM driver library from Java to read from and write to the LabJack device.

This link is used for LabJack digital write control in cases where Control Box switch inputs are mapped to LabJack outputs.

#### Control Box Link

The Control Box link is responsible for taking switch-number inputs from the Control Box and mapping them to commands in the system.

Those mappings can target either:

- LabJack digital write pins
- Flight computer commands sent via the radio path

This allows the switch-to-command mapping to be changed in software.

#### WiFi Antenna Links

The backend includes links for the WiFi antennas.

These links access the antenna management portal websites on the local network and scrape telemetry and status information from them.

Examples of scraped data include:

- RSSI
- SNR
- Connected devices
- Approximate range

#### ToughSwitch Link

The ToughSwitch is a managed network switch located in the Pad Box.

Its information is scraped in a similar way to the WiFi antennas.

Its currently described role in the backend is monitoring and telemetry collection through that management interface.

#### Thermocouple Link

The Thermocouple Board lives in the Pad Box and is connected by Ethernet.

It communicates using the same MQTT protocol pattern as the other Teensy 4.1-based devices, referred to here as `ASTRA`.

The Thermocouple Board publishes thermocouple readings for up to five sensors.

#### EcoFlow Link

The EcoFlow battery is integrated through a generic link, using the battery telemetry that is read on the Mini PC and published onto MQTT.

### Backend Scope In Yamcs

The current set of explained Yamcs responsibilities includes:

- Flight computer telemetry ingestion through four radios
- Radio telemetry ingestion
- LabJack integration
- Control Box switch-to-command mapping
- WiFi antenna status scraping
- ToughSwitch status scraping
- Thermocouple telemetry integration
- EcoFlow battery telemetry integration
- System-wide command distribution through Yamcs

### Standard Yamcs Services Used In Operations

In addition to the custom links, the backend uses standard Yamcs services during operations.

These are not described as custom McGill-specific implementations, but they are part of the deployed backend.

The currently identified services include:

- Telemetry recording
- Parameter recording
- Alarm recording
- Event recording
- Replay support
- System parameter collection
- Processor creation for realtime processing
- Command history recording
- Parameter archive support
- Timeline service support
