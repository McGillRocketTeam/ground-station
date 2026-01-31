from typing import Any, Sequence
import re
import csv
import io
import requests
import argparse
import yamcs.pymdb as Y
from itertools import islice


def _fetch_sheet_data(sheet_id: str, gid: str, col_buffer: int = 0) -> list[list[str]]:
    """
    Internal helper: download and parse a Google Sheet as CSV.

    Returns:
        A list of lists (2D array) representing rows of the sheet.
    """
    url = (
        f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"
    )
    print(f"Fetching sheet data from {url} ...")

    response = requests.get(url)
    response.raise_for_status()
    csv_content = response.content.decode("utf-8")
    reader = csv.reader(io.StringIO(csv_content))
    data = list(reader)
    data = [row[col_buffer:] for row in data]

    print(f"Fetched {len(data)} rows (raw) from sheet.")
    return data


def load_sheet_rows(sheet_id: str, gid: str, row_buffer: int = 0, col_buffer: int = 0) -> list[dict[str, Any]]:
    """
    Load a Google Sheet (as CSV) into a list of rows (dicts).

    Interprets the sheet with *columns as headers* and each data row as an entry.

    Ignores rows and columns before their respective buffer to accommodate differing Google Sheet formats
    """
    data = _fetch_sheet_data(sheet_id, gid, col_buffer)
    if len(data) < 2:
        raise ValueError("Expected at least two header rows")

    headers = data[row_buffer]
    rows = [dict(zip(headers, row)) for row in data[row_buffer + 1:]]
    print(f"Loaded {len(rows)} data rows.")
    return rows


def load_sheet_columns(sheet_id: str, gid: str) -> dict[str, list[Any]]:
    """
    Load a Google Sheet (as CSV) organized *by columns*.
    """
    data = _fetch_sheet_data(sheet_id, gid)
    if len(data) < 2:
        raise ValueError("Expected header and at least one data row")

    # Skip the *first* row ("Name:", "Parameters:", etc.)
    headers = data[0][1:]  # the real column names start at index 1 (B1..F1)
    rows = [r[1:] for r in data[1:]]  # skip that first column of labels ("Parameters:")

    columns = {h: [] for h in headers if h}

    for row in rows:
        for h, value in zip(headers, row):
            if h:
                columns[h].append(value.strip())

    print(f"Loaded {len(columns)} columns: {', '.join(columns)}")
    return columns


def extract_enum_choices(s: str) -> Sequence[tuple[int, str]]:
    result = []
    for line in s.splitlines():
        line = line.strip()
        if not line or "=" not in line:
            continue  # Skip blank or malformed lines
        num_str, desc = line.split("=", 1)
        try:
            num = int(num_str.strip())
            result.append((num, desc.strip()))
        except ValueError:
            # Skip lines where the number part isn't a valid integer
            continue
    return result


def extract_number(s: str) -> int | None:
    """
    Extracts the numeric part from a given string (e.g., 'float32' → 32).

    Args:
        s (str): Input string (e.g., 'float32', 'int16', 'uint8').

    Returns:
        int | None: The extracted number as an integer, or None if no digits found.
    """
    match = re.search(r"\d+", s)
    return int(match.group()) if match else None

def set_param_calibrator(row: dict[str, Any]):
    cal = row["Calibration Function f(x)"]
    if cal:
        return Y.calibrators.MathOperation(expression=cal)
    return None

def make_param(system: Y.System, row: dict[str, Any]) -> Y.Parameter:
    gui_type = str(row["GUI Type"])

    variable_name = str(row["Variable Name"])
    ui_name = str(row["UI Name"])
    description = str(row["Description (optional)"])
    units = str(row["Units"])

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
                system=system,
                name=variable_name,
                short_description=ui_name,
                long_description=description,
                units=units,
                encoding=Y.IntegerEncoding(bits=1),
            )
            return param
        case "Enumerated":
            encoded_type = str(row["Encoding"])
            size = extract_number(encoded_type)
            if size == None:
                raise ValueError(
                    f"Input Error: Tried to create enumerated parameter '{variable_name}', but could not find a size in the type '{encoded_type}'"
                )

            enum_metadata = str(row["Metadata/Notes"])
            param = Y.EnumeratedParameter(
                system=system,
                name=variable_name,
                short_description=ui_name,
                long_description=description,
                units=units,
                encoding=Y.IntegerEncoding(bits=size, little_endian=True),
                choices=extract_enum_choices(enum_metadata),
            )
            return param
        case "Float":
            encoded_type = str(row["Encoding"])
            size = extract_number(encoded_type)
            if size == None:
                raise ValueError(
                    f"Input Error: Tried to create float parameter '{variable_name}', but could not find a size in the type '{encoded_type}'"
                )
            calibrator = set_param_calibrator(row)
            if "float" in encoded_type:
                param = Y.FloatParameter(
                    system=system,
                    name=variable_name,
                    short_description=ui_name,
                    long_description=description,
                    units=units,
                    encoding=Y.FloatEncoding(bits=size),
                    calibrator=calibrator,
                )
                return param
            elif "int" in encoded_type:
                scheme = (
                    Y.IntegerEncodingScheme.UNSIGNED
                    if "u" in encoded_type
                    else Y.IntegerEncodingScheme.TWOS_COMPLEMENT
                )
                param = Y.IntegerParameter(
                    system=system,
                    name=variable_name,
                    short_description=ui_name,
                    long_description=description,
                    units=units,
                    encoding=Y.IntegerEncoding(
                        bits=size, scheme=scheme, little_endian=True
                    ),
                    calibrator=calibrator,
                )
                return param
        case "Integer":
            encoded_type = str(row["Encoding"])
            size = extract_number(encoded_type)
            if size == None:
                raise ValueError(
                    f"Input Error: Tried to create integer parameter '{variable_name}', but could not find a size in the type '{encoded_type}'"
                )
            scheme = (
                Y.IntegerEncodingScheme.UNSIGNED
                if "u" in encoded_type
                else Y.IntegerEncodingScheme.TWOS_COMPLEMENT
            )
            calibrator = set_param_calibrator(row)
            param = Y.IntegerParameter(
                system=system,
                name=variable_name,
                short_description=ui_name,
                long_description=description,
                units=units,
                encoding=Y.IntegerEncoding(bits=size, scheme=scheme),
                calibrator=calibrator,
            )
            return param
        case "String":
            encoded_type = str(row["Encoding"])
            size = extract_number(encoded_type)
            if size == None:
                raise ValueError(
                    f"Input Error: Tried to create string parameter '{variable_name}', but could not find a size in the type '{encoded_type}'"
                )
            param = Y.StringParameter(
                system=system,
                name=variable_name,
                short_description=ui_name,
                long_description=description,
                units=units,
                encoding=Y.StringEncoding(bits=size * 8),
            )
            return param

    raise ValueError(f"Unhandled GUI Type '{gui_type}' in make_param().")


def process_booleans_group(
    system: Y.System,
    container: Y.Container,
    boolean_params: list[Y.BooleanParameter],
    start_bit_pos: int,
    container_name: str,
) -> int:
    if not boolean_params:
        return start_bit_pos

    current_bit_pos = start_bit_pos

    # Group booleans into bytes (8 per group)
    for group in chunked(boolean_params, 8):
        group_size = len(group)

        # If incomplete group (less than 8), add leading padding
        # Example: [A, B, C] -> (pad x 5) C B A
        # Padding at higher bits, booleans at lower bits
        if group_size < 8:
            padding_bits = 8 - group_size
            pad_param = Y.IntegerParameter(
                system=system,
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
    system: Y.System,
    atomic_Data: dict[str, list[Any]],
    param_dict: dict[str, Y.Parameter],
    atomic_header_params: dict[str, Y.BooleanParameter],
):
    containers: list[Y.ContainerEntry] = []
    for name, param_list in atomic_Data.items():
        condition = Y.EqExpression(ref=atomic_header_params[name], value="True")
        container = Y.Container(
            system=system,
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
                    current_bit_pos = process_booleans_group(
                        system, container, boolean_buffer, current_bit_pos, name
                    )
                    boolean_buffer.clear()
            else:
                if boolean_buffer:
                    current_bit_pos = process_booleans_group(
                        system, container, boolean_buffer, current_bit_pos, name
                    )
                    boolean_buffer.clear()

                container.entries.append(Y.ParameterEntry(parameter=param, offset=0))
                if (
                    hasattr(param, "encoding")
                    and param.encoding
                    and hasattr(param.encoding, "bits")
                ):
                    current_bit_pos += param.encoding.bits

        if boolean_buffer:
            current_bit_pos = process_booleans_group(
                system, container, boolean_buffer, current_bit_pos, name
            )

        containers.append(Y.ContainerEntry(container=container, condition=condition))

    return containers


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


def set_command_significance(significance: str):
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


def make_command(system: Y.System, cmd: dict[str, Any]):
    name = cmd["Variable Name"]
    command_id = cmd["ID"]
    significance = set_command_significance(cmd["Significance"])

    command = Y.Command(
        system=system,
        name=name,
        short_description=command_id,
        significance=significance,
    )

    set_command_arguments(command, cmd["Arguments"])

    return command


def chunked(iterable, n):
    iterator = iter(iterable)
    while True:
        group = list(islice(iterator, n))
        if not group:
            break
        yield group


def make_header(system: Y.System, atomic_names: list[str]):
    container = Y.Container(system=system, name="header")
    atomic_params: dict[str, Y.BooleanParameter] = {}

    for name in atomic_names:
        param = Y.BooleanParameter(
            system=system,
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
        system=system,
        name="seq",
        short_description="Sequence Number",
        long_description="A.S.T.R.A. Packet Identifider",
        signed=False,
        encoding=Y.IntegerEncoding(bits=16, little_endian=True),
    )
    container.entries.append(Y.ParameterEntry(seq, offset=0))

    flags = Y.IntegerParameter(
        system=system,
        name="flags",
        short_description="Packet Flags",
        long_description="A.S.T.R.A. Packet Flags",
        signed=False,
        encoding=Y.IntegerEncoding(bits=8, little_endian=True),
    )
    container.entries.append(Y.ParameterEntry(flags, offset=0))

    num_empty_atomic_flags = 32 - len(atomic_params)
    pad = Y.IntegerParameter(
        system=system,
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
            system=system,
            name="flags_pre_pad",
            short_description="Flag Padding",
            long_description="A.S.T.R.A. Packet Padding",
            signed=False,
            encoding=Y.IntegerEncoding(bits=8 - len(atomic_params), little_endian=True),
        )
        container.entries.append(Y.ParameterEntry(pre_pad, offset=0))

    for group in chunked(atomic_params.values(), 8):
        for atomic_flag_param in reversed(group):
            entry = Y.ParameterEntry(parameter=atomic_flag_param, offset=0)
            container.entries.append(entry)

    if len(atomic_params) < 32:
        # we need this if there is less than 32 atomic flags
        pre_pad = Y.IntegerParameter(
            system=system,
            name="flags_post_pad",
            short_description="Flag Padding",
            long_description="A.S.T.R.A. Packet Padding",
            signed=False,
            encoding=Y.IntegerEncoding(bits=24, little_endian=True),
        )
        container.entries.append(Y.ParameterEntry(pre_pad, offset=0))

    return (container, atomic_params)


def write_system(system: Y.System, output_path: str):
    with open(output_path, "w") as f:
        system.dump(f, indent=" " * 2)
    print(f"✅ Wrote system definition to {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate FlightComputer Yamcs XML from Google Sheets"
    )
    parser.add_argument(
        "-o",
        "--output",
        help="Path to output XML file (default: output.xml)",
        default="output.xml",
    )
    args = parser.parse_args()

    output_path = args.output

    sheet_id = "1Ukaums3NfbJdVOQL7E1QMyPNoQ7gD5Zxciiz4ucRUrk"
    parameter_gid = "2042306306"
    atomic_gid = "2140536820"

    param_data = load_sheet_rows(sheet_id, parameter_gid, col_buffer=0, row_buffer=1)

    fc = Y.System("FlightComputer")

    param_dict: dict[str, Y.Parameter] = {}
    for row in param_data:
        param = make_param(fc, row)
        param_dict[param.name] = param

    print("Creating Atomics...")
    atomic_data = load_sheet_columns(sheet_id, atomic_gid)

    frame_container = Y.Container(system=fc, name="FCFrame")
    (header_container, atomic_header_params) = make_header(
        system=fc, atomic_names=list(atomic_data.keys())
    )
    frame_container.entries.append(Y.ContainerEntry(header_container))

    atomic_containers = make_atomic_containers(
        system=fc,
        atomic_Data=atomic_data,
        param_dict=param_dict,
        atomic_header_params=atomic_header_params,
    )

    for container_entry in atomic_containers:
        frame_container.entries.append(container_entry)

    command_sheet_id = "1TR60uGHWK7cE0fT5De08KupXAn6dqf6P7QywPF3KDuU"
    commands_gid = "1631122107"

    print("Creating Commands...")
    command_data = load_sheet_rows(command_sheet_id, commands_gid, col_buffer=1, row_buffer=4)


    for cmd in command_data:
        if cmd["Variable Name"]:
            make_command(system=fc, cmd=cmd)

    write_system(fc, output_path)


if __name__ == "__main__":
    main()
