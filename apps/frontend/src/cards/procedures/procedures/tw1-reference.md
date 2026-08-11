# TW1 Procedure Update Reference

This file documents the conventions used when updating the TW1 procedure stack.

Use it when translating paper procedures into `ProcedureStep` definitions for the frontend procedure cards.

## File

- Procedure stack: `apps/frontend/src/cards/procedures/procedures/tw1.ts`
- Procedure sections: `apps/frontend/src/cards/procedures/procedures/tw1/`
- Reference notes: `apps/frontend/src/cards/procedures/procedures/tw1-reference.md`

## Goal

Translate human-readable procedure steps into the format expected by `ProcedureStep.make(...)`, using:

- the exact software command names
- the exact mission-system telemetry parameter names
- step numbers and section order that match the paper procedure

## Procedure Step Types

- `type: "note"`
  - Section headers and completion banners.
- `type: "command"`
  - Use when the paper step corresponds to a real mission command.
  - Put the software command path in `name`.
  - Keep the operator-facing wording in `comment`.
- `type: "verify"`
  - Use for telemetry checks.
  - Simple range checks use `condition` entries with `gte` and `lte`.
  - Truth-table checks use `presentation.type = "truthTable"` plus `display` rows/columns.
- `type: "text"`
  - Use for human actions, visual checks, physical configuration, and LED inspections.

## Command Mapping Used In TW1

These paper phrases were mapped to software commands:

- `Reset AV` -> `/FlightComputer/reset_av`
- `Propulsion On` -> `/FlightComputer/propulsion_on`
- `Reset Propulsion Valve States` -> `/FlightComputer/reset_prop_boards_valve_state`
- `Launch` -> `/FlightComputer/launch`
- `Recovery Arm` -> `/FlightComputer/arm_recovery`
- `Recovery Disarm` -> `/FlightComputer/disarm_recovery`
- `MOV ARMED` -> `/FlightComputer/mov_arming`
- `MOV DISARMED` -> `/FlightComputer/mov_disarming`
- `Vent Valve ENERGIZED` -> `/FlightComputer/vent_valve_energize`
- `Vent Valve DE-ENERGIZED` -> `/FlightComputer/vent_valve_de-energize`
- `F/DOV ENERGIZED` -> `/FlightComputer/fdov_energize`
- `F/DOV DE-ENERGIZED` -> `/FlightComputer/fdov_de-energize`
- `E-Stop Button` -> `/FlightComputer/emergency_stop`
- `Umbilical Low` -> `/FlightComputer/umbilical_to_battery`

## Telemetry Mapping Used In TW1

Old procedure code used legacy paths like `/Propulsion/...` and `/Recovery/...`.

TW1 now uses the actual mission-system parameters under:

- `/SystemA/Rocket/FlightComputer/...`

### Propulsion Arm State Checks

- F/DOV logical arm -> `/SystemA/Rocket/FlightComputer/fdov_armed_SW`
- F/DOV electrical arm -> `/SystemA/Rocket/FlightComputer/fdov_armed_HW`
- F/DOV continuity -> `/SystemA/Rocket/FlightComputer/fdov_continuity_HW`
- Vent logical arm -> `/SystemA/Rocket/FlightComputer/vent_armed_SW`
- Vent electrical arm -> `/SystemA/Rocket/FlightComputer/vent_armed_HW`
- Vent continuity -> `/SystemA/Rocket/FlightComputer/vent_continuity_HW`
- MOV logical arm -> `/SystemA/Rocket/FlightComputer/mov_armed_logical_SW`
- MOV electrical arm -> `/SystemA/Rocket/FlightComputer/mov_armed_electrical_HW`
- MOV continuity -> `/SystemA/Rocket/FlightComputer/mov_continuity_HW`

### Propulsion Energize State Checks

- F/DOV energized SW -> `/SystemA/Rocket/FlightComputer/fdov_energized_SW`
- F/DOV gate HW -> `/SystemA/Rocket/FlightComputer/fdov_energizedGate_HW`
- F/DOV current HW -> `/SystemA/Rocket/FlightComputer/fdov_energizedCurrent_HW`
- Vent energized SW -> `/SystemA/Rocket/FlightComputer/vent_energized_SW`
- Vent gate HW -> `/SystemA/Rocket/FlightComputer/vent_energizedGate_HW`
- Vent current HW -> `/SystemA/Rocket/FlightComputer/vent_energizedCurrent_HW`

### Recovery State Checks

- Drogue logical arm -> `/SystemA/Rocket/FlightComputer/drogue_armed_SW`
- Drogue electrical arm -> `/SystemA/Rocket/FlightComputer/drogue_armed_HW`
- Drogue continuity -> `/SystemA/Rocket/FlightComputer/drogue_continuity_HW`
- Main logical arm -> `/SystemA/Rocket/FlightComputer/main_armed_SW`
- Main electrical arm -> `/SystemA/Rocket/FlightComputer/main_armed_HW`
- Main continuity -> `/SystemA/Rocket/FlightComputer/main_continuity_HW`

### Sensor Range Checks

- Tank pressure -> `/SystemA/Rocket/FlightComputer/tank_pressure`
- Vent temperature -> `/SystemA/Rocket/FlightComputer/vent_temp`
- Combustion chamber pressure -> `/SystemA/Rocket/FlightComputer/cc_pressure`
- Tank temperature -> `/SystemA/Rocket/FlightComputer/tank_temp`

## Truth Table Conventions

Use the labels shown in the paper procedure, even if the internal display key is generic.

Examples from TW1:

- Arm-state tables:
  - `armed_SW`
  - `armed_HW`
  - `continuity_HW`
- Energize-state tables:
  - `Logical Energize`
  - `Energize Gate`
  - `Energize Current`

Recommended pattern:

```ts
presentation: {
  type: "truthTable",
  columns: [
    { id: "logicalArm", label: "armed_SW" },
    { id: "electricalArm", label: "armed_HW" },
    { id: "continuity", label: "continuity_HW" },
  ],
}
```

Then map each condition to a display row and column:

```ts
{
  parameter: "/SystemA/Rocket/FlightComputer/fdov_armed_SW",
  operator: "eq",
  value: true,
  display: { row: "F/DOV", column: "logicalArm" },
}
```

## Update Workflow For Future Agents

1. Read the existing procedure file.
2. Compare it against the latest paper procedure.
3. Replace human-readable commands with actual command names from the current mission command list.
4. Replace outdated telemetry paths with the current mission parameter paths.
5. Update section order and step numbers to match the paper procedure exactly.
6. Preserve visual inspection and physical actions as `text` steps.
7. Use `verify` steps only where the paper expects telemetry confirmation.
8. Add missing paper steps rather than trying to force old structure to fit.
9. Format and validate after edits.

## Paper-Procedure Specific Notes From This Update

- The original TW1 AV-prop section was outdated and out of order.
- The correct order used for this update was:
  - AV-Propulsion Integration & Telemetry Verification
  - Basic Vent Valve Verification
  - Reset AV
  - Basic MOV Verification
  - Basic F/DOV Verification
  - Abort Functional Verification
  - AV-Prop closeout steps
  - Recov/Payload/GFRP Assembly Procedures
  - Energetics, wiring, and GFRP Assembly Procedures
  - Final Rocket Assembly Procedures
  - Recovery Sub-System Command and Telemetry Verification
  - Recovery closeout steps
- The paper procedure included steps not present in the old file:
  - MOV 5-second solenoid de-energize confirmation
  - Vent energize check during abort verification
  - E-stop command verification
  - Krytox lubrication step for the male QC on the F/DOV
  - Recovery mechanical closeout steps after avionics validation

## Assumptions Made In This Update

- `Press the E-Stop Button` was mapped to `/FlightComputer/emergency_stop` because that was the matching command available in software.
- All propulsion and recovery telemetry for this procedure was assumed to come from `/SystemA/Rocket/FlightComputer/...` based on the provided mission parameter list.

## Validation Commands

Run these in `apps/frontend` after editing procedure files:

```bash
pnpm fmt
pnpm lint:fix
pnpm exec tsc -p tsconfig.json --noEmit
```

## If Updating Another Procedure Later

- Prefer exact mission names over inferred aliases.
- Do not keep legacy `/Propulsion/...` or `/Recovery/...` parameter paths if current software exposes `/SystemA/Rocket/FlightComputer/...` names instead.
- If the paper wording and software command name differ, keep:
  - operator wording in `comment`
  - machine command in `name`
- If a step is purely observational, use `text`, not `command` or `verify`.
- If a step requires a boolean state matrix, use a truth-table `verify`.
