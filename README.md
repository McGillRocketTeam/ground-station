<p align="center">
  <img width="595.5" height="101.25" src="assets/logo.svg" alt="McGill Rocket Team">
</p>

# Ground Station

Software for observing and controlling McGill Rocket Team rocket and electrical
ground-support equipment. It provides local telemetry monitoring, command
control, video, maps, simulation, and mission-data recording through Yamcs.

## Getting started

### Prerequisites

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and
start it before running Tilt. Use [mise](https://mise.jdx.dev/) as the preferred
version manager; the repository's `.tool-versions` defines the required Node.js,
pnpm, Java, Maven, and Tilt versions.

On macOS, install mise with Homebrew:

```bash
brew install mise
```

Then clone the repository and install the toolchain and dependencies:

```bash
git clone https://github.com/McGillRocketTeam/ground-station.git
cd ground-station
mise install
corepack enable
pnpm install
pnpm build
```

### Run locally with Tilt

Tilt orchestrates the local development environment. The default stack starts
the frontend, Yamcs backend, MQTT broker, offline map server, and shared
`yamcs-effect` package watcher. The frontend is available at
<http://localhost:5173> and Yamcs at <http://localhost:8090>.

```bash
# Core local stack
tilt up

# Core stack with simulated telemetry
tilt up -- --simulator

# Core stack with the media backend, media frontend, and MediaMTX
tilt up -- --media

# Full local development stack: core, simulator, and media
tilt up -- --simulator --media

# Core stack with the NetBird remote-network resource
tilt up -- --remote

# Use random simulator data instead of the default incremental data
tilt up -- --simulator --simulator_data_mode=random

# Connect to an existing MQTT broker instead of starting the local broker
tilt up -- --mqtt_broker_url=mqtt://broker.example:1883

# Include EcoFlow BLE-to-MQTT publishing
tilt up -- --ecoflow_mqtt --ecoflow_user_id=YOUR_USER_ID
```

The EcoFlow stack also accepts `--ecoflow_ble_address`, `--ecoflow_mqtt_host`,
and `--ecoflow_mqtt_port`. Use `--environment=development` or
`--environment=production` to choose the frontend environment; production is
the default. Stop the environment with `tilt down`.

For focused work without Tilt:

```bash
pnpm --filter @mrt/frontend dev
YAMCS_INSTANCE=launch-canada pnpm --filter @mrt/simulator dev
pnpm check-types
```

## Documentation

- [Architecture overview](docs/ARCHITECTURE.md): system responsibilities,
  deployment model, and design principles.
- [Ground-station hardware and backend details](docs/ground-station.md): field
  topology, equipment, and Yamcs links.
- [ASTRA protocol](docs/ASTRA.md): MQTT topics, telemetry, commands, and
  acknowledgements.
- [LabJack code walkthrough](docs/labjack-code-walkthrough.md) and
  [test reports](docs/test-reports/): device-specific implementation notes.
- [Contributor instructions](AGENTS.md): repository development conventions.

## License and upstream attribution

Copyright (c) 2026 McGill Rocket Team. Unless a component carries a different
notice, MRT-authored source code in this repository is available under the
permissive [MIT License](LICENSE). Distributions containing copies or substantial
portions of that code must retain the MRT copyright and license notice.

The `org.yamcs.mqtt` integration in [`apps/backend`](apps/backend) is an
exception. It contains modified source code derived from [Yamcs
MQTT](https://github.com/yamcs/yamcs-mqtt), developed by the Yamcs team and
contributors. That directory, including MRT's modifications and additions to
the derived integration, is distributed under the [GNU Affero General Public
License, version 3](apps/backend/LICENSE-AGPL-3.0) (`AGPL-3.0-only`). Its
corresponding source and revision history are available in this repository.

Building or distributing the backend together with the AGPL-covered integration
may subject the combined work to the AGPL. Third-party dependencies and vendored
components retain their own license terms and notices.
