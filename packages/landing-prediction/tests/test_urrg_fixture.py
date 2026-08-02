import csv
import os
import unittest


START_TIME = "2026-03-28T18:16:00.057Z"
END_TIME = "2026-03-28T18:18:54.373Z"
FIXTURE_PATH = os.path.join(
    os.path.dirname(__file__), "fixtures", "urrg.csv"
)


class UrrgFixtureTest(unittest.TestCase):
    def test_contains_only_the_flight_window(self):
        with open(FIXTURE_PATH, "r", newline="") as fixture:
            rows = list(csv.reader(fixture))

        self.assertGreater(len(rows), 1)
        self.assertEqual(rows[0][0], "Time")

        timestamps = [row[0] for row in rows[1:]]
        self.assertEqual(timestamps[0], START_TIME)
        self.assertEqual(timestamps[-1], END_TIME)
        self.assertTrue(all(START_TIME <= value <= END_TIME for value in timestamps))


if __name__ == "__main__":
    unittest.main()
