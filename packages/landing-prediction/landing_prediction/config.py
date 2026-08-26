"""Vehicle-independent model parameters for landing prediction.

Keep numerical values in SI units. Vehicle profiles can attach simulation
context to this configuration, but the defaults do not describe a particular
rocket. This is important because the URRG replay fixture and Project Luminor
simulation report describe different vehicles.
"""


class LandingPredictionConfig(object):
    """All changeable assumptions used or retained by the predictor.

    Keyword arguments may override any known parameter. Rejecting unknown names
    catches misspellings that could otherwise silently leave an old value in
    use. This class avoids dataclasses and type annotations for Yamcs Jython
    2.7.4 compatibility.
    """

    # Optional vehicle simulation context. The first-pass model does not use
    # these values yet, so an unknown value is safer than a misleading default.
    vehicle_name = None
    simulation_revision = None
    recovery_configuration = None
    dry_mass_kg = None
    wet_mass_kg = None
    vehicle_length_m = None
    airframe_diameter_m = None
    predicted_apogee_m = None
    maximum_velocity_mps = None
    maximum_acceleration_g = None
    burn_time_s = None
    total_impulse_ns = None
    peak_thrust_n = None
    effective_rail_length_m = None
    rail_departure_velocity_mps = None

    # Recovery assumptions. Replace these with current recovery simulations.
    main_deployment_agl_m = 450.0
    nominal_main_descent_mps = 8.0
    main_effective_speed_multiplier = 1.8

    # Estimation windows and validity thresholds.
    gps_window_s = 12.0
    altitude_window_s = 4.0
    minimum_descent_speed_mps = 1.0
    maximum_history_points = 80

    # Conservative uncertainty model. These are not calibrated probabilities.
    base_gps_uncertainty_m = 25.0
    fit_error_multiplier = 2.0
    remaining_time_fractional_uncertainty = 0.20
    unobserved_horizontal_velocity_mps = 3.5
    minimum_accuracy_m = 50.0
    reported_vertical_speed_fallback_error_m = 10.0
    effective_main_time_uncertainty_s = 2.0
    ineffective_main_time_uncertainty_fraction = 0.35
    future_main_time_uncertainty_fraction = 0.40

    def __init__(self, **overrides):
        for name, value in overrides.items():
            if not hasattr(self, name) or name.startswith("_"):
                raise ValueError("Unknown landing prediction parameter: %s" % name)
            setattr(self, name, value)
