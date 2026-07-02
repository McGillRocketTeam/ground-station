#!/usr/bin/env python3

from __future__ import annotations

import argparse
import asyncio
import getpass
import sys
from pathlib import Path

import aiohttp


APP_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(APP_DIR / "vendor"))

from ecoflow_ble.login import EcoFlowLogin, Region  # noqa: E402


async def get_user_id(args: argparse.Namespace) -> int:
    identifier = args.identifier or input("EcoFlow email or phone: ").strip()
    password = args.password or getpass.getpass("EcoFlow password: ")
    region = Region(args.region)

    async with aiohttp.ClientSession() as session:
        result = await EcoFlowLogin(session).login(identifier, password, region)

    if result.error:
        raise RuntimeError(result.error)
    if result.user_id is None:
        raise RuntimeError("EcoFlow login succeeded but did not return a user ID")

    return int(result.user_id)


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Resolve your numeric EcoFlow user ID from EcoFlow account login",
    )
    parser.add_argument(
        "--identifier",
        help="EcoFlow account email or phone number. If omitted, you will be prompted.",
    )
    parser.add_argument(
        "--password",
        help="EcoFlow account password. If omitted, you will be prompted securely.",
    )
    parser.add_argument(
        "--region",
        default=Region.AUTO.value,
        choices=[region.value for region in Region],
        help="EcoFlow API region. Default: auto.",
    )
    return parser


def main() -> None:
    args = build_arg_parser().parse_args()
    user_id = asyncio.run(get_user_id(args))
    print(user_id)


if __name__ == "__main__":
    main()
