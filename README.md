<p align="center">
    <img width="595.5" height="101.25" src="assets/logo.svg">
</p>

---

## 🚀 Overview

This monorepo contains the frontend applications and shared packages for the McGill Rocket Team's ground station system. It provides real-time telemetry monitoring, command control, and data visualization capabilities integrated with YAMCS (Yet Another Mission Control System).

## 📦 Repository Structure

### Applications (`apps/`)

#### **`@mrt/backend`** - YAMCS Data Server

This is the main server which handles receiving, processing and sending telemetry. It's the middle man between data sources and the frontend ui. It runs through the [YAMCS](https://yamcs.org/) framework.

#### **`@mrt/frontend`** - Main Ground Station UI

The application that users use to view live telemetry and issue commands. Comes with a configurable card ui and more.

#### **`@mrt/simulator`** - Telemetry Data Simulator

Generate random data for development of the frontend. Without the simulator, we would have no way of testing the frontend with data.

### Packages (`packages/`)

#### **`@mrt/yamcs-effect`** - YAMCS API Client Library

- **Purpose**: Type-safe [Effect-TS](https://effect.website/docs/quickstart) client for YAMCS
- **Features**:
  - HTTP API client for YAMCS REST endpoints
  - WebSocket client for real-time telemetry subscriptions
  - Comprehensive schema definitions for YAMCS data structures
  - Support for parameters, commands, links, and time events

#### **`@mrt/yamcs-atom`** - React State Management Layer

- **Purpose**: Reactive state management using [Effect Atom](https://github.com/tim-smart/effect-atom)
- **Features**:
  - Pre-configured atoms for YAMCS subscriptions (parameters, commands, links, time)
  - Automatic WebSocket connection management
  - Real-time data synchronization with React components
  - Error handling and retry logic

## 📋 Installation

Install the required tools:
- [Node.js](https://nodejs.org/en/download)
- [pnpm](https://pnpm.io/installation)
- [Java (JDK)](https://www.oracle.com/ca-en/java/technologies/downloads/)
- [Maven](https://maven.apache.org/)
- [Tilt](https://docs.tilt.dev/install.html)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

or if you're on MacOS, install with Homebrew
```bash
brew install node pnpm java maven tilt
brew install --cask docker-desktop
```
Then clone the repository and install the dependencies locally.
```bash
# Clone the repository
git clone https://github.com/McGillRocketTeam/ground-station
cd ground-station
# Install dependencies for all packages
pnpm install
# Build initial packages
pnpm build
```

## 🏃‍♂️ Running Everything with Tilt

**Tilt** orchestrates the entire development environment, including all Docker services and applications. **Ensure that Docker Desktop is running before you start Tilt.**

```bash
# Start all services and applications
tilt up
```

This will start:

- **Frontend dev server** (`http://localhost:5173`)
- **Simulator** with YAMCS instance="ground_station"
- **All Docker services**:
  - Backend (`ghcr.io/mcgillrocketteam/groundstation-backend-2026:main`)
  - MQTT broker (Eclipse Mosquitto, port 1883)
  - Map tile server (port 3001)

## 🔧 Individual Package Development

### Frontend Development

```bash
pnpm --filter @mrt/frontend dev
```

### Simulator (requires environment variable)

```bash
YAMCS_INSTANCE=ground_station pnpm --filter @mrt/simulator dev
```

### Type Checking

```bash
pnpm turbo run check-types
```

## 🏗️ Infrastructure Services

### Docker Compose Services

| Service          | Image                                                      | Ports                  | Purpose                                           |
| ---------------- | ---------------------------------------------------------- | ---------------------- | ------------------------------------------------- |
| **backend**      | `ghcr.io/mcgillrocketteam/groundstation-backend-2026:main` | 8090 (HTTP), 10015/UDP | Main backend API and telemetry ingestion          |
| **mqtt_broker**  | Eclipse Mosquitto                                          | 1883                   | Message queuing for communication                 |
| **mbtileserver** | Custom map server                                          | 3001 (internal 8000)   | Serves map tiles for ground station visualization |
