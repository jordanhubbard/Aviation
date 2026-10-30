"""G1000 delegates navigation data behavior to the common Aviation SDK."""

from aviation.nav_data import NavDataCatalog
from app.services.nav_database import NavigationDatabaseService
from app.services.procedures import ProceduresService


def _catalog() -> NavDataCatalog:
    return NavDataCatalog(
        {
            "metadata": {"source": "g1000-test"},
            "navaids": [
                {
                    "identifier": " tst ",
                    "name": "Test VOR",
                    "type": "vor",
                    "latitude": 1,
                    "longitude": 2,
                    "frequency": 110.1,
                }
            ],
            "procedures": [
                {
                    "identifier": " test1 ",
                    "airport_icao": " ktest ",
                    "procedure_type": "sid",
                    "runway": "01",
                    "initial_altitude_ft": 3000,
                    "legs": [{"fix": " fix1 "}],
                }
            ],
            "airspace": {"type": "FeatureCollection", "features": []},
        }
    )


class _Airports:
    def search(self, query: str, limit: int = 20) -> list[dict]:
        return []

    def get_airport_coordinates(self, code: str):
        return None


def test_navigation_database_uses_sdk_normalization_and_query() -> None:
    service = NavigationDatabaseService(_catalog(), _Airports())
    assert service.search("test")["navaids"][0]["identifier"] == "TST"
    assert service.get_procedures("ktest")["sids"][0] == {
        "name": "TEST1",
        "type": "SID",
        "runway": "01",
        "initial_altitude": 3000.0,
        "waypoints": ["FIX1"],
    }


def test_procedures_service_filters_through_sdk_catalog() -> None:
    assert ProceduresService(_catalog()).get_sid("KTEST", "01")[0]["name"] == "TEST1"
