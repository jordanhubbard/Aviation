"""Flight Planner delegates procedure behavior to the common Aviation SDK."""

from aviation.nav_data import NavDataCatalog
from app.services.procedures import Procedures


def test_procedure_compatibility_surface_uses_sdk_catalog() -> None:
    catalog = NavDataCatalog(
        {
            "metadata": {"source": "planner-test"},
            "navaids": [],
            "procedures": [
                {
                    "identifier": " quiet1 ",
                    "airport_icao": " ksfo ",
                    "procedure_type": "sid",
                    "runway": "28R",
                    "initial_altitude_ft": 5000,
                    "legs": [{"fix": " dumba ", "course_deg": 281}],
                }
            ],
            "airspace": {"type": "FeatureCollection", "features": []},
        }
    )

    assert Procedures(catalog).get_sids("KSFO") == [
        {
            "name": "QUIET1",
            "legs": [{"fix": "DUMBA", "altitude": 5000.0, "course": 281.0}],
        }
    ]
