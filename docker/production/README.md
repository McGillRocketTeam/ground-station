# Production stack

This Compose project builds and runs production artifacts for the MRT frontend, Yamcs backend,
media frontend, and media backend. It also runs MQTT, MBTileserver, and MediaMTX. Development-only
resources such as Tilt, Vite dev servers, the simulator, XTCE generation, and package watchers are
not included.

## Run

```sh
cd docker/production
cp .env.example .env
docker compose up -d --build
```

The main frontend is available at `http://localhost:5173`, and the media frontend is available at
`http://localhost:5174`. The main frontend proxies the MediaMTX API and WHEP signaling through its
own origin, so clients do not need direct access to ports `9997` or `8889`. For camera playback from
another machine, set `MEDIAMTX_WEBRTC_ADDITIONAL_HOSTS` to a browser-reachable server IP or DNS name
and allow MediaMTX's ICE transport port `8189` over both TCP and UDP.

Map files are read from `docker/assets/maps`. Media recordings and Yamcs/MQTT data use named Docker
volumes so `docker compose down` does not remove them.

## EcoFlow BLE

The EcoFlow bridge is opt-in because Docker Desktop cannot provide Linux Bluetooth and host D-Bus
access. On a Linux host, set `ECOFLOW_USER_ID` and run:

```sh
docker compose --profile ecoflow up -d --build
```

If needed, add `--address <BLE_ADDRESS>` to the service command in `compose.yml`.
