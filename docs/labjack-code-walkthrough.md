# LabJack T7 — Code Walkthrough & Pre-Test Reference

> Audience: MRT leads. Goal: explain, end to end, how a LabJack T7 connects to the YAMCS backend and
> flows data to the frontend — every file, every function, in order — plus a simulated walkthrough of
> tonight's bench test with the concrete points where it can fail and how each is handled.
>
> Every numeric value here is cited to its source: the **T7 datasheet** (§23 Watchdog text; §3.2 Stream
> mode), the **LJM error codes** in `libs/LJM.java`, the **LabJack Modbus register map** (inherited from
> the original `LabJackUtil`), or a named field in **`LabJackConfig`**. Nothing is invented.

---

## 1. The files and their roles

| File | Role |
|---|---|
| `apps/backend/src/main/yamcs/etc/yamcs.ground_station.yaml` | Wires the link, streams, MDB, processor. |
| `apps/backend/src/main/yamcs/mdb/labjack-t7.xml` | XTCE: AIN/DIO parameters, the `LabJackPacket` container, calibrated derived params, the two commands. |
| `org/yamcs/labjack/LabJackConfig.java` | All tunables (scan rate, buffer, ranges, watchdog, decimation). Static fields, optional YAML override. |
| `org/yamcs/labjack/LabJackPacket.java` | Binary (de)serialisation of the 59-byte packet. |
| `org/yamcs/labjack/LabJackDevice.java` | Hardware abstraction layer over the LJM handle (open/stream/read/IO/watchdog). |
| `org/yamcs/labjack/LabJackCsvWriter.java` | Full-rate local CSV record. |
| `org/yamcs/labjack/LabJackDataLink.java` | The YAMCS link: lifecycle state machine, acquisition loop, dual-rate publish, commands, recovery. |
| `libs/LJM.java`, `libs/LJMException.java` | JNA binding to the native `LabJackM` library (LabJack-provided). |
| `org/yamcs/mrt/utils/AstraPacketPreprocessor.java` | Stamps generation time + sequence count before the packet enters the processor. |

---

## 2. Parameters and their exact sources (no hallucinated numbers)

| Parameter | Value | Source of truth |
|---|---|---|
| Analog channels | 14 (AIN0–AIN13) | `LabJackConfig.NUM_ANALOG_PINS` |
| Digital lines | 23 (FIO0–7, EIO0–7, CIO0–3, MIO0–2) | `LabJackConfig.NUM_DIGITAL_PINS` |
| Scan rate (default) | **300 Hz** | `LabJackConfig.SCAN_RATE_HZ` (test target) |
| Scans per `eStreamRead` (buffer) | **30** (~100 ms/batch @ 300 Hz) | `LabJackConfig.SCANS_PER_READ` |
| Stream resolution index | 0 (max speed) | `LabJackConfig.STREAM_RESOLUTION_INDEX` |
| Stream settling | 0 (auto) | `LabJackConfig.STREAM_SETTLING_US` |
| T7 aggregate sample limit | 100 kSamples/s | T7 datasheet §3.2. 14×300 = 4 200 S/s; 14×500 = 7 000 S/s — both well under. |
| AIN0–5 range | ±1 V | `LabJackConfig.AIN_LOW_RANGE_V` (load cells / CC pressure) |
| AIN6–13 range | ±10 V | `LabJackConfig.AIN_HIGH_RANGE_V` (pressure transducers) |
| AIN# stream address | 2×# (AIN0=0 … AIN13=26) | `LabJackDevice.startStream`, LabJack Modbus map |
| DIO# write register | 2000+# (UINT16) | `LabJackDevice.DIO_REGISTER_BASE`, LabJack Modbus map |
| DAC# write register | 1000+2×# (FLOAT32) | `LabJackDevice.DAC_REGISTER_BASE`, LabJack Modbus map |
| Packet size | **59 bytes** (14×4 float + 3 DIO) | `LabJackPacket.PACKET_SIZE` |
| Realtime decimation | `GRAPH_FREQ = 1` (every scan) | `LabJackConfig.GRAPH_FREQ` |
| Full-rate archive | `ARCHIVE_FULL_RATE = false` | `LabJackConfig.ARCHIVE_FULL_RATE` (off for tonight) |
| Watchdog timeout | **300 s** | `LabJackConfig.WATCHDOG_TIMEOUT_S` |
| Connect retry | 2 000 ms | `LabJackConfig.CONNECT_RETRY_MS` |
| Reconnect backoff | 1 000 → 10 000 ms (exponential) | `LabJackConfig.RECONNECT_BACKOFF_MS / _MAX_MS` |
| Disconnect-class LJM codes | 1224, 1225, 1227, 1233, 1239, 1240, 1242, 1302, 1303 | `LabJackDevice.DISCONNECT_ERRORS` (names in `libs/LJM.java`) |

### Watchdog registers (T7 datasheet §23) — exact values written

`LabJackDevice.configureWatchdog()` writes, in order:

| Register | Value | Meaning (§23) |
|---|---|---|
| `WATCHDOG_ENABLE_DEFAULT` | 0 | disable while configuring |
| `WATCHDOG_TIMEOUT_S_DEFAULT` | 300 | trip after 300 s without qualifying comms |
| `WATCHDOG_RESET_ENABLE_DEFAULT` | 0 | **do not reboot** on trip |
| `WATCHDOG_DIO_ENABLE_DEFAULT` | 1 | drive DIO on trip |
| `WATCHDOG_DIO_INHIBIT_DEFAULT` | 0 | bitmask: 1=protect a line, **0 = affect all 23** |
| `WATCHDOG_DIO_DIRECTION_DEFAULT` | 0x7FFFFF | bitmask: 1=output → all 23 driven |
| `WATCHDOG_DIO_STATE_DEFAULT` | 0 | level bitmask → all **LOW** |
| `WATCHDOG_ENABLE_DEFAULT` | 1 | enable |

These are flash-backed `*_DEFAULT` registers, so the link writes them **once per session** (`watchdogConfigured` guard) to avoid flash wear. **Critical (§23 "When Using Stream"): spontaneous stream data does NOT feed the timer — only command-response does.** The per-batch `DIO_STATE` read is that command-response, so the watchdog stays fed while streaming and only trips when the control station goes silent.

---

## 3. Boot & connect flow — function by function

This is the exact call order from backend start to streaming.

1. **YAMCS starts** (`yamcs.ground_station.yaml`). `streamConfig` creates the streams:
   `tm_labJack` (realtime processor, root container `/LabJackT7/LabJackPacket`), `tm_labjack_hires`
   (archive-only — no `processor:` line), and `tc_labJack` (realtime, `tcPatterns: /LabJackT7/.*`).
   The MDB is loaded from `labjack-t7.xml` under spec `LabJack` → SpaceSystem `/LabJackT7`.
2. **Link constructed** → `new LabJackDataLink()` → sets `instance = this` (singleton used by the
   control-box E-stop fast path).
3. **`init(instance, name, config)`**
   - `super.init(...)` builds the `tmSink` (→ `tm_labJack`), the command path, and the
     `AstraPacketPreprocessor` from `packetPreprocessorArgs`.
   - `LabJackConfig.applyOverrides(config)` — would read `scanRateHz`, `graphFreq`, `archiveFullRate`,
     etc. from the link's `args:`; none are present today, so **defaults hold** (300 Hz, GRAPH_FREQ=1,
     archive off).
4. **`doStart()`** (YAMCS service-init thread) → `startAcquisition()`:
   - `running=true`, `graphCounter=0`, `watchdogConfigured=false`.
   - **No LJM call here** (deliberate — see §6.1). `device = createDevice()` (`new LabJackDevice()`).
   - `setupArchiveStream()` → archive off → returns immediately (`archiveStream=null`).
   - `csvWriter = new LabJackCsvWriter()` → path `yamcs-data/labjack_csv/labj_<timestamp>.csv`;
     `csvWriter.open()` creates dirs + header.
   - `csvExecutor` (daemon) schedules `drainCsv` every 500 ms (first run after 1 s).
   - `acquisitionThread` starts → enters `run()`.
   - `notifyStarted()` → **the backend reports the link started and continues**, regardless of LabJack.
5. **`run()`** (background acquisition thread):
   - `LabJackDevice.configureLibraryAutoReconnect()` — **first native call**, forces JNA to load
     `LabJackM.dll`, then sets `LJM_AUTO_RECONNECT_STICKY_CONNECTION/SERIAL = 1`.
   - Loop `while(running)`:
     - Device not open → state `CONNECTING` → **`tryConnect()`**:
       1. `device.open()` → `LJM.openS("ANY","ANY","ANY", …)` (ethernet or USB).
       2. `device.configureAnalogRanges()` → `AIN0..5_RANGE=1.0`, `AIN6..13_RANGE=10.0`.
       3. `device.configureWatchdog()` *(only if not yet configured)* → the §23 register writes above.
       4. `device.setAllDigitalLow()` → write 0 to DIO 0..22 (safe state on every connect).
       5. `device.startStream()` → build scan list `[0,2,…,26]`, `eStreamStop` (clear leftovers),
          set `STREAM_RESOLUTION_INDEX`/`STREAM_SETTLING_US`, `eStreamStart(30, 14, scanList, 300.0)`.
       - success → state `STREAMING`; failure → log, `device.close()`, retry after backoff.
     - Device open → **`acquireOnce()`** (steady state, §4).
   - The loop is wrapped so a missing/incompatible native library (`LinkageError`) is caught, logged
     with an actionable message, and the link stays `UNAVAILABLE` — **the backend is unaffected**.

---

## 4. Steady-state data flow — `acquireOnce()`

Per batch (~every 100 ms at 300 Hz):

1. `batch = device.readStream()` → `eStreamRead` **blocks** until `SCANS_PER_READ` (30) scans are
   buffered, returns `30 × 14 = 420` doubles, scan-major.
2. `lastDigital = device.readDigitalState()` → `eReadName("DIO_STATE")` → `LabJackPacket.encodeDigitalState`
   → 3 bytes. *This is the command-response that feeds the watchdog.* Non-disconnect failure → reuse the
   last value + warn; disconnect-class failure → rethrow → reconnect.
3. `now = getCurrentTime()` (once for the batch).
4. For each of the 30 scans:
   - `LabJackPacket.build(scanValues, digital)` → 56 bytes of big-endian floats + 3 DIO bytes = 59 bytes.
   - `dataIn(1, 59)` (link in-counter).
   - `csvQueue.add(...)` → **full rate to CSV** (drained every 500 ms by `drainCsv` →
     `LabJackCsvWriter.writeRow`, which decodes via `LabJackPacket`).
   - if `ARCHIVE_FULL_RATE` → `emitToArchive` (**off tonight**).
   - if `++graphCounter >= GRAPH_FREQ` (every scan when =1) → `processPacket(preprocessor.process(new
     TmPacket(now, packet)))` → `AstraPacketPreprocessor` stamps generation time + seq count →
     `tmSink` → `tm_labJack` → realtime processor parses `/LabJackT7/LabJackPacket` → updates AIN/DIO
     params → `MathAlgorithm`s compute `calibrated_*` → ParameterArchive + frontend (websocket).

---

## 5. Command & recovery flows

**Command** (operator clicks in frontend): YAMCS → `tc_labJack` (matches `/LabJackT7/.*`) →
`LabJackDataLink.sendCommand`:
- not connected → return false; else parse `pin_number` + the value argument;
- `write_digital_pin` → `device.writeDigitalPin(pin, state)` → `eWriteAddress(2000+pin, UINT16, state)`;
- `write_DAC_pin` → `device.writeDac(pin, volts)` → `eWriteAddress(1000+2·pin, FLOAT32, volts)`.
- **E-stop fast path:** `ControlBoxLink` → `LabJackDataLink.getInstance().writeDigitalPin(...)` bypasses
  the command pipeline for latency.

**Recovery** (the headline bug fix — testable tonight): if the T7 is powered off mid-stream,
`eStreamRead` throws an `LJMException` with a disconnect-class code (e.g. `SOCKET_LEVEL_ERROR 1233`,
`RECONNECT_FAILED 1239`, `STREAM_NOT_RUNNING 1303`) → `run()` → `isDisconnectError` true →
`enterReconnecting()` (stop + close, state `RECONNECTING`) → loop retries `open → configure → startStream`
with exponential backoff (1→10 s). When the T7 returns, streaming + CSV resume automatically. (The old
code got permanently stuck here.)

---

## 6. Where tonight's test can go wrong (simulated, with handling)

| # | Failure point | What happens | Severity | Handling / what to do |
|---|---|---|---|---|
| 6.1 | **`LabJackM.dll` not installed** on the GS computer | First `configureLibraryAutoReconnect()` throws `UnsatisfiedLinkError` | **Blocks the test** (no LabJack), but **backend stays up** | Caught → link `UNAVAILABLE`, clear log message. **Install the LabJack LJM software before tonight.** |
| 6.2 | LabJack **not powered / not reachable** (ethernet/USB) | `open()` → `DEVICE_NOT_FOUND (1227)` | Expected pre-connect | `tryConnect` retries every 2 s; link shows `CONNECTING`. Check cabling/power/IP. |
| 6.3 | **Scan rate too high** for resolution index | `eStreamStart` errors or returns a lower actual rate | Low at 300 Hz | 14×300 ≪ 100 kS/s and `RESOLUTION_INDEX=0` — fine. Log prints **actual** rate; confirm it equals requested. |
| 6.4 | **Power-cycle mid-stream** (recovery test) | `eStreamRead` → disconnect code | This is a test case | Auto-reconnect (§5). Watch logs for "stream lost … re-establishing" then "Stream started". |
| 6.5 | **Frontend lag at 300 Hz** with `GRAPH_FREQ=1` | 300 packets/s × 14 algorithms hit the realtime/websocket path | Medium — the latency item | If the UI lags, raise `GRAPH_FREQ` (e.g. 5–10). CSV stays full-rate regardless. |
| 6.6 | **Watchdog false-trip** | Would drive DIO low mid-test | Low | Fed by the per-batch `DIO_STATE` read; a 30-scan batch is ~100 ms ≪ 300 s. Won't trip while streaming. |
| 6.7 | **Watchdog real trip** (CS link lost 5 min) | All DIO driven low, no reboot | Test case | Verify at HIL: measured trip time + every intended line goes low. |
| 6.8 | **CSV disk error / slow disk** | `writeRow` fails → CSV disabled (logged), or `csvQueue` grows | Low–medium | Acquisition never blocks on CSV (separate executor, errors swallowed). At 500 Hz on a slow disk watch memory (`csvQueue` is unbounded). |
| 6.9 | **`ARCHIVE_FULL_RATE` second-stream path** | Direct tuple emit to `tm_labjack_hires` | **Untested on hardware** | **Leave `false` tonight** (it is). Exercise only in a later perf session. |
| 6.10 | Backend `mvn clean` while running | RocksDB `LOCK` can't be deleted | Tooling only | Stop the backend first, or delete `target/yamcs/yamcs-data/_global.rdb/LOCK`. |

### Correctness caveats to interpret results correctly (not crashes)

- **Timestamp quantization:** all 30 scans in a batch are stamped with one batch-level time (the
  preprocessor uses wall-clock at process time; the CSV uses the batch reception time). So you get ~30
  rows/packets sharing (approximately) the same timestamp, then the next batch ~100 ms later. The data
  is full-rate in **count** but not spread across the 100 ms sub-batch interval. (Same as the original
  code.) If per-sample timing matters, derive it as `batchTime + scanIndex / scanRate`.
- **Calibration:** the `calibrated_*` `MathAlgorithm`s in `labjack-t7.xml` have comments that disagree
  with their actual coefficients (e.g. AIN0 comment `95.167·v − 79.167` vs the operation
  `1389.7·v + 13.78`), and thrust/weight reference AIN3/AIN2 opposite to the comments. **Raw AIN values
  are unaffected; the derived engineering values may be wrong.** Have the DAQ lead confirm coefficients
  before trusting calibrated readings. (Untouched by the refactor — DAQ-owned.)
- **`packetPreprocessorArgs.timestampOffset: 2`** is vestigial — `AstraPacketPreprocessor` ignores it
  and always uses wall-clock. The "sequence count" it derives (bytes 0–1 = top of AIN0) is not
  meaningful; harmless.

---

## 7. Pre-test checklist

- [ ] **LabJack LJM software installed** on the GS computer (`LabJackM.dll` resolvable). (6.1)
- [ ] T7 reachable over **ethernet** (preferred) or USB; note its IP. (6.2)
- [ ] Backend started (`tilt up`); LabJack link reaches **`OK – streaming`** (`getDetailedStatus`). If a
      stale RocksDB `LOCK` blocks startup, clear it (6.10).
- [ ] Confirm the logged **actual scan rate** matches 300 Hz. (6.3)
- [ ] AIN0–13 visible in the frontend; nudge an input and watch it move. (6.5)
- [ ] DIO write + state read-back via `write_digital_pin`; verify on the frontend and a meter. (5)
- [ ] CSV file created under `yamcs-data/labjack_csv/`; rows accumulating. (4)
- [ ] **Recovery:** power-cycle the T7, confirm the stream re-establishes from the logs. (6.4)
- [ ] **Watchdog:** (optional tonight) drop the CS link, confirm DIO go low after ~5 min. (6.7)
- [ ] If the UI lags at 300 Hz, raise `GRAPH_FREQ` and rebuild. (6.5)

---

## 8. Test coverage (no hardware)

`mvn -f apps/backend/pom.xml test` runs 9 pure-logic tests:
- `LabJackPacketTest`: `packetSizeMatchesContainer`, `analogRoundTrips`, `digitalEncodeDecodeRoundTrips`,
  `dio0IsMostSignificantBitOfFirstDigitalByte`.
- `LabJackConfigTest`: `analogChannelCount`, `lowRangeChannelsUseOneVolt`, `highRangeChannelsUseTenVolts`.
- `LabJackDeviceTest`: `disconnectClassErrorsTriggerReconnect`, `transientOrUnknownErrorsDoNotTriggerReconnect`.

Hardware behaviours (open/stream/watchdog/recovery) are validated at the HIL session, not in CI.
