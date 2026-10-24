import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path


PARSER = Path(__file__).parent.parent / "src/ingest/adapters/parseNtsb.py"
spec = importlib.util.spec_from_file_location("parse_ntsb", PARSER)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class NTSBParserTest(unittest.TestCase):
    def test_maps_case_aircraft_injuries_and_coordinates(self):
        events = [
            {
                "ev_id": "20261014204002", "ntsb_no": "CEN27FA016", "ev_type": "ACC",
                "ev_date": "10/14/26 00:00:00", "ev_city": "Reedsburg", "ev_state": "WI",
                "ev_country": "USA", "inj_tot_f": "5", "inj_tot_s": "2",
                "inj_tot_m": "1", "dec_latitude": "43.50", "dec_longitude": "-89.25",
                "ev_nr_apt_id": "KMSN",
            },
            {"ev_id": "old", "ev_type": "ACC", "ev_date": "08/01/26 00:00:00"},
        ]
        aircraft = [{"ev_id": "20261014204002", "regis_no": "N931TT",
                     "acft_make": "PIPER", "acft_model": "PA-46"}]
        result = module.convert(
            events, aircraft, "https://data.ntsb.gov/file.zip",
            datetime(2026, 9, 1, tzinfo=timezone.utc), "2026-10-23T00:00:00Z"
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["registration"], "N931TT")
        self.assertEqual(result[0]["fatalities"], 5)
        self.assertEqual(result[0]["injuries"], 3)
        self.assertEqual(result[0]["airportIcao"], "KMSN")
        self.assertEqual((result[0]["lat"], result[0]["lon"]), (43.5, -89.25))

    def test_only_probable_cause_findings_are_extracted(self):
        event = {"ev_id": "case-1", "ev_type": "ACC", "ev_date": "10/14/26 00:00:00"}
        result = module.convert([event], [], "https://data.ntsb.gov/report",
            datetime(2026, 9, 1, tzinfo=timezone.utc), "2026-10-23T00:00:00Z",
            [{"ev_id": "case-1", "narr_cause": "Engine failure caused a forced landing."}],
            [{"ev_id": "case-1", "cm_inPc": "T", "finding_description": "Loss of control"},
             {"ev_id": "case-1", "cm_inPc": "F", "finding_description": "Weather"}],
            [{"ev_id": "case-1", "Occurrence_Description": "Loss of control in flight"}])
        self.assertIn("Engine failure", result[0]["causeText"])
        self.assertIn("Loss of control", result[0]["causeText"])
        self.assertNotIn("Weather", result[0]["causeText"])
        self.assertEqual(result[0]["occurrenceText"], "Loss of control in flight")


if __name__ == "__main__":
    unittest.main()
