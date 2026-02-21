# Imports
from abc import ABC, abstractmethod
from typing import Any, Sequence
import re
import csv
import io
import requests
from itertools import islice

class FlightSystem(ABC):
    @staticmethod
    def fetch_sheet_data(sheet_id: str, gid: str, col_buffer: int = 0) -> list[list[str]]:
        """
        Internal helper: download and parse a Google Sheet as CSV.

        Returns:
            A list of lists (2D array) representing rows of the sheet.
        """

        url = (
            f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"
        )
        print(f"      Fetching sheet data from {url} ...")

        response = requests.get(url)
        response.raise_for_status()
        csv_content = response.content.decode("utf-8")
        reader = csv.reader(io.StringIO(csv_content))
        data = list(reader)
        data = [row[col_buffer:] for row in data]

        print(f"      Fetched {len(data)} rows (raw) from sheet.")
        return data

    @staticmethod
    def load_sheet_rows(sheet_id: str, gid: str, col_buffer: int = 0, row_buffer: int = 0) -> list[dict[str, Any]]:
        """
        Load a Google Sheet (as CSV) into a list of rows (dicts).

        Interprets the sheet with *columns as headers* and each data row as an entry.

        Ignores rows and columns before their respective buffer to accommodate differing Google Sheet formats
        """

        data = FlightSystem.fetch_sheet_data(sheet_id, gid, col_buffer)
        if len(data) < 2:
            raise ValueError("Expected at least two header rows")

        headers = data[row_buffer]
        rows = [dict(zip(headers, row)) for row in data[row_buffer + 1:]]

        print(f"      Loaded {len(rows)} data rows.")
        return rows

    @staticmethod
    def load_sheet_columns(sheet_id: str, gid: str) -> dict[str, list[Any]]:
        """
        Load a Google Sheet (as CSV) organized *by columns*.
        """
        data = FlightSystem.fetch_sheet_data(sheet_id, gid)
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

        print(f"      Loaded {len(columns)} columns: {', '.join(columns)}")
        return columns

    @staticmethod
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

    @staticmethod
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

    @abstractmethod
    def generate_system(self):
        pass

    def write_system(self):
        print(f" - Writing System Definition")
        with open(self.output_path, "w") as f:
            self.sys.dump(f, indent=" " * 2)
        print(f" - System Definition Written to {self.output_path}")


