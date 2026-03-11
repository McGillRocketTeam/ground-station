# Imports
from typing import Any
from itertools import islice
import yamcs.pymdb as Y

from flight_system import FlightSystem


class TelemetrySystem(FlightSystem):
    def __init__(
        self,
        output_path: str,
        sheet_id: str = "1Ukaums3NfbJdVOQL7E1QMyPNoQ7gD5Zxciiz4ucRUrk",
        parameter_gid: str = "2042306306",
        atomic_gid: str = "2140536820",
        row_buffer: int = 1,
        col_buffer: int = 0,
    ):
        self.sys = Y.System("FlightComputer")

        self.output_path = output_path
        self.sheet_id = sheet_id
        self.parameter_gid = parameter_gid
        self.atomic_gid = atomic_gid
        self.row_buffer = row_buffer
        self.col_buffer = col_buffer

        self.param_dict = None
        self.frame_container = None

    @staticmethod
    def set_param_calibrator(row: dict[str, Any]):
        cal = row["Calibration Function f(x)"]
        if cal:
            return Y.calibrators.MathOperation(expression=cal)
        return None

    @staticmethod
    def chunked(iterable, n):
        iterator = iter(iterable)
        while True:
            group = list(islice(iterator, n))
            if not group:
                break
            yield group

    def make_param(self, row: dict[str, Any]) -> Y.Parameter:
        gui_type = str(row["GUI Type"])

        variable_name = str(row["Variable Name"])
        ui_name = str(row["UI Name"])
        description = str(row["Description (optional)"])
        units_cal = str(row["Units"])
        units_raw = str(row["Raw Units"])

        match gui_type:
            case "AbsoluteTime":
                raise NotImplementedError(
                    "AbsoluteTime parameters have not been implemented yet."
                )
            case "Binary":
                raise NotImplementedError(
                    "Binary parameters have not been implemented yet."
                )
            case "Boolean":
                param = Y.BooleanParameter(
                    system=self.sys,
                    name=variable_name,
                    short_description=ui_name,
                    long_description=description,
                    calibrated_units=units_cal,
                    # raw_units=units_raw,
                    encoding=Y.IntegerEncoding(bits=1),
                )
                return param
            case "Enumerated":
                encoded_type = str(row["Encoding"])
                size = FlightSystem.extract_number(encoded_type)
                if size == None:
                    raise ValueError(
                        f"Input Error: Tried to create enumerated parameter '{variable_name}', but could not find a size in the type '{encoded_type}'"
                    )

                enum_metadata = str(row["Metadata/Notes"])
                param = Y.EnumeratedParameter(
                    system=self.sys,
                    name=variable_name,
                    short_description=ui_name,
                    long_description=description,
                    calibrated_units=units_cal,
                    # raw_units=units_raw,
                    encoding=Y.IntegerEncoding(bits=size, little_endian=True),
                    choices=FlightSystem.extract_enum_choices(enum_metadata),
                )
                return param
            case "Float":
                encoded_type = str(row["Encoding"])
                size = FlightSystem.extract_number(encoded_type)
                if size == None:
                    raise ValueError(
                        f"Input Error: Tried to create float parameter '{variable_name}', but could not find a size in the type '{encoded_type}'"
                    )
                calibrator = TelemetrySystem.set_param_calibrator(row)
                if "float" in encoded_type:
                    param = Y.FloatParameter(
                        system=self.sys,
                        name=variable_name,
                        short_description=ui_name,
                        long_description=description,
                        calibrated_units=units_cal,
                        # raw_units=units_raw,
                        encoding=Y.FloatEncoding(bits=size, little_endian=True),
                        calibrator=calibrator,
                    )
                    return param
                elif "int" in encoded_type:
                    scheme = (
                        Y.IntegerEncodingScheme.UNSIGNED
                        if "u" in encoded_type
                        else Y.IntegerEncodingScheme.TWOS_COMPLEMENT
                    )
                    param = Y.FloatParameter(
                        system=self.sys,
                        name=variable_name,
                        short_description=ui_name,
                        long_description=description,
                        calibrated_units=units_cal,
                        # raw_units=units_raw,
                        encoding=Y.IntegerEncoding(
                            bits=size, scheme=scheme, little_endian=True
                        ),
                        calibrator=calibrator,
                    )
                    return param
            case "Integer":
                encoded_type = str(row["Encoding"])
                size = FlightSystem.extract_number(encoded_type)
                if size == None:
                    raise ValueError(
                        f"Input Error: Tried to create integer parameter '{variable_name}', but could not find a size in the type '{encoded_type}'"
                    )
                scheme = (
                    Y.IntegerEncodingScheme.UNSIGNED
                    if "u" in encoded_type
                    else Y.IntegerEncodingScheme.TWOS_COMPLEMENT
                )
                calibrator = TelemetrySystem.set_param_calibrator(row)
                param = Y.IntegerParameter(
                    system=self.sys,
                    name=variable_name,
                    short_description=ui_name,
                    long_description=description,
                    calibrated_units=units_cal,
                    # raw_units=units_raw,
                    encoding=Y.IntegerEncoding(bits=size, scheme=scheme),
                    calibrator=calibrator,
                )
                return param
            case "String":
                encoded_type = str(row["Encoding"])
                size = self.extract_number(encoded_type)
                if size == None:
                    raise ValueError(
                        f"Input Error: Tried to create string parameter '{variable_name}', but could not find a size in the type '{encoded_type}'"
                    )
                param = Y.StringParameter(
                    system=self.sys,
                    name=variable_name,
                    short_description=ui_name,
                    long_description=description,
                    calibrated_units=units_cal,
                    # raw_units=units_raw,
                    encoding=Y.StringEncoding(bits=size * 8),
                )
                return param

        raise ValueError(f"Unhandled GUI Type '{gui_type}' in make_param().")

    def process_booleans_group(
        self,
        container: Y.Container,
        boolean_params: list[Y.BooleanParameter],
        start_bit_pos: int,
        container_name: str,
    ) -> int:
        if not boolean_params:
            return start_bit_pos

        current_bit_pos = start_bit_pos

        # Group booleans into bytes (8 per group)
        for group in TelemetrySystem.chunked(boolean_params, 8):
            group_size = len(group)

            # If incomplete group (less than 8), add leading padding
            # Example: [A, B, C] -> (pad x 5) C B A
            # Padding at higher bits, booleans at lower bits
            if group_size < 8:
                padding_bits = 8 - group_size
                pad_param = Y.IntegerParameter(
                    system=self.sys,
                    name=f"{container_name}_bool_lead_pad",
                    short_description="Boolean Leading Padding",
                    signed=False,
                    encoding=Y.IntegerEncoding(bits=padding_bits),
                )
                # Padding goes at higher bits (after the booleans in bit position)
                # Booleans will be at current_bit_pos to current_bit_pos + group_size - 1
                # Padding will be at current_bit_pos + group_size to current_bit_pos + 7
                container.entries.append(
                    Y.ParameterEntry(
                        parameter=pad_param, bitpos=current_bit_pos + group_size
                    )
                )

            # Place booleans in reverse order within the byte
            # Logical order: A, B, C, D, E, F, G, H
            # Bits come into the backend little endian reversed so bit locations != logical order
            # Bit positions: A=bit7, B=bit6, C=bit5, ..., H=bit0 (reversed)
            # So reading the booleans correctly in the backend is like this H G F E D C B A
            # So H will come first
            for i, bool_param in enumerate(group):
                bit_pos = current_bit_pos + 7 - i
                entry = Y.ParameterEntry(parameter=bool_param, bitpos=bit_pos)
                container.entries.append(entry)
            current_bit_pos += 8

        return current_bit_pos

    def make_atomic_containers(
        self,
        atomic_Data: dict[str, list[Any]],
        param_dict: dict[str, Y.Parameter],
        atomic_header_params: dict[str, Y.BooleanParameter],
    ):
        containers: list[Y.ContainerEntry] = []
        for name, param_list in atomic_Data.items():
            condition = Y.EqExpression(ref=atomic_header_params[name], value="True")
            container = Y.Container(
                system=self.sys,
                name=name,
                condition=condition,
            )

            boolean_buffer: list[Y.BooleanParameter] = []
            current_bit_pos = 0

            for param_name in param_list:
                if param_name == "":
                    break
                param = param_dict[param_name]

                if isinstance(param, Y.BooleanParameter):
                    boolean_buffer.append(param)

                    if len(boolean_buffer) >= 8:
                        current_bit_pos = self.process_booleans_group(
                            container, boolean_buffer, current_bit_pos, name
                        )
                        boolean_buffer.clear()
                else:
                    if boolean_buffer:
                        current_bit_pos = self.process_booleans_group(
                            self.sys, container, boolean_buffer, current_bit_pos, name
                        )
                        boolean_buffer.clear()

                    container.entries.append(
                        Y.ParameterEntry(parameter=param, offset=0)
                    )
                    if (
                        hasattr(param, "encoding")
                        and param.encoding
                        and hasattr(param.encoding, "bits")
                    ):
                        current_bit_pos += param.encoding.bits

            if boolean_buffer:
                current_bit_pos = self.process_booleans_group(
                    self.sys, container, boolean_buffer, current_bit_pos, name
                )

            containers.append(
                Y.ContainerEntry(container=container, condition=condition)
            )

        return containers

    def make_header(self, atomic_names: list[str]):
        container = Y.Container(system=self.sys, name="header")
        atomic_params: dict[str, Y.BooleanParameter] = {}

        for name in atomic_names:
            param = Y.BooleanParameter(
                system=self.sys,
                name=f"{name}_flag",
                encoding=Y.IntegerEncoding(bits=1),
            )
            atomic_params[name] = param

        # The following hard-coded header parameters come from
        # the A.S.T.R.A. specification
        #
        # The header looks like:
        # ┌───────────┬────────────┬──────────┬─────────────────────┐
        # │ seq (16b) │ flags (8b) │ pad (8b) │ atomic_bitmap (32b) │
        # └───────────┴────────────┴──────────┴─────────────────────┘
        #                                           ▲        ▲   ▲ ▲
        #                                   padding ┘        │   │ │
        #                                                    │   │ │
        #                                    nth atomic flag ┘   │ │
        #                                             ⋮          │ │
        #                                        2nd atomic flag ┘ │
        #                                          1st atomic flag ┘
        #
        # The atomic bitmap is packed from the right.
        # Which means if there are less than 32 atomics, we will need
        # to extend the padding by the amount 32-(num of atomics)
        seq = Y.IntegerParameter(
            system=self.sys,
            name="seq",
            short_description="Sequence Number",
            long_description="A.S.T.R.A. Packet Identifider",
            signed=False,
            encoding=Y.IntegerEncoding(bits=16, little_endian=True),
        )
        container.entries.append(Y.ParameterEntry(seq, offset=0))

        flags = Y.IntegerParameter(
            system=self.sys,
            name="flags",
            short_description="Packet Flags",
            long_description="A.S.T.R.A. Packet Flags",
            signed=False,
            encoding=Y.IntegerEncoding(bits=8, little_endian=True),
        )
        container.entries.append(Y.ParameterEntry(flags, offset=0))

        num_empty_atomic_flags = 32 - len(atomic_params)
        pad = Y.IntegerParameter(
            system=self.sys,
            name="padding",
            short_description="Padding",
            long_description="A.S.T.R.A. Packet Padding",
            signed=False,
            encoding=Y.IntegerEncoding(bits=8, little_endian=True),
        )
        container.entries.append(Y.ParameterEntry(pad, offset=0))

        # The following is some weird stuff
        # to accomodate for the way C++ encodes the flags
        # it encodes them little endian by byte.
        #
        # Example: (read flags as left to right,
        #           so flag #1 is the leftmost
        #           flag on the google sheet)
        #
        # 00000000           00000000  ....
        # │││││││└▶ Flag #1  │││││││└▶ Flag #9
        # ││││││└▶ Flag #2   ││││││└▶ Flag #10
        # │││││└▶ Flag #3    │││││└▶ Flag #11
        # ││││└▶ Flag #4     ││││└▶ Flag #12
        # │││└▶ Flag #5      │││└▶ Flag #13
        # ││└▶ Flag #6       ││└▶ Flag #14
        # │└▶ Flag #7        │└▶ Flag #15
        # └▶ Flag #8         └▶ Flag #16

        if len(atomic_params) < 8:
            # we need this if there is less than 32 atomic flags
            pre_pad = Y.IntegerParameter(
                system=self.sys,
                name="flags_pre_pad",
                short_description="Flag Padding",
                long_description="A.S.T.R.A. Packet Padding",
                signed=False,
                encoding=Y.IntegerEncoding(
                    bits=8 - len(atomic_params), little_endian=True
                ),
            )
            container.entries.append(Y.ParameterEntry(pre_pad, offset=0))

        for group in TelemetrySystem.chunked(atomic_params.values(), 8):
            for atomic_flag_param in reversed(group):
                entry = Y.ParameterEntry(parameter=atomic_flag_param, offset=0)
                container.entries.append(entry)

        if len(atomic_params) < 32:
            # we need this if there is less than 32 atomic flags
            pre_pad = Y.IntegerParameter(
                system=self.sys,
                name="flags_post_pad",
                short_description="Flag Padding",
                long_description="A.S.T.R.A. Packet Padding",
                signed=False,
                encoding=Y.IntegerEncoding(bits=24, little_endian=True),
            )
            container.entries.append(Y.ParameterEntry(pre_pad, offset=0))

        return (container, atomic_params)

    def create_parameters(self):
        param_dict: dict[str, Y.Parameter] = {}
        param_data = TelemetrySystem.load_sheet_rows(
            self.sheet_id, self.parameter_gid, self.col_buffer, self.row_buffer
        )

        for row in param_data:
            param = self.make_param(row)
            param_dict[param.name] = param

        return param_dict

    def create_atomics(self):
        atomic_data = TelemetrySystem.load_sheet_columns(self.sheet_id, self.atomic_gid)

        frame_container = Y.Container(system=self.sys, name="FCFrame")
        (header_container, atomic_header_params) = self.make_header(
            atomic_names=list(atomic_data.keys())
        )
        frame_container.entries.append(Y.ContainerEntry(header_container))

        atomic_containers = self.make_atomic_containers(
            atomic_Data=atomic_data,
            param_dict=self.param_dict,
            atomic_header_params=atomic_header_params,
        )

        for container_entry in atomic_containers:
            frame_container.entries.append(container_entry)

        return frame_container, atomic_containers

    def generate_system(self):
        print(" - Creating Parameters...")
        self.param_dict = self.create_parameters()
        print(f"   Created {len(self.param_dict)} Parameters")

        print(" - Creating Atomics...")
        (self.frame_container, atomics) = self.create_atomics()
        print(f"   Created {len(atomics)} Atomics")
