def test_issue_reporting_disabled_in_tests(client):
    response = client.get("/api/issues/enabled")
    assert response.status_code == 200
    data = response.json()
    assert data["enabled"] is False

    report = client.post(
        "/api/issues/report",
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


def test_legacy_reporting_routes_redirect_to_github_reporting(client):
    for method, old, new in (
        ("get", "enabled", "enabled"),
        ("post", "report", "report"),
    ):
        response = getattr(client, method)(f"/api/mac/{old}", follow_redirects=False)
        assert response.status_code == 307
        assert response.headers["location"] == f"/api/issues/{new}"
