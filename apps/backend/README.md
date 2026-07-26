# @mrt-backend

## Local environment

Create `apps/backend/.env` from `.env.example`, then start the development environment with:

```sh
tilt up
```

Tilt exports the backend `.env` before Maven starts, so the forked Yamcs daemon receives
`WIFI_ROUTER_PASSWORD`. When running Maven directly, export that variable in the shell first.
Production launch tooling should provide the same environment variable.

## Router RPC permissions

The GL.iNet firmware requires a narrowly scoped rpcd ACL before HTTP sessions may read router
telemetry. See [`docs/openwrt-router-telemetry.md`](docs/openwrt-router-telemetry.md) for the
verified provisioning and troubleshooting steps.
