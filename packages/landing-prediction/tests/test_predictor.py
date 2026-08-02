import csv
import datetime
import math
import os
import sys
import unittest


PACKAGE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PACKAGE_DIR)

from landing_prediction import (
    LandingPredictionConfig,
    LandingPredictor,
    luminor_simulation_config,
)


FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "urrg.csv")
PREFIX = "/SystemB/Rocket/FlightComputer/"
LANDING_LOCATION = (42.707226, -77.20371)


def _number(row, name):
    value = row[PREFIX + name]
    return float(value) if value else None


def _boolean(row, name):
    value = row[PREFIX + name]
    return value.lower() == "true" if value else None


def _timestamp_seconds(value):
    parsed = datetime.datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%fZ")
    epoch = datetime.datetime(1970, 1, 1)
    return (parsed - epoch).total_seconds()


def _distance_m(first, second):
    latitude_scale = 111195.0
    longitude_scale = latitude_scale * math.cos(math.radians(first[0]))
    north_m = (second[0] - first[0]) * latitude_scale
    east_m = (second[1] - first[1]) * longitude_scale
    return math.sqrt(north_m ** 2 + east_m ** 2)


def predict_at(cutoff):
    predictor = LandingPredictor()
    with open(FIXTURE_PATH, "r", newline="") as fixture:
        for row in csv.DictReader(fixture):
            if row["Time"] > cutoff:
                break

            stage = row[PREFIX + "flight_stage"] or None
            main_fired = _boolean(row, "main_energized_SW")
            predictor.update(
                _timestamp_seconds(row["Time"]),
                latitude=_number(row, "gps_latitude"),
                longitude=_number(row, "gps_longitude"),
                # The URRG barometric AGL parameter is recorded in feet.
                altitude_agl_m=(
                    _number(row, "barometer_altitude_from_pad") * 0.3048
                    if row[PREFIX + "barometer_altitude_from_pad"]
                    else None
                ),
                vertical_speed_mps=(
                    _number(row, "vertical_speed") * 0.3048
                    if row[PREFIX + "vertical_speed"]
                    else None
                ),
                stage=stage,
                main_fired=main_fired,
            )
    return predictor.predict()


class LandingPredictorTest(unittest.TestCase):
    def test_configuration_rejects_unknown_parameters(self):
        with self.assertRaises(ValueError):
            LandingPredictionConfig(main_deploy_altitude=500.0)

    def test_luminor_parameters_are_an_explicit_profile(self):
        generic = LandingPredictionConfig()
        luminor = luminor_simulation_config(main_deployment_agl_m=500.0)

        self.assertIsNone(generic.vehicle_name)
        self.assertEqual(luminor.vehicle_name, "Project Luminor")
        self.assertEqual(luminor.dry_mass_kg, 50.4)
        self.assertEqual(luminor.predicted_apogee_m, 4152.0)
        self.assertEqual(luminor.main_deployment_agl_m, 500.0)

    def test_rejects_zero_gps(self):
        predictor = LandingPredictor()
        predictor.update(1.0, latitude=0.0, longitude=0.0, altitude_agl_m=100.0)
        self.assertIsNone(predictor.predict())

    def test_urrg_prediction_during_drogue_descent(self):
        result = predict_at("2026-03-28T18:17:30.000Z")
        self.assertIsNotNone(result)

        location = result["predicted_location"]
        error_m = _distance_m(
            (location["latitude"], location["longitude"]), LANDING_LOCATION
        )
        self.assertLess(error_m, 1000.0)
        self.assertLess(result["predicted_location_accuracy"], 1500.0)
        self.assertLess(error_m, result["predicted_location_accuracy"])

    def test_urrg_prediction_after_ineffective_main(self):
        result = predict_at("2026-03-28T18:17:46.000Z")
        self.assertIsNotNone(result)

        location = result["predicted_location"]
        error_m = _distance_m(
            (location["latitude"], location["longitude"]), LANDING_LOCATION
        )
        self.assertLess(error_m, 100.0)
        self.assertLess(result["predicted_location_accuracy"], 500.0)
        self.assertLess(error_m, result["predicted_location_accuracy"])


if __name__ == "__main__":
    unittest.main()
