# LabJack Module Refactor — Change Summary

Branch `labjack/refactor` (from `benchscale`). Goal: a clean, testable LabJack ↔ YAMCS pipeline that
preserves existing behaviour, fixes the known bugs, and is ready for the HIL testing session.

## What changed

| File | Change |
|---|---|
| `org/yamcs/labjack/LabJackConfig.java` | **New.** All acquisition / publishing / watchdog tunables in one place (static fields, optional `yamcs.yaml` overrides). |
| `org/yamcs/labjack/LabJackPacket.java` | **New.** Binary pack/unpack incl. the 23-bit DIO ordering — one source of truth, unit-tested. |
| `org/yamcs/labjack/LabJackDevice.java` | **New.** Instance HAL (replaces static `LabJackUtil`): open/stream/read/digital IO/watchdog; surfaces LJM error codes; `isDisconnectError()`. |
| `org/yamcs/labjack/LabJackCsvWriter.java` | **New.** Full-rate CSV, extracted; IO errors no longer kill the thread. |
| `org/yamcs/labjack/LabJackDataLink.java` | **Refactored.** Supervised state machine + recovery + dual-rate + watchdog + commands. |
| `org/yamcs/labjack/LabJackUtil.java` | **Deleted** (folded into `LabJackDevice`/`LabJackConfig`/`LabJackPacket`). |
| `org/yamcs/mrt/links/ControlBoxLink.java` | Updated to `LabJackConfig.NUM_DIGITAL_PINS`; E-stop fast path (`LabJackDataLink.getInstance().writeDigitalPin`) preserved. |
| `yamcs/etc/yamcs.ground_station.yaml` | Added archive-only stream `tm_labjack_hires` for full-rate logging. |
| `src/test/java/org/yamcs/labjack/*` | **New.** 9 unit tests (packet round-trip, DIO bit order, disconnect classification, ranges). |
| `docs/test-reports/*` | **New.** MVP + performance report templates. |

## Bugs fixed

1. **Stream stuck after `E_STREAM_READ_FAIL`.** A disconnect-class LJM error (`SOCKET_LEVEL_ERROR`,
   `RECONNECT_FAILED`, `STREAM_NOT_RUNNING`, …) now drives `STREAMING → RECONNECTING`; the supervisor
   re-opens, re-arms the watchdog, re-asserts DIO low, and resumes streaming when the T7 returns — no
   manual restart. (Old code returned `null` and never recovered.)
2. **Watchdog DIO reset incomplete.** The old code set `WATCHDOG_DIO_STATE=0`/`ENABLE=1` but never set
   `WATCHDOG_DIO_DIRECTION`, so pins weren't driven. Now all 23 DIO are set as outputs driven low on
   trip, configured via LJM register *names* (no magic addresses).
3. **IO latency at high scan rate.** New dual-rate model — CSV always full rate; realtime/frontend
   decimated by `GRAPH_FREQ`; with `ARCHIVE_FULL_RATE` the YAMCS archive keeps the full raw rate via
   `tm_labjack_hires` while the UI stays responsive.
4. Minor: corrupted javadoc, magic numbers, inconsistent error handling, hardcoded 50 Hz scan rate.

## Tunables (`LabJackConfig`)
`SCAN_RATE_HZ` (300 MVP → 500 perf), `SCANS_PER_READ` (stream buffer), `GRAPH_FREQ` (UI decimation),
`ARCHIVE_FULL_RATE` + `ARCHIVE_STREAM`, `WATCHDOG_TIMEOUT_S`, reconnect backoff, `CSV_DIR`.

## Verified now
- `mvn compile` / `mvn test-compile` → BUILD SUCCESS (offline, JDK 21 target).
- `mvn test` → 9/9 pass.

## Pending HIL verification (next week, together) — see report templates
- Power-cycle stream recovery; 500 Hz full-archive + responsive UI; 5-min watchdog → DIO low.

## For the DAQ lead / open items
- **Calibration not touched.** Comment/value mismatches spotted in `labjack-t7.xml` for the DAQ lead to
  review (not changed here): e.g. AIN0 comment `95.167*v-79.167` vs algorithm `1389.7*v+13.78`;
  thrust uses AIN3 / weight uses AIN2 (param names imply the reverse); `ain9`/`ain10` offsets
  (189.71 / 172.71) differ from the stated 182.71.
- **Watchdog registers** — confirm `DIO_DIRECTION/STATE/INHIBIT` semantics against the T7 watchdog
  datasheet during HIL; tune the `INHIBIT` mask if any line must be excluded.
- **Concurrency** — command / E-stop writes run on a different thread than the stream read (as before);
  watch for LJM contention at 500 Hz.
