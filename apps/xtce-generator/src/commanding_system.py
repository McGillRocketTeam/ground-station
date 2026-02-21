# Imports
from typing import Dict, Any
import yamcs.pymdb as Y

from flight_system import FlightSystem

class CommandingSystem(FlightSystem):
    SHEET_ID = "1Ukaums3NfbJdVOQL7E1QMyPNoQ7gD5Zxciiz4ucRUrk"
    COMMANDS_GID = "1257549045"

    def __init__(
            self,
            output_path: str,
            # param_dict: Dict[str, Any] | None,
            sheet_id: str = "1Ukaums3NfbJdVOQL7E1QMyPNoQ7gD5Zxciiz4ucRUrk",
            command_gid: str = "1257549045",
            row_buffer: int = 1,
            col_buffer: int = 0
        ):
        self.sys = Y.System("FlightComputer")

        self.output_path = output_path
        self.sheet_id = sheet_id
        self.command_gid = command_gid
        self.row_buffer = row_buffer
        self.col_buffer = col_buffer

        # self.param_dict = param_dict

    @staticmethod
    def set_command_arguments(command: Y.Command, arguments: str):
        if arguments == "None":
            return

        for string in [s.strip() for s in arguments.split(",")]:
            name, type_name = string.split(":")
            name = name.strip()
            type_name = type_name.strip()
            match type_name.lower():
                case "boolean":
                    encoding = Y.IntegerEncoding(bits=1)
                    arg = Y.BooleanArgument(name=name, encoding=encoding)
                    command.arguments.append(arg)
                case _:
                    raise ValueError(f"Unknown argument type: {type_name}")

    @staticmethod
    def get_command_significance(significance: str):
        """
        Sets command significance to respective XTCE significance level
        """
        match significance.lower():
            case "watch":
                return Y.CommandSignificance.WATCH
            case "warning":
                return Y.CommandSignificance.WARNING
            case "distress":
                return Y.CommandSignificance.DISTRESS
            case "critical":
                return Y.CommandSignificance.CRITICAL
            case "severe":
                return Y.CommandSignificance.SEVERE
            case "none":
                return Y.CommandSignificance.NONE
            case _:
                raise ValueError(f"Unhandled significance level '{significance}'")

    @staticmethod
    def get_command_constraints(constraints: str, params: dict[str, Any]):
        if constraints == "":
            return None

        if not params:
            return None

        constraint_entries = []
        for constraint in constraints.split(","):
            param, val = tuple(constraint.split("="))
            param_name = param.strip()
            if param_name not in params:
                continue
            constraint_entries.append(
                Y.TransmissionConstraint(
                    expression=Y.eq(ref=params[param_name], value=val.strip()), timeout=0
                )
            )
        return constraint_entries if constraint_entries else None

    def make_command(self, cmd: dict[str, Any]): # params: dict[str, Any]
        name = cmd["Variable Name"]
        command_id = cmd["ID"]
        command_name = cmd["Title"]
        significance = CommandingSystem.get_command_significance(cmd["Significance"])
        # constraints = self.get_command_constraints(cmd["Transmission Constraints"], params)

        command = Y.Command(
            system=self.sys,
            name=name,
            short_description=command_id,
            long_description=command_name,
            significance=significance,
            # constraint=constraints,
        )

        CommandingSystem.set_command_arguments(command, cmd["Arguments"])
        return command

    def create_commands(self):
        commands = []
        command_data = CommandingSystem.load_sheet_rows(
            self.sheet_id, self.command_gid, self.col_buffer, self.row_buffer
        )

        # if self.param_dict is None:
        #     self.param_dict = {}

        for cmd in command_data:
            if cmd["Variable Name"]:
                command = self.make_command(cmd=cmd) # params=self.param_dict
                commands.append(command)
        return commands

    def generate_system(self):
        print(" - Creating Commands...")
        commands = self.create_commands()
        print(f"   Created {len(commands)} Commands")