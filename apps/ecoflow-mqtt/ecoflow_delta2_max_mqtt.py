#!/usr/bin/env python3

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any

import paho.mqtt.client as mqtt
from bleak import BleakScanner


APP_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(APP_DIR / "vendor"))

import ecoflow_ble  # noqa: E402
from ecoflow_ble.connection import Connection  # noqa: E402
from ecoflow_ble.devices.delta2_max import Device as Delta2MaxDevice  # noqa: E402


LOGGER = logging.getLogger("ecoflow_delta2_max_mqtt")


def _serialize_value(value: Any) -> Any:
    if hasattr(value, "value"):
        return value.value
    if isinstance(value, bytes):
        return value.hex()
    if isinstance(value, dict):
        return {str(key): _serialize_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_serialize_value(item) for item in value]
    return value


class MqttPublisher:
    def __init__(self, args: argparse.Namespace) -> None:
        self._args = args
        client_id = args.mqtt_client_id or f"ecoflow-delta2max-{args.user_id}"
        self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)

        if args.mqtt_username:
            self._client.username_pw_set(args.mqtt_username, args.mqtt_password)

        self._client.enable_logger(LOGGER.getChild("mqtt"))

        base_topic = args.base_topic.rstrip("/")
        self._client.will_set(
            f"{base_topic}/status",
            payload="NOK",
            qos=1,
            retain=args.retain,
        )

    def connect(self) -> None:
        self._client.connect(
            host=self._args.mqtt_host,
            port=self._args.mqtt_port,
            keepalive=self._args.mqtt_keepalive,
        )
        self._client.loop_start()

    def disconnect(self) -> None:
        self._client.loop_stop()
        self._client.disconnect()

    def publish(self, topic: str, payload: Any, *, retain: bool | None = None) -> None:
        serialized = payload if isinstance(payload, str) else json.dumps(payload)
        message = self._client.publish(
            topic,
            payload=serialized,
            qos=1,
            retain=self._args.retain if retain is None else retain,
        )
        message.wait_for_publish()


class DeviceTopicPublisher:
    def __init__(self, device: Any, mqtt_publisher: MqttPublisher, base_topic: str) -> None:
        self._device = device
        self._mqtt = mqtt_publisher
        self._base_topic = base_topic.rstrip("/")
        self._snapshot_pending = False
        self._pending_tasks: set[asyncio.Task[None]] = set()
        self._loop = asyncio.get_running_loop()

    @property
    def topic_root(self) -> str:
        return self._base_topic

    def attach(self) -> None:
        for field in self._device._fields:
            self._device.register_state_update_callback(
                self._field_callback(field.public_name),
                field.public_name,
            )

    def publish_status(self, status: str, detail: str) -> None:
        self._mqtt.publish(f"{self.topic_root}/status", status)
        self._mqtt.publish(f"{self.topic_root}/detail", detail)

    def publish_telemetry(self) -> None:
        self._mqtt.publish(f"{self.topic_root}/telemetry", self.snapshot())

    def publish_offline(self) -> None:
        self.publish_status(
            "NOK",
            "EcoFlow DELTA 2 Max is disconnected. The publisher will keep scanning and reconnect when the device is available.",
        )

    def snapshot(self) -> dict[str, Any]:
        return {
            field.public_name: _serialize_value(getattr(self._device, field.public_name))
            for field in self._device._fields
            if getattr(self._device, field.public_name) is not None
        }

    def _field_callback(self, _field_name: str):
        def callback(_value: Any) -> None:
            self._schedule_snapshot_publish()

        return callback

    def _schedule_snapshot_publish(self) -> None:
        if self._snapshot_pending:
            return

        self._snapshot_pending = True
        self._loop.call_soon(self._create_snapshot_task)

    def _create_snapshot_task(self) -> None:
        self._snapshot_pending = False
        task = self._loop.create_task(self._publish_telemetry_async())
        self._pending_tasks.add(task)
        task.add_done_callback(self._pending_tasks.discard)

    async def _publish_telemetry_async(self) -> None:
        self.publish_telemetry()


def publish_status(mqtt_publisher: MqttPublisher, base_topic: str, status: str, detail: str) -> None:
    topic_root = base_topic.rstrip("/")
    mqtt_publisher.publish(f"{topic_root}/status", status)
    mqtt_publisher.publish(f"{topic_root}/detail", detail)


async def discover_delta2_max(address: str | None, scan_timeout: float) -> Any:
    LOGGER.info("Scanning for EcoFlow DELTA 2 Max")
    discoveries = await BleakScanner.discover(timeout=scan_timeout, return_adv=True)

    for ble_device, advertisement in discoveries.values():
        if address is not None and ble_device.address.lower() != address.lower():
            continue

        device = ecoflow_ble.NewDevice(ble_device, advertisement)
        if isinstance(device, Delta2MaxDevice):
            LOGGER.info(
                "Found %s at %s (%s)",
                device.device,
                device.address,
                device.serial_number,
            )
            return device

    if address is not None:
        raise RuntimeError(f"No DELTA 2 Max advertisement found for address {address}")
    raise RuntimeError("No EcoFlow DELTA 2 Max found during BLE scan")


async def run(args: argparse.Namespace) -> None:
    mqtt_publisher = MqttPublisher(args)
    mqtt_publisher.connect()

    try:
        while True:
            device = None
            topic_publisher = None
            disconnected = asyncio.Event()

            try:
                publish_status(
                    mqtt_publisher,
                    args.base_topic,
                    "NOK",
                    "Looking for EcoFlow DELTA 2 Max over BLE. MQTT is connected, but the device is not connected yet.",
                )
                device = await discover_delta2_max(args.address, args.scan_timeout)

                def on_disconnect(_exc: Exception | type[Exception] | None) -> None:
                    disconnected.set()

                device.on_disconnect(on_disconnect)
                device.with_disabled_reconnect().with_connection_options(
                    Connection.Options(timeout=args.connect_timeout)
                )

                await device.connect(user_id=args.user_id)
                state = await asyncio.wait_for(
                    device.wait_until_authenticated_or_error(raise_on_error=True),
                    timeout=args.connect_timeout,
                )
                if not state.authenticated:
                    raise RuntimeError(f"Unexpected connection state: {state}")

                topic_publisher = DeviceTopicPublisher(device, mqtt_publisher, args.base_topic)
                topic_publisher.attach()
                topic_publisher.publish_status(
                    "OK",
                    "Connected to EcoFlow DELTA 2 Max over BLE and publishing device state to MQTT.",
                )
                topic_publisher.publish_telemetry()

                LOGGER.info("Connected and publishing MQTT updates")
                await disconnected.wait()
                LOGGER.warning("Device disconnected")
            except Exception as exc:
                publish_status(
                    mqtt_publisher,
                    args.base_topic,
                    "NOK",
                    f"EcoFlow DELTA 2 Max publisher failed: {exc}. Retrying in {args.retry_delay} seconds.",
                )
                LOGGER.exception("Publisher loop failed")
            finally:
                if topic_publisher is not None:
                    topic_publisher.publish_offline()
                if device is not None:
                    try:
                        await device.disconnect()
                    except Exception:
                        LOGGER.exception("Failed to disconnect cleanly")

            LOGGER.info("Retrying in %s seconds", args.retry_delay)
            await asyncio.sleep(args.retry_delay)
    finally:
        mqtt_publisher.disconnect()


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Publish EcoFlow DELTA 2 Max BLE telemetry to MQTT",
    )
    parser.add_argument("--user-id", required=True, help="Numeric EcoFlow user ID")
    parser.add_argument("--mqtt-host", default="localhost", help="MQTT broker hostname")
    parser.add_argument("--mqtt-port", type=int, default=1883, help="MQTT broker port")
    parser.add_argument("--mqtt-username", help="MQTT username")
    parser.add_argument("--mqtt-password", help="MQTT password")
    parser.add_argument(
        "--mqtt-client-id",
        help="Optional MQTT client ID (defaults to ecoflow-delta2max-<user-id>)",
    )
    parser.add_argument(
        "--mqtt-keepalive",
        type=int,
        default=60,
        help="MQTT keepalive in seconds",
    )
    parser.add_argument(
        "--base-topic",
        default="EGSE/ControlStation/EcoFlowMax",
        help="Base MQTT topic. Astra topics are published below <base-topic>",
    )
    parser.add_argument(
        "--address",
        help="Optional BLE address to pin the script to one device",
    )
    parser.add_argument(
        "--scan-timeout",
        type=float,
        default=10.0,
        help="BLE scan timeout in seconds",
    )
    parser.add_argument(
        "--connect-timeout",
        type=int,
        default=20,
        help="BLE connection/auth timeout in seconds",
    )
    parser.add_argument(
        "--retry-delay",
        type=int,
        default=5,
        help="Delay before retrying after a disconnect or error",
    )
    parser.add_argument(
        "--retain",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Publish MQTT messages with the retain flag",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable debug logging",
    )
    return parser


def main() -> None:
    args = build_arg_parser().parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
