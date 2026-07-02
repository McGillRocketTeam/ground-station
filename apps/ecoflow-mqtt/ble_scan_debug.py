#!/usr/bin/env python3

from __future__ import annotations

import argparse
import asyncio

from bleak import BleakScanner


ECOFLOW_MANUFACTURER_ID = 0xB5B5


def _format_manufacturer_data(manufacturer_data: dict[int, bytes]) -> str:
    if not manufacturer_data:
        return "none"
    return ", ".join(
        f"0x{key:04x}={value.hex()}" for key, value in manufacturer_data.items()
    )


def _ecoflow_serial(manufacturer_data: dict[int, bytes]) -> str | None:
    payload = manufacturer_data.get(ECOFLOW_MANUFACTURER_ID)
    if payload is None or len(payload) < 17:
        return None
    return payload[1:17].strip(b"\x00").decode("ascii", errors="replace")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Print nearby BLE advertisements")
    parser.add_argument("--timeout", type=float, default=15.0)
    parser.add_argument("--all", action="store_true", help="Print all devices")
    args = parser.parse_args()

    devices = await BleakScanner.discover(timeout=args.timeout, return_adv=True)
    for device, advertisement in devices.values():
        manufacturer_data = dict(advertisement.manufacturer_data)
        serial = _ecoflow_serial(manufacturer_data)
        local_name = advertisement.local_name or device.name or ""

        if not args.all and serial is None and "eco" not in local_name.lower():
            continue

        print(f"address: {device.address}")
        print(f"name: {device.name}")
        print(f"local_name: {advertisement.local_name}")
        print(f"rssi: {advertisement.rssi}")
        print(f"manufacturer_data: {_format_manufacturer_data(manufacturer_data)}")
        if serial is not None:
            print(f"ecoflow_serial: {serial}")
        print()


if __name__ == "__main__":
    asyncio.run(main())
