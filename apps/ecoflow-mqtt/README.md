# EcoFlow MQTT Bridge

Standalone Python app for publishing EcoFlow DELTA 2 Max BLE telemetry to the local MQTT broker.

The MQTT topic shape matches the working test from `ha-ef-ble`:

- `ecoflow/<serial>/availability`
- `ecoflow/<serial>/info`
- `ecoflow/<serial>/state`
- `ecoflow/<serial>/fields/<field_name>`

## Setup

```bash
cd apps/ecoflow-mqtt
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

## Run

```bash
.venv/bin/python ecoflow_delta2_max_mqtt.py \
  --user-id YOUR_ECOFLOW_USER_ID \
  --mqtt-host localhost \
  --mqtt-port 1883 \
  --address YOUR_BLE_ADDRESS
```

Use `--verbose` when debugging BLE connection/auth.

Keep the EcoFlow mobile app closed while running this bridge. The device may only allow one active BLE client.

## Run With Tilt

Enable the app in `tilt_config.json`:

```json
{
  "ecoflow_mqtt": true,
  "ecoflow_user_id": "YOUR_ECOFLOW_USER_ID",
  "ecoflow_ble_address": "YOUR_BLE_ADDRESS",
  "ecoflow_mqtt_host": "localhost",
  "ecoflow_mqtt_port": "1883"
}
```

Then run Tilt as usual. The `ecoflow-mqtt` resource depends on the local `mqtt_broker` resource unless an external `mqtt_broker_url` is configured.

The Tiltfile has separate commands for Windows and POSIX hosts:

- Windows uses `venv\\Scripts\\python`
- macOS/Linux use `venv/bin/python`

## Find The Device Address

```bash
.venv/bin/python ble_scan_debug.py --timeout 20
```

For a DELTA 2 Max, look for an advertisement like:

```text
name: EF-R350438
address: YOUR_BLE_ADDRESS
ecoflow_serial: R351...
```

## Find EcoFlow User ID

```bash
.venv/bin/python ecoflow_user_id.py
```

This prints the numeric user ID used by BLE authentication.

## Vendored Code

`vendor/ecoflow_ble` is derived from `rabits/ha-ef-ble`, licensed Apache-2.0. It is kept local so this app can run without Home Assistant.
