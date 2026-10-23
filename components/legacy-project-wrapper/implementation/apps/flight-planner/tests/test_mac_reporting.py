def test_mac_reporting_disabled_in_tests(client):
    response = client.get("/api/mac/enabled")
    assert response.status_code == 200
    data = response.json()
    assert data["enabled"] is False

    report = client.post(
        "/api/mac/report",
        json={
            "source": "frontend",
            "message": "test error",
            "stack": "stack",
            "url": "http://localhost",
            "user_agent": "pytest",
            "context": {"kind": "test"},
        },
    )
    assert report.status_code == 200
    report_data = report.json()
    assert report_data["enabled"] is False
    assert report_data["created"] is False
