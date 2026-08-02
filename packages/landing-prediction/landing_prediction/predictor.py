"""Small, dependency-free rocket landing predictor.

This module intentionally uses Python 2.7-compatible syntax so the same code can
be loaded as a Yamcs Jython user library. The eventual Yamcs algorithm only needs
to retain one ``LandingPredictor`` instance, pass new parameter values to
``update``, and copy the two values returned by ``predict`` to its outputs.

The model is deliberately modest:

* recent GPS fixes provide horizontal ground velocity;
* recent altitude samples provide vertical velocity;
* remaining altitude divided by descent rate provides time to landing; and
* horizontal velocity multiplied by that time provides the landing offset.

It is a search aid, not a flight dynamics simulation. In particular it cannot
observe future wind shear, canopy behavior, or terrain. ``accuracy_m`` is a
conservative search radius assembled from observed fit errors and fixed model
allowances. It is not yet a statistically calibrated confidence interval.
"""

from __future__ import division

import math

from landing_prediction.config import LandingPredictionConfig


EARTH_RADIUS_M = 6371000.0


def _is_finite(value):
    return value is not None and not math.isnan(value) and not math.isinf(value)


def _linear_fit(points):
    """Return ``(slope, residual_rms)`` for ``(time, value)`` points."""
    count = len(points)
    if count < 2:
        return None

    mean_time = sum(point[0] for point in points) / count
    mean_value = sum(point[1] for point in points) / count
    denominator = sum((point[0] - mean_time) ** 2 for point in points)
    if denominator <= 0.0:
        return None

    slope = sum(
        (point[0] - mean_time) * (point[1] - mean_value) for point in points
    ) / denominator
    intercept = mean_value - slope * mean_time
    residual_rms = math.sqrt(
        sum((point[1] - (intercept + slope * point[0])) ** 2 for point in points)
        / count
    )
    return slope, residual_rms


def _recent(points, window_s):
    if not points:
        return []
    cutoff = points[-1][0] - window_s
    return [point for point in points if point[0] >= cutoff]


class LandingPredictor(object):
    """Accumulate telemetry and estimate a possible landing region.

    Inputs to ``update`` must already use metres, seconds, and metres per second.
    Supplying ``None`` means that parameter did not update. Yamcs parameter
    timestamps should be used for ``time_s`` rather than wall-clock execution
    time so stale values do not look like fresh measurements.

    Vehicle and recovery assumptions are supplied through
    ``LandingPredictionConfig`` and should be updated as simulations improve.
    """

    def __init__(self, config=None):
        self.config = config or LandingPredictionConfig()
        self._gps = []
        self._altitude = []
        self._reported_vertical_speed_mps = None
        self._stage = None
        self._main_fired = False

    def update(
        self,
        time_s,
        latitude=None,
        longitude=None,
        altitude_agl_m=None,
        vertical_speed_mps=None,
        stage=None,
        main_fired=None,
    ):
        """Record only telemetry values that were updated at ``time_s``."""
        if not _is_finite(time_s):
            return

        if self._valid_gps(latitude, longitude):
            gps_point = (float(time_s), float(latitude), float(longitude))
            if not self._gps or (
                gps_point[0] > self._gps[-1][0]
                and gps_point[1:] != self._gps[-1][1:]
            ):
                self._gps.append(gps_point)
                self._gps = self._gps[-self.config.maximum_history_points :]

        if _is_finite(altitude_agl_m):
            altitude_point = (float(time_s), max(0.0, float(altitude_agl_m)))
            if not self._altitude or (
                altitude_point[0] > self._altitude[-1][0]
                and altitude_point[1] != self._altitude[-1][1]
            ):
                self._altitude.append(altitude_point)
                self._altitude = self._altitude[
                    -self.config.maximum_history_points :
                ]

        if _is_finite(vertical_speed_mps):
            self._reported_vertical_speed_mps = float(vertical_speed_mps)
        if stage is not None:
            self._stage = str(stage).lower()
        if main_fired is not None:
            self._main_fired = self._main_fired or bool(main_fired)

    def predict(self):
        """Return the two intended Yamcs output values, or ``None``.

        The return shape maps directly to the requested output parameters:

        ``predicted_location``
            A latitude/longitude aggregate.

        ``predicted_location_accuracy``
            An uncalibrated conservative search radius in metres.
        """
        if not self._gps or not self._altitude:
            return None

        horizontal = self._horizontal_velocity()
        vertical = self._descent_rate()
        if (
            horizontal is None
            or vertical is None
            or vertical[0] < self.config.minimum_descent_speed_mps
        ):
            return None

        east_mps, north_mps, horizontal_fit_error_m = horizontal
        descent_mps, altitude_fit_error_m = vertical
        altitude_agl_m = self._altitude[-1][1]
        remaining_time_s, configuration_uncertainty_s = self._remaining_time(
            altitude_agl_m, descent_mps
        )

        east_offset_m = east_mps * remaining_time_s
        north_offset_m = north_mps * remaining_time_s
        latitude, longitude = self._offset_location(east_offset_m, north_offset_m)

        speed_mps = math.sqrt(east_mps ** 2 + north_mps ** 2)
        time_uncertainty_s = (
            configuration_uncertainty_s
            + altitude_fit_error_m
            / max(descent_mps, self.config.minimum_descent_speed_mps)
            + remaining_time_s
            * self.config.remaining_time_fractional_uncertainty
        )
        accuracy_m = (
            self.config.base_gps_uncertainty_m
            + horizontal_fit_error_m * self.config.fit_error_multiplier
            + speed_mps * time_uncertainty_s
            + remaining_time_s * self.config.unobserved_horizontal_velocity_mps
        )

        return {
            "predicted_location": {
                "latitude": latitude,
                "longitude": longitude,
            },
            "predicted_location_accuracy": max(
                self.config.minimum_accuracy_m, accuracy_m
            ),
        }

    def _horizontal_velocity(self):
        points = _recent(self._gps, self.config.gps_window_s)
        if len(points) < 3:
            return None

        reference_latitude = points[-1][1]
        reference_longitude = points[-1][2]
        latitude_radians = math.radians(reference_latitude)
        east_points = []
        north_points = []
        for time_s, latitude, longitude in points:
            north_m = math.radians(latitude - reference_latitude) * EARTH_RADIUS_M
            east_m = (
                math.radians(longitude - reference_longitude)
                * EARTH_RADIUS_M
                * math.cos(latitude_radians)
            )
            east_points.append((time_s, east_m))
            north_points.append((time_s, north_m))

        east_fit = _linear_fit(east_points)
        north_fit = _linear_fit(north_points)
        if east_fit is None or north_fit is None:
            return None
        fit_error_m = math.sqrt(east_fit[1] ** 2 + north_fit[1] ** 2)
        return east_fit[0], north_fit[0], fit_error_m

    def _descent_rate(self):
        points = _recent(self._altitude, self.config.altitude_window_s)
        fit = _linear_fit(points)
        if (
            fit is not None
            and fit[0] < -self.config.minimum_descent_speed_mps
        ):
            return -fit[0], fit[1]

        if (
            self._reported_vertical_speed_mps is not None
            and self._reported_vertical_speed_mps
            < -self.config.minimum_descent_speed_mps
        ):
            return (
                -self._reported_vertical_speed_mps,
                self.config.reported_vertical_speed_fallback_error_m,
            )
        return None

    def _remaining_time(self, altitude_agl_m, descent_mps):
        main_is_effective = descent_mps <= (
            self.config.nominal_main_descent_mps
            * self.config.main_effective_speed_multiplier
        )
        main_expected = self._main_fired or (
            self._stage is not None and "main" in self._stage
        )

        if main_is_effective:
            return (
                altitude_agl_m / descent_mps,
                self.config.effective_main_time_uncertainty_s,
            )

        if main_expected or altitude_agl_m <= self.config.main_deployment_agl_m:
            # Main was expected but no aerodynamic slowdown is visible.
            remaining = altitude_agl_m / descent_mps
            return (
                remaining,
                remaining * self.config.ineffective_main_time_uncertainty_fraction,
            )

        drogue_altitude_m = altitude_agl_m - self.config.main_deployment_agl_m
        drogue_time_s = drogue_altitude_m / descent_mps
        main_time_s = (
            self.config.main_deployment_agl_m
            / self.config.nominal_main_descent_mps
        )
        return (
            drogue_time_s + main_time_s,
            main_time_s * self.config.future_main_time_uncertainty_fraction,
        )

    def _offset_location(self, east_m, north_m):
        latitude = self._gps[-1][1]
        longitude = self._gps[-1][2]
        predicted_latitude = latitude + math.degrees(north_m / EARTH_RADIUS_M)
        longitude_scale = EARTH_RADIUS_M * math.cos(math.radians(latitude))
        predicted_longitude = longitude + math.degrees(east_m / longitude_scale)
        return predicted_latitude, predicted_longitude

    @staticmethod
    def _valid_gps(latitude, longitude):
        if not _is_finite(latitude) or not _is_finite(longitude):
            return False
        if latitude == 0.0 and longitude == 0.0:
            return False
        return -90.0 <= latitude <= 90.0 and -180.0 <= longitude <= 180.0
