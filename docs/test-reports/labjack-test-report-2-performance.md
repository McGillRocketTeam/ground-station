# LabJack T7 — Test Report 2 (Performance / Robustness)

> Post to **#av_testing** and forward to **#ls_daq_operations**.
> Goal: confirm the bug fixes and high-rate behaviour — stream-read recovery after a power cycle,
> 500 Hz acquisition with full-rate archiving + a responsive frontend, and the 5-minute watchdog.

## Meta-information

| Field | Value |
|---|---|
| Date | _____ |
| Attendees (incl. DAQ lead) | _____ |
| Location | _____ |
| Project integrations | LabJack T7 · control box · GS computer · YAMCS backend · frontend |
| Hardware | T7 (serial ____), control box (____), GS computer (____), ethernet link |
| Code under test | branch `labjack/refactor`, commit `______` |

## Configuration used (`LabJackConfig`)

| Knob | Value for this test |
|---|---|
| `SCAN_RATE_HZ` | 500 |
| `SCANS_PER_READ` | ____ (e.g. 50 → 10 reads/s) |
| `GRAPH_FREQ` | ____ (decimate UI; e.g. 10 → 50 Hz to frontend) |
| `ARCHIVE_FULL_RATE` | true |
| `ARCHIVE_STREAM` | `tm_labjack_hires` |
| `WATCHDOG_TIMEOUT_S` | 300 |

## Test items

### 1. Stream-read recovery after LabJack power-cycle (bug fix)
Reproduces the old `E_STREAM_READ_FAIL` lock-up.
- [ ] Start backend, establish connection, confirm streaming.
- [ ] Power **off** the T7 mid-stream. Backend logs `stream lost ... re-establishing` and link → `Reconnecting`.
- [ ] Power the T7 back **on**. Backend re-opens, re-arms watchdog, re-asserts DIO low, resumes streaming
      **without a manual restart**. Link returns to `OK - streaming`.
- [ ] Repeat ≥3× to confirm it's reliable. Record recovery time each cycle.
- Observation (recovery times, any manual intervention needed): _____

### 2. IO latency @ 500 Hz — full archive + throttled frontend (bug fix)
- [ ] `SCAN_RATE_HZ = 500`; confirm actual scan rate ≈ 500 Hz.
- [ ] `ARCHIVE_FULL_RATE = true`: confirm `tm_labjack_hires` archives the **full** ~500 Hz
      (Archive Browser sample count over 10 s ≈ 5000 × 14 channels).
- [ ] `GRAPH_FREQ` set so the frontend receives a reduced rate: chart stays real-time with **no growing
      delay** as the test runs (compare operator-observed lag vs Report 1).
- [ ] Local CSV still contains the full 500 Hz (row count over 10 s ≈ 5000).
- [ ] Cross-check: full-rate archive (`tm_labjack_hires`) vs decimated realtime (`tm_labJack`) vs CSV.
- Observation (archive rate, UI lag, CSV rate): _____

### 3. Watchdog — 5-minute timeout resets DIO low
- [ ] With the T7 connected and DIO driven high, **stop the control-station link** (stop the backend /
      pull the ethernet) and start a timer.
- [ ] Confirm all 23 DIO drive **LOW** at ~5 min (measure a representative driven pin; e.g. a valve line).
- [ ] Confirm the watchdog does **not** false-trigger during normal operation (run ≥10 min streaming +
      DIO polling with the link up; DIO stay as commanded).
- Observation (measured trip time, pins checked, any false trips): _____

### 4. Regression — DIO write/readback + AIN at rate
- [ ] DIO write + readback through YAMCS still correct at 500 Hz (per Report 1 item 4).
- [ ] AIN values sane / calibrated parameters reasonable (DAQ lead to sanity-check calibration).
- Observation: _____

## Result

**Overall:** ⬜ PASS ⬜ PASS-WITH-NOTES ⬜ FAIL

## Issues found / follow-ups
1. Watchdog — register semantics verified against datasheet §23 (no reboot; all 23 DIO -> low; fed by
   command-response, not stream). Confirm at HIL: measured trip time and that every intended line
   actually drives low; adjust `INHIBIT` if any line must be excluded. Optional: set device IO power-up
   defaults low to cover the reboot window. Result: _____
2. Concurrency: command/E-stop writes occur on a different thread than the stream read — watch for any
   LJM contention at 500 Hz. Result: _____
3. _____

## Sign-off
- DAQ lead: _____  · AV: _____
