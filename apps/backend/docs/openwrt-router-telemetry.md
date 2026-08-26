# OpenWrt Router Telemetry Provisioning

`WifiRouterLink` reads router and WAN telemetry through OpenWrt's official ubus
JSON-RPC API. The GL-SFT1200 currently runs OpenWrt 18.06 with LuCI commit
`f64b152`. Its ubus endpoint is enabled, but the vendor firmware does not ship
an ACL group granting HTTP sessions access to the required ubus methods.

These steps provision the router for the link without granting any ubus write
access.

## 1. Add an SSH key

Generate a dedicated RSA key. This old Dropbear version does not accept Ed25519
client keys and only offers an `ssh-rsa` host key.

```sh
ssh-keygen -t rsa -b 3072 -f ~/.ssh/openwrt_mrt_rsa -C mrt-openwrt-admin-rsa
```

In LuCI, open **System > Administration**, paste the contents of
`~/.ssh/openwrt_mrt_rsa.pub` into **SSH-Keys**, and select **Save & Apply**.
Do not expose Dropbear on the WAN interface.

Verify access:

```sh
ssh \
  -i ~/.ssh/openwrt_mrt_rsa \
  -o IdentitiesOnly=yes \
  -o HostKeyAlgorithms=+ssh-rsa \
  -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  root@192.168.0.1 true
```

## 2. Install the read-only rpcd ACL

Create `mrt-monitoring.json` locally:

```json
{
  "mrt-monitoring": {
    "description": "Read-only router telemetry for the MRT Yamcs link",
    "read": {
      "ubus": {
        "network.interface": ["dump"],
        "network.device": ["status"],
        "system": ["info"]
      }
    }
  }
}
```

Copy it to the router. OpenWrt 18.06 has no SFTP server, so modern `scp` needs
the legacy protocol flag:

```sh
scp -O \
  -i ~/.ssh/openwrt_mrt_rsa \
  -o IdentitiesOnly=yes \
  -o HostKeyAlgorithms=+ssh-rsa \
  -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  mrt-monitoring.json \
  root@192.168.0.1:/usr/share/rpcd/acl.d/mrt-monitoring.json
```

Restart rpcd:

```sh
ssh \
  -i ~/.ssh/openwrt_mrt_rsa \
  -o IdentitiesOnly=yes \
  -o HostKeyAlgorithms=+ssh-rsa \
  -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  root@192.168.0.1 /etc/init.d/rpcd restart
```

The router's existing `/etc/config/rpcd` root login selects all installed read
ACL groups with `list read '*'`. No change to that file is required. The ACL
file survives reboots but may need to be restored after a firmware upgrade.

## 3. Configure Yamcs

The link configuration is:

```yaml
- name: EGSE/ControlStation/WifiRouter
  class: org.yamcs.mrt.links.WifiRouterLink
  ppStream: pp_realtime
  endpoint: http://192.168.0.1:8080/ubus
  username: root
  password: ${env.WIFI_ROUTER_PASSWORD}
```

Set `WIFI_ROUTER_PASSWORD` in the Yamcs process environment. Do not commit the
router password or an ubus session token. The link authenticates using
`session.login`, renews expired sessions, and only invokes the three methods
listed in the ACL.

## Troubleshooting

- A successful login followed by JSON-RPC error `-32002` means the ACL file is
  absent, invalid, or rpcd was not restarted.
- HTTP 404 at `/ubus` means `uhttpd.main.ubus_prefix` is not configured.
- HTTP 400 for a GET request to `/ubus` is expected; ubus requires JSON-RPC
  requests via POST.
- SSH negotiation errors mentioning `ssh-rsa` require the two per-command SSH
  algorithm options shown above.
