# Imports
import argparse

from telemetry_system import TelemetrySystem
from commanding_system import CommandingSystem

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate FlightComputer Telemetry and Commanding Yamcs XML from Google Sheets"
    )
    parser.add_argument(
        "-ot",
        "--output-telemetry-xml",
        help="Path to output telemetry XML file (default: rocket.xml)",
        default="rocket.xml",
    )
    parser.add_argument(
        "-oc",
        "--output-commanding-xml",
        help="Path to output commanding XML file (default: commands.xml)",
        default="commands.xml",
    )
    args = parser.parse_args()

    telemetry_output_path = args.output_telemetry_xml
    commanding_output_path = args.output_commanding_xml

    print("Creating Yamcs Telemetry System...")
    telemetry_sys = TelemetrySystem(
        output_path=telemetry_output_path
    )
    telemetry_sys.generate_system()
    print("Yamcs Telemetry System Created Successfully\n")


    print("Creating Yamcs Commanding System...")
    commanding_sys = CommandingSystem(
        output_path=commanding_output_path
        # param_dict=telemetry_sys.param_dict
    )
    commanding_sys.generate_system()
    print("Yamcs Commanding System Created Successfully\n")

    print("Generating Telemetry XML...")
    telemetry_sys.write_system()
    print("Telemetry XML Generated Successfully\n")

    print("Generating Commanding XML...")
    commanding_sys.write_system()
    print("Commanding XML Generated Successfully\n")

if __name__ == "__main__":
    main()