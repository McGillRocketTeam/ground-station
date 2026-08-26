import yamcs.pymdb as Y

from flight_system import FlightSystem


HEALTH_CHOICES = [
    (0, "UNKNOWN"),
    (1, "NOT_APPLICABLE"),
    (2, "NOMINAL"),
    (3, "DEGRADED"),
    (4, "CRITICAL"),
]

READINESS_CHOICES = [
    (0, "UNKNOWN"),
    (1, "NOT_REQUIRED"),
    (2, "NOT_READY"),
    (3, "READY"),
    (4, "ACTIVE"),
    (5, "COMPLETE"),
    (6, "FAULT"),
]

FC = "/SystemA/Rocket/FlightComputer/"
# Initial operational policy values. Keep these centralized until authoritative
# timing requirements are available from the vehicle owners.
NOMINAL_CLEAR_MS = 3000
ACTUATION_RESPONSE_MS = 2000
VALVE_TRAVEL_MS = 5000
INACTIVITY_WARNING_MS = 5000
INACTIVITY_CRITICAL_MS = 10000
GPS_WARNING_AGE = 5
GPS_CRITICAL_AGE = 15


class DerivedSystem(FlightSystem):
    def __init__(self, output_path: str):
        self.output_path = output_path
        self.sys = Y.System("Derived")
        self.rocket = Y.Subsystem(self.sys, "Rocket")
        self.flight_computer = Y.Subsystem(self.rocket, "FlightComputer")
        self.recovery = Y.Subsystem(self.rocket, "Recovery")
        self.propulsion = Y.Subsystem(self.rocket, "Propulsion")
        self.navigation = Y.Subsystem(self.rocket, "Navigation")
        self.storage = Y.Subsystem(self.rocket, "Storage")
        self.control_station = Y.Subsystem(self.sys, "ControlStation")
        self.control_station_radio = Y.Subsystem(self.control_station, "Radio")
        self.pad = Y.Subsystem(self.sys, "Pad")
        self.pad_radio = Y.Subsystem(self.pad, "Radio")
        self.communications = Y.Subsystem(self.sys, "Communications")

    @staticmethod
    def _enum_output(
        system: Y.System,
        name: str,
        description: str,
        choices: list[tuple[int, str]] = HEALTH_CHOICES,
    ) -> Y.EnumeratedParameter:
        alarm_state = "FAULT" if choices == READINESS_CHOICES else "CRITICAL"
        return Y.EnumeratedParameter(
            system=system,
            name=name,
            choices=choices,
            alarm=Y.EnumerationAlarm({alarm_state: Y.AlarmLevel.CRITICAL}),
            data_source=Y.DataSource.DERIVED,
            initial_value=choices[0][1],
            short_description=description,
        )

    @staticmethod
    def _algorithm(
        system: Y.System,
        output: Y.Parameter,
        description: str,
        source: str,
        inputs: dict[str, str],
    ) -> Y.Algorithm:
        refs = [Y.InputParameter(path, name=name) for name, path in inputs.items()]
        return Y.Algorithm(
            system=system,
            name=output.name,
            short_description=description,
            language="JavaScript",
            text=source,
            inputs=refs,
            outputs=[Y.OutputParameter(output, name="result")],
            triggers=[Y.ParameterTrigger(path) for path in inputs.values()],
        )

    def _make_operational_health(self) -> Y.Algorithm:
        output = self._enum_output(
            self.flight_computer,
            "operational_health",
            "Flight computer operational health",
        )
        source = f"""
var now = Date.now();
if (typeof nominalSince === "undefined") nominalSince = null;
var candidate = "UNKNOWN";
if (flight_stage.value !== null && telemetry_health.value !== null) {{
  if (flight_stage.rawValue === 99 || telemetry_health.value === "CRITICAL") candidate = "CRITICAL";
  else if (telemetry_health.value === "DEGRADED") candidate = "DEGRADED";
  else if (telemetry_health.value === "NOMINAL") candidate = "NOMINAL";
}}
if (candidate !== "NOMINAL") nominalSince = null;
else if (nominalSince == null) nominalSince = now;
if (candidate === "NOMINAL" && now - nominalSince < {NOMINAL_CLEAR_MS}) candidate = "DEGRADED";
result.value = candidate;
result.updated = true;
""".strip()
        return self._algorithm(
            self.flight_computer,
            output,
            output.short_description,
            source,
            {
                "flight_stage": FC + "flight_stage",
                "telemetry_health": "/SystemA/Derived/Rocket/FlightComputer/telemetry_health",
            },
        )

    def _make_telemetry_health(self) -> Y.Algorithm:
        output = self._enum_output(
            self.flight_computer,
            "telemetry_health",
            "Flight computer telemetry reception health",
        )
        source = f"""
var now = Date.now();
if (typeof lastSeq === "undefined") lastSeq = null;
if (typeof lastUptime === "undefined") lastUptime = null;
if (typeof lastProgress === "undefined") lastProgress = null;
var flight = flight_stage.rawValue >= 1 && flight_stage.rawValue <= 4;
var progressed = lastSeq == null || seq.value !== lastSeq || uptime.value !== lastUptime;
if (progressed) {{
  lastProgress = Number(seq.acquisitionTimeMillis || uptime.acquisitionTimeMillis || now);
  if (!isFinite(lastProgress)) lastProgress = now;
}}
var age = lastProgress == null ? Infinity : now - lastProgress;
var status = "UNKNOWN";
if (seq.value !== null && uptime.value !== null) {{
  if (flight && age >= {INACTIVITY_CRITICAL_MS}) status = "CRITICAL";
  else if (age >= {INACTIVITY_WARNING_MS}) status = "DEGRADED";
  else status = "NOMINAL";
}}
lastSeq = seq.value;
lastUptime = uptime.value;
result.value = status;
result.updated = true;
""".strip()
        return self._algorithm(
            self.flight_computer,
            output,
            output.short_description,
            source,
            {
                "seq": FC + "seq",
                "uptime": FC + "fc_time_since_start",
                "flight_stage": FC + "flight_stage",
            },
        )

    def _make_recovery_channel(self, channel: str) -> Y.Algorithm:
        output = self._enum_output(
            self.recovery,
            channel + "_health",
            channel.capitalize() + " recovery channel health",
        )
        deployed_stage = 3 if channel == "drogue" else 4
        inputs = {
            "stage": FC + "flight_stage",
            "armed_hw": FC + channel + "_armed_HW",
            "armed_sw": FC + channel + "_armed_SW",
            "continuity": FC + channel + "_continuity_HW",
            "commanded": FC + channel + "_energized_SW",
            "current": FC + channel + "_energizedCurrent_HW",
            "gate": FC + channel + "_energizedGate_HW",
        }
        source = f"""
var now = Date.now();
if (typeof commandSince === "undefined") commandSince = null;
if (typeof continuityMisses === "undefined") continuityMisses = 0;
if (typeof lastContinuityTime === "undefined") lastContinuityTime = null;
var phase = stage.rawValue;
var required = phase >= 0 && phase < {deployed_stage};
var deployed = phase >= {deployed_stage};
var status = "NOMINAL";
if ((gate.value || current.value) && !commanded.value) status = "CRITICAL";
else {{
  if (commanded.value && commandSince == null) commandSince = now;
  if (!commanded.value) commandSince = null;
  if (commanded.value && now - commandSince >= {ACTUATION_RESPONSE_MS} && (!gate.value || !current.value)) status = "CRITICAL";
  else if (deployed && commanded.value && gate.value && current.value) status = "NOT_APPLICABLE";
  else if (armed_hw.value !== armed_sw.value) status = required && phase > 0 ? "CRITICAL" : "DEGRADED";
  else {{
    if (continuity.acquisitionTimeMillis !== lastContinuityTime) {{
      continuityMisses = continuity.value ? 0 : continuityMisses + 1;
      lastContinuityTime = continuity.acquisitionTimeMillis;
    }}
    if (!continuity.value && continuityMisses >= 2) status = required && (armed_hw.value || armed_sw.value) ? "CRITICAL" : "DEGRADED";
  }}
}}
result.value = status;
result.updated = true;
""".strip()
        return self._algorithm(self.recovery, output, output.short_description, source, inputs)

    def _make_recovery_readiness(self) -> Y.Algorithm:
        output = self._enum_output(
            self.recovery,
            "readiness",
            "Phase-aware recovery system readiness",
            READINESS_CHOICES,
        )
        inputs = {"stage": FC + "flight_stage"}
        for channel in ("drogue", "main"):
            for name in ("armed_HW", "armed_SW", "continuity_HW", "energized_SW", "energizedCurrent_HW", "energizedGate_HW"):
                inputs[channel + "_" + name] = FC + channel + "_" + name
        source = """
var phase = stage.rawValue;
function agreement(prefix) {
  return prefix.sw.value === prefix.gate.value && prefix.sw.value === prefix.current.value;
}
var drogue = {sw:drogue_energized_SW, gate:drogue_energizedGate_HW, current:drogue_energizedCurrent_HW};
var main = {sw:main_energized_SW, gate:main_energizedGate_HW, current:main_energizedCurrent_HW};
var premature = (phase < 3 && (drogue.sw.value || drogue.gate.value || drogue.current.value)) ||
  (phase < 4 && (main.sw.value || main.gate.value || main.current.value));
var status = "UNKNOWN";
if (phase !== null) {
  if (premature || !agreement(drogue) || !agreement(main)) status = "FAULT";
  else if (phase <= 2) {
    var ready = drogue_armed_HW.value && drogue_armed_SW.value && drogue_continuity_HW.value &&
      main_armed_HW.value && main_armed_SW.value && main_continuity_HW.value;
    status = ready ? "READY" : "NOT_READY";
  } else if (phase === 3) {
    status = drogue.sw.value && main_armed_HW.value && main_armed_SW.value && main_continuity_HW.value ? "ACTIVE" : "FAULT";
  } else if (phase === 4) status = main.sw.value ? "ACTIVE" : "FAULT";
  else if (phase === 5) status = "COMPLETE";
  else status = "FAULT";
}
result.value = status;
result.updated = true;
""".strip()
        return self._algorithm(self.recovery, output, output.short_description, source, inputs)

    def _make_valve_health(self, valve: str) -> Y.Algorithm:
        names = {
            "mov": ("mov_armed_electrical_HW", "mov_armed_logical_SW"),
            "fdov": ("fdov_armed_HW", "fdov_armed_SW"),
            "vent": ("vent_armed_HW", "vent_armed_SW"),
        }
        armed_hw, armed_sw = names[valve]
        output = self._enum_output(
            self.propulsion,
            valve + "_health",
            valve.upper() + " valve actuation health",
        )
        source = f"""
var now = Date.now();
if (typeof commandSince === "undefined") commandSince = null;
var required = stage.rawValue === 0 || stage.rawValue === 1;
var status = "NOMINAL";
if ((gate.value || current.value) && !commanded.value) status = "CRITICAL";
else {{
  if (commanded.value && commandSince == null) commandSince = now;
  if (!commanded.value) commandSince = null;
  if (commanded.value && now - commandSince >= {ACTUATION_RESPONSE_MS} && (!gate.value || !current.value)) status = "CRITICAL";
  else if (commanded.value && now - commandSince >= {VALVE_TRAVEL_MS} && !open.value) status = "CRITICAL";
  else if (armed_hw.value !== armed_sw.value) status = required ? "CRITICAL" : "DEGRADED";
  else if (required && !continuity.value) status = "CRITICAL";
}}
result.value = status;
result.updated = true;
""".strip()
        return self._algorithm(
            self.propulsion,
            output,
            output.short_description,
            source,
            {
                "stage": FC + "flight_stage",
                "armed_hw": FC + armed_hw,
                "armed_sw": FC + armed_sw,
                "continuity": FC + valve + "_continuity_HW",
                "commanded": FC + valve + "_energized_SW",
                "current": FC + valve + "_energizedCurrent_HW",
                "gate": FC + valve + "_energizedGate_HW",
                "open": FC + valve + "_open",
            },
        )

    def _make_propulsion_readiness(self) -> Y.Algorithm:
        output = self._enum_output(
            self.propulsion,
            "readiness",
            "Phase-aware propulsion system readiness",
            READINESS_CHOICES,
        )
        inputs = {"stage": FC + "flight_stage", "power": FC + "prop_energized_electric"}
        for valve, arms in {
            "mov": ("mov_armed_electrical_HW", "mov_armed_logical_SW"),
            "fdov": ("fdov_armed_HW", "fdov_armed_SW"),
            "vent": ("vent_armed_HW", "vent_armed_SW"),
        }.items():
            inputs[valve + "_hw"] = FC + arms[0]
            inputs[valve + "_sw"] = FC + arms[1]
            for suffix in ("continuity_HW", "energized_SW", "energizedCurrent_HW", "energizedGate_HW", "open"):
                inputs[valve + "_" + suffix] = FC + valve + "_" + suffix
        source = """
var phase = stage.rawValue;
var unexpected = (mov_energizedCurrent_HW.value && !mov_energized_SW.value) ||
  (fdov_energizedCurrent_HW.value && !fdov_energized_SW.value) ||
  (vent_energizedCurrent_HW.value && !vent_energized_SW.value);
var drive = mov_energizedGate_HW.value || fdov_energizedGate_HW.value || vent_energizedGate_HW.value;
var status = "UNKNOWN";
if (phase !== null) {
  if (unexpected) status = "FAULT";
  else if (phase === 0) {
    var ready = power.value && mov_hw.value && mov_sw.value && mov_continuity_HW.value &&
      fdov_hw.value && fdov_sw.value && fdov_continuity_HW.value &&
      vent_hw.value && vent_sw.value && vent_continuity_HW.value;
    status = ready ? "READY" : "NOT_READY";
  } else if (phase === 1) status = power.value ? "ACTIVE" : "FAULT";
  else status = !power.value && !drive ? "NOT_REQUIRED" : "FAULT";
}
result.value = status;
result.updated = true;
""".strip()
        return self._algorithm(self.propulsion, output, output.short_description, source, inputs)

    def _make_navigation_health(self) -> Y.Algorithm:
        output = self._enum_output(
            self.navigation,
            "solution_health",
            "GPS navigation solution health",
        )
        source = f"""
var phase = stage.rawValue;
var inFlight = phase >= 1 && phase <= 4;
var fix = fix_type.rawValue;
var status = "UNKNOWN";
if (typeof goodFixes === "undefined") goodFixes = 0;
if (typeof lastFixTime === "undefined") lastFixTime = null;
if (fix !== null && age.value !== null) {{
  if (age.value > {GPS_CRITICAL_AGE}) status = "CRITICAL";
  else if (!locked.value || !fix_ok.value || fix === 0 || fix === 5) status = inFlight ? "CRITICAL" : "DEGRADED";
  else if (fix === 1 || fix === 2 || age.value > {GPS_WARNING_AGE}) status = "DEGRADED";
  else if (fix === 3 || fix === 4) status = "NOMINAL";
}}
if (status === "NOMINAL" && fix_ok.acquisitionTimeMillis !== lastFixTime) goodFixes += 1;
else if (status !== "NOMINAL") goodFixes = 0;
lastFixTime = fix_ok.acquisitionTimeMillis;
if (status === "NOMINAL" && goodFixes < 3) status = "DEGRADED";
result.value = status;
result.updated = true;
""".strip()
        return self._algorithm(
            self.navigation,
            output,
            output.short_description,
            source,
            {
                "stage": FC + "flight_stage",
                "locked": FC + "gps_locked",
                "fix_ok": FC + "gps_fix_ok",
                "fix_type": FC + "gps_fix_type",
                "age": FC + "gps_time_last_update",
            },
        )

    def _make_storage_health(self) -> Y.Algorithm:
        output = self._enum_output(
            self.storage,
            "recording_health",
            "Onboard SD recording state",
            READINESS_CHOICES,
        )
        source = """
var phase = stage.rawValue;
var status = "UNKNOWN";
if (phase !== null) {
  if (phase >= 1 && phase <= 4 && deletion.value) status = "FAULT";
  else if (phase >= 1 && phase <= 4 && !file_open.value) status = "FAULT";
  else if (phase === 0 && deletion.value) status = "NOT_READY";
  else if (phase === 0 && file_open.value) status = "READY";
  else if (phase >= 1 && phase <= 4) status = "ACTIVE";
  else if (phase === 5) status = file_open.value ? "ACTIVE" : "COMPLETE";
  else status = "NOT_REQUIRED";
}
result.value = status;
result.updated = true;
""".strip()
        return self._algorithm(
            self.storage,
            output,
            output.short_description,
            source,
            {
                "stage": FC + "flight_stage",
                "file_open": FC + "sd_card_file_open",
                "deletion": FC + "sd_card_deletion_armed",
            },
        )

    def _make_radio_health(self, location: str, system: Y.System) -> Y.Algorithm:
        output = self._enum_output(system, "link_health", location + " radio link health")
        radio = f"/SystemA/{location}/Radio/"
        source = f"""
var now = Date.now();
if (typeof lastSequence === "undefined") lastSequence = null;
if (typeof lastProgress === "undefined") lastProgress = null;
var flight = stage.rawValue >= 1 && stage.rawValue <= 4;
var progressed = lastSequence == null || sequence.value !== lastSequence;
if (progressed) {{
  lastProgress = Number(sequence.acquisitionTimeMillis || now);
  if (!isFinite(lastProgress)) lastProgress = now;
}}
var age = lastProgress == null ? Infinity : now - lastProgress;
var status = "UNKNOWN";
if (sequence.value !== null) {{
  if (flight && age >= {INACTIVITY_CRITICAL_MS}) status = "CRITICAL";
  else if (age >= {INACTIVITY_WARNING_MS}) status = "DEGRADED";
  else status = "NOMINAL";
}}
lastSequence = sequence.value;
result.value = status;
result.updated = true;
""".strip()
        return self._algorithm(
            system,
            output,
            output.short_description,
            source,
            {
                "sequence": radio + "sequenceNumber",
                "rssi": radio + "RSSI",
                "snr": radio + "SNR",
                "temperature": radio + "cpu_temperature",
                "stage": FC + "flight_stage",
            },
        )

    def _make_communications_capability(self) -> Y.Algorithm:
        output = self._enum_output(
            self.communications,
            "capability",
            "End-to-end SystemA communications capability",
        )
        source = """
var status = "UNKNOWN";
if (fc.value !== null && control.value !== null && pad.value !== null) {
  if (fc.value === "CRITICAL" || (control.value === "CRITICAL" && pad.value === "CRITICAL")) status = "CRITICAL";
  else if (fc.value !== "NOMINAL" || control.value !== "NOMINAL" || pad.value !== "NOMINAL") status = "DEGRADED";
  else status = "NOMINAL";
}
result.value = status;
result.updated = true;
""".strip()
        return self._algorithm(
            self.communications,
            output,
            output.short_description,
            source,
            {
                "fc": "/SystemA/Derived/Rocket/FlightComputer/telemetry_health",
                "control": "/SystemA/Derived/ControlStation/Radio/link_health",
                "pad": "/SystemA/Derived/Pad/Radio/link_health",
                "stage": FC + "flight_stage",
            },
        )

    def generate_system(self):
        self._make_operational_health()
        self._make_telemetry_health()
        self._make_recovery_channel("drogue")
        self._make_recovery_channel("main")
        self._make_recovery_readiness()
        for valve in ("mov", "fdov", "vent"):
            self._make_valve_health(valve)
        self._make_propulsion_readiness()
        self._make_navigation_health()
        self._make_storage_health()
        self._make_radio_health("ControlStation", self.control_station_radio)
        self._make_radio_health("Pad", self.pad_radio)
        self._make_communications_capability()
