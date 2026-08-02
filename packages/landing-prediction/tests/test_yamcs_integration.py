import importlib.util
import os
import xml.etree.ElementTree as ElementTree
import unittest


PACKAGE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKSPACE_DIR = os.path.dirname(os.path.dirname(PACKAGE_DIR))
GENERATOR_MODULE_PATH = os.path.join(
    WORKSPACE_DIR,
    "apps",
    "xtce-generator",
    "src",
    "landing_prediction_algorithm.py",
)
ROCKET_XML_PATH = os.path.join(
    WORKSPACE_DIR,
    "apps",
    "backend",
    "src",
    "main",
    "yamcs",
    "mdb",
    "rocket.xml",
)


def _load_generator_module():
    spec = importlib.util.spec_from_file_location(
        "landing_prediction_algorithm", GENERATOR_MODULE_PATH
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class YamcsIntegrationTest(unittest.TestCase):
    def test_generated_algorithm_body_is_valid_python(self):
        body = _load_generator_module().landing_prediction_algorithm_text()
        arguments = (
            "gps_latitude, gps_longitude, barometer_altitude_from_pad, "
            "vertical_speed, flight_stage, main_energized_SW, "
            "predicted_location_latitude, predicted_location_longitude, "
            "predicted_location_accuracy"
        )
        source = "def landing_prediction(%s):\n%s" % (
            arguments,
            "\n".join("    " + line for line in body.splitlines()),
        )
        compile(source, "landing_prediction", "exec")

    def test_deployed_xtce_contains_outputs_and_python_algorithm(self):
        root = ElementTree.parse(ROCKET_XML_PATH).getroot()
        namespace = {"xtce": "http://www.omg.org/spec/XTCE/20180204"}
        algorithm = root.find(
            ".//xtce:CustomAlgorithm[@name='landing_prediction']", namespace
        )

        self.assertIsNotNone(algorithm)
        text = algorithm.find("xtce:AlgorithmText", namespace)
        self.assertEqual(text.attrib["language"], "python")

        output_names = {
            output.attrib["parameterRef"]
            for output in algorithm.findall(
                "xtce:OutputSet/xtce:OutputParameterRef", namespace
            )
        }
        self.assertEqual(
            output_names,
            {
                "predicted_location_latitude",
                "predicted_location_longitude",
                "predicted_location_accuracy",
            },
        )


if __name__ == "__main__":
    unittest.main()
