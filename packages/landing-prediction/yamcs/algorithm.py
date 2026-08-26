# This file is an algorithm body, not a standalone Python module. The XTCE
# generator prepends the reusable predictor classes before embedding it.

global _landing_predictor_states

try:
    _landing_predictor_states
except NameError:
    _landing_predictor_states = {}

# Each mounted copy of rocket.xml receives distinct Yamcs input binding objects.
# Their identity keeps System A and System B histories separate even though the
# Python script engine is shared by all algorithms in a processor.
state_key = id(gps_latitude)
state = _landing_predictor_states.get(state_key)
if state is None:
    state = {
        "predictor": LandingPredictor(),
        "timestamps": {},
    }
    _landing_predictor_states[state_key] = state


def updated_value(binding, name, transform=None):
    """Return a value only when Yamcs reports a new parameter generation time."""
    if binding.value is None:
        return None
    timestamp = binding.generationTimeMillis
    if state["timestamps"].get(name) == timestamp:
        return None
    state["timestamps"][name] = timestamp
    value = binding.value
    return transform(value) if transform is not None else value


latitude = updated_value(gps_latitude, "gps_latitude")
longitude = updated_value(gps_longitude, "gps_longitude")
altitude_agl_m = updated_value(
    barometer_altitude_from_pad,
    "barometer_altitude_from_pad",
    lambda feet: feet * 0.3048,
)
vertical_speed_mps = updated_value(
    vertical_speed,
    "vertical_speed",
    lambda feet_per_second: feet_per_second * 0.3048,
)
stage = updated_value(flight_stage, "flight_stage")
main_fired = updated_value(main_energized_SW, "main_energized_SW")

changed_times = [
    binding.generationTimeMillis
    for binding in (
        gps_latitude,
        gps_longitude,
        barometer_altitude_from_pad,
        vertical_speed,
        flight_stage,
        main_energized_SW,
    )
    if binding.value is not None
    and state["timestamps"].get("algorithm_time_" + str(id(binding)))
    != binding.generationTimeMillis
]
for binding in (
    gps_latitude,
    gps_longitude,
    barometer_altitude_from_pad,
    vertical_speed,
    flight_stage,
    main_energized_SW,
):
    if binding.value is not None:
        state["timestamps"]["algorithm_time_" + str(id(binding))] = (
            binding.generationTimeMillis
        )

if changed_times:
    state["predictor"].update(
        max(changed_times) / 1000.0,
        latitude=latitude,
        longitude=longitude,
        altitude_agl_m=altitude_agl_m,
        vertical_speed_mps=vertical_speed_mps,
        stage=stage,
        main_fired=main_fired,
    )

result = state["predictor"].predict()
if result is None:
    predicted_location_latitude.updated = False
    predicted_location_longitude.updated = False
    predicted_location_accuracy.updated = False
else:
    predicted_location_latitude.value = result["predicted_location"]["latitude"]
    predicted_location_longitude.value = result["predicted_location"]["longitude"]
    predicted_location_accuracy.value = result["predicted_location_accuracy"]
    predicted_location_latitude.updated = True
    predicted_location_longitude.updated = True
    predicted_location_accuracy.updated = True
