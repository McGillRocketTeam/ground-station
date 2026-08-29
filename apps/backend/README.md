# @mrt-backend

## License

MRT-authored backend code is available under the repository's [MIT
License](../../LICENSE), except for `src/main/java/org/yamcs/mqtt` and its tests.
That integration is derived from [Yamcs
MQTT](https://github.com/yamcs/yamcs-mqtt) and is distributed, with MRT's
modifications and additions, under the [GNU Affero General Public License,
version 3](LICENSE-AGPL-3.0). The complete corresponding source is included in
this repository.

The backend as a combined work may be subject to the AGPL when built,
distributed, or offered as a network service. Dependencies retain their own
license terms.

## Local environment

Create `apps/backend/.env` from `.env.example`, then start the development environment with:

```sh
tilt up
```

Tilt exports the backend `.env` before Maven starts, so the forked Yamcs daemon receives
`WIFI_ROUTER_PASSWORD`. When running Maven directly, export that variable in the shell first.
Production launch tooling should provide the same environment variable.

## Omada switch links

The two Omada switch links use a controller Open API application. In the Omada global view, go
to **Settings > Platform Integration > Open API**, create a client-credentials application, grant
it `Site Device Manager View Only` and `Site Device Manager Modify`, and give it access to the
configured site. Put its credentials in `apps/backend/.env`:

```sh
OMADA_CLIENT_ID=...
OMADA_CLIENT_SECRET=...
```

Restart Yamcs after changing the environment. Per-port PoE changes also require **Profile
Override** to be enabled for the affected switch ports in Omada.

Each configured switch publishes device-level local parameters and a 20-element `ports`
aggregate array. Use `port_count` to render only the physical ports present on that switch. The
`set_poe` command accepts enumerated `port` (`PORT_1` through `PORT_20`) and `poe_mode` (`OFF` or
`ON`) arguments; the link rejects ports above its configured `portCount`.

## Router RPC permissions

The GL.iNet firmware requires a narrowly scoped rpcd ACL before HTTP sessions may read router
telemetry. See [`docs/openwrt-router-telemetry.md`](docs/openwrt-router-telemetry.md) for the
verified provisioning and troubleshooting steps.
