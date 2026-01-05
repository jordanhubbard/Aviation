def test_beads_reporting_disabled_in_tests(client):
    r = client.get("/api/beads/enabled")
    assert r.status_code == 200
    data = r.json()
    assert data["enabled"] is False

    r2 = client.post(
        "/api/beads/report",
        json={
            "source": "frontend",
            "message": "test error",
            "stack": "stack",
            "url": "http://localhost",
            "user_agent": "pytest",
            "context": {"kind": "test"},
        },
    )
    assert r2.status_code == 200
    data2 = r2.json()
    assert data2["enabled"] is False
    assert data2["created"] is False
