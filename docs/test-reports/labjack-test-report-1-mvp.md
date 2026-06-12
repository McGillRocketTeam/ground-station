# LabJack T7 — Test Report 1 (MVP / Integration)

> Post to **#av_testing** and forward to **#ls_daq_operations**.
> Goal: confirm the refactored LabJack ↔ YAMCS pipeline works end-to-end in stream mode, with the
> control box, at the MVP scan rate (300 Hz), before the team-wide launch rehearsal.

## Meta-information

| Field | Value |
|---|---|
| Date | _____ |
| Attendees (incl. DAQ lead) | _____ |
| Location | _____ |
| Project integrations | LabJack T7 · new control box · GS computer · YAMCS backend · frontend |
| Hardware | T7 (serial ____), control box (____), GS computer (____), ethernet link |
| Code under test | branch `labjack/refactor`, commit `______` |
| Backend launch | `mvn yamcs:run` (or Docker image `______`) |

## Configuration used (`LabJackConfig`)

| Knob | Value for this test |
|---|---|
| `SCAN_RATE_HZ` | 300 |
| `SCANS_PER_READ` (stream buffer) | 30 (then ____ to demo buffer change) |
| `GRAPH_FREQ` | 1 (then ____ to demo decimated YAMCS rate) |
| `ARCHIVE_FULL_RATE` | false |
| `WATCHDOG_TIMEOUT_S` | 300 |

## Test items

> Mark each ✅ pass / ❌ fail / ⚠️ partial and record the observation.

### 1. LabJack → YAMCS in stream mode (ethernet, GS computer, control box)
- [ ] T7 reachable over ethernet; backend connects (link status `OK - streaming at 300 Hz`).
- [ ] AIN0–AIN13 appear as parameters under `/LabJackT7` and update live.
- Observation: _____

### 2. Stream-mode buffer is adjustable via a static variable
- [ ] Change `LabJackConfig.SCANS_PER_READ` (e.g. 30 → 60), rebuild, restart.
- [ ] Confirm the batch arrives in YAMCS as **multiple data points at the same reception timestamp**
      (Archive Browser / parameter table shows N samples per read).
- Observation (samples/read before vs after): _____

### 3. Analog input @ 300 Hz, visualized without delay
- [ ] `SCAN_RATE_HZ = 300`; confirm actual scan rate logged ≈ 300 Hz.
- [ ] Chart card tracks a stimulus (e.g. signal generator / known pressure step) with no growing lag.
- [ ] **GRAPH_FREQ demo**: set `GRAPH_FREQ > 1` and confirm YAMCS receives a *lower* rate than the
      local CSV (CSV row count over 10 s ≈ 300×10; YAMCS sample count ≈ that ÷ GRAPH_FREQ).
- Observation (CSV rows vs YAMCS samples over ___ s): _____

### 4. Digital IO write + readback through YAMCS
- [ ] Send `/LabJackT7/write_digital_pin` for several DIO (e.g. FIO0–FIO7); measure pin with DMM/LED.
- [ ] Confirm the corresponding `FIO/EIO/CIO/MIO` parameter reflects the new state in YAMCS.
- [ ] Send `/LabJackT7/write_DAC_pin` (0–5 V) and verify output voltage.
- Observation (pins exercised, expected vs measured): _____

### 5. Local CSV record
- [ ] CSV created under `yamcs-data/labjack_csv/labj_<timestamp>.csv` with header + full-rate rows.
- Observation (path, row count): _____

## Result

**Overall:** ⬜ PASS ⬜ PASS-WITH-NOTES ⬜ FAIL

## Issues found / follow-ups
1. _____

## Sign-off
- DAQ lead: _____  · AV: _____
