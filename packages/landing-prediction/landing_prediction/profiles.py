"""Named vehicle profiles kept separate from flight replay fixtures."""

from landing_prediction.config import LandingPredictionConfig


def luminor_simulation_config(**overrides):
    """Return parameters from the current Project Luminor simulation report.

    These values do not describe the rocket flown at URRG. Recovery descent
    rates and deployment altitude are not present in the supplied report, so
    they retain the generic first-pass assumptions unless explicitly overridden.
    """
    values = {
        "vehicle_name": "Project Luminor",
        "simulation_revision": "Tables 4.1 and 5.1",
        "recovery_configuration": "Dual separation, dual deployment",
        "dry_mass_kg": 50.4,
        "wet_mass_kg": 65.4,
        "vehicle_length_m": 4.04,
        "airframe_diameter_m": 0.206,
        "predicted_apogee_m": 4152.0,
        "maximum_velocity_mps": 291.0,
        "maximum_acceleration_g": 7.42,
        "burn_time_s": 15.0,
        "total_impulse_ns": 24548.0,
        "peak_thrust_n": 5240.0,
        "effective_rail_length_m": 8.57,
        "rail_departure_velocity_mps": 32.3,
    }
    values.update(overrides)
    return LandingPredictionConfig(**values)
