from fastapi.testclient import TestClient

from main import app


def test_airports_search_and_lookup(monkeypatch) -> None:
    import app.models.airport as airport_model

    monkeypatch.setattr(
        airport_model,
        "load_airport_cache",
        lambda: [
            {
                "icao": "KPAO",
                "iata": "PAO",
                "name": "Palo Alto Airport",
                "city": "Palo Alto",
                "country": "US",
                "latitude": 37.4611,
                "longitude": -122.115,
                "elevation": 4,
                "type": "small_airport",
            },
            {
                "icao": "K7S5",
                "iata": "",
                "name": "Independence State Airport",
                "city": "Independence",
                "country": "US",
                "latitude": 44.867,
                "longitude": -123.198,
                "elevation": 4777,
                "type": "small_airport",
            },
            {
                "icao": "KSQL",
                "iata": "SQL",
                "name": "San Carlos",
                "city": "San Carlos",
                "country": "US",
                "latitude": 37.5119,
                "longitude": -122.249,
                "elevation": 5,
                "type": "small_airport",
            },
        ],
    )

    client = TestClient(app)

    resp = client.get("/api/airports/search", params={"q": "palo"})
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) == 1
    assert results[0]["icao"] == "KPAO"
    assert results[0]["iata"] == "PAO"

    resp_fuzzy = client.get("/api/airports/search", params={"q": "plao"})
    assert resp_fuzzy.status_code == 200
    results_fuzzy = resp_fuzzy.json()
    assert results_fuzzy
    assert results_fuzzy[0]["icao"] == "KPAO"

    resp_nearby = client.get(
        "/api/airports/search",
        params={"lat": 37.47, "lon": -122.13, "radius_nm": 25, "limit": 5},
    )
    assert resp_nearby.status_code == 200
    results_nearby = resp_nearby.json()
    assert len(results_nearby) == 2
    assert results_nearby[0]["icao"] == "KPAO"
    assert "distance_nm" in results_nearby[0]

    resp2 = client.get("/api/airports/KSQL")
    assert resp2.status_code == 200
    airport = resp2.json()
    assert airport["icao"] == "KSQL"

    resp3 = client.get("/api/airports/7S5")
    assert resp3.status_code == 200
    airport2 = resp3.json()
    assert airport2["icao"] == "K7S5"
