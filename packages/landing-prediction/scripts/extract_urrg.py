"""Extract the URRG flight window from the full Yamcs telemetry export."""

from __future__ import print_function

import csv
import os


START_TIME = "2026-03-28T18:16:00.057Z"
END_TIME = "2026-03-28T18:18:54.373Z"

PACKAGE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKSPACE_DIR = os.path.dirname(os.path.dirname(PACKAGE_DIR))
SOURCE_PATH = os.path.join(WORKSPACE_DIR, "docs", "telemetry.csv")
OUTPUT_PATH = os.path.join(PACKAGE_DIR, "tests", "fixtures", "urrg.csv")


def extract(source_path, output_path, start_time=START_TIME, end_time=END_TIME):
    """Copy the header and rows inside the inclusive timestamp window."""
    with open(source_path, "r", newline="") as source:
        reader = csv.reader(source)
        header = next(reader)
        rows = [row for row in reader if row and start_time <= row[0] <= end_time]

    with open(output_path, "w", newline="") as output:
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)

    return len(rows)


if __name__ == "__main__":
    row_count = extract(SOURCE_PATH, OUTPUT_PATH)
    print("Extracted %d URRG telemetry rows to %s" % (row_count, OUTPUT_PATH))
