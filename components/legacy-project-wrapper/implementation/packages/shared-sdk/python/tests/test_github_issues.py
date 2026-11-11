import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from aviation.github_issues import GitHubIssueCreator


@pytest.fixture
def provider(monkeypatch):
    monkeypatch.setenv("GITHUB_ISSUES_AUTOREPORT", "1")
    monkeypatch.setenv("GITHUB_ISSUES_AUTOREPORT_FORCE", "1")
    monkeypatch.setenv("GITHUB_ISSUES_TOKEN", "synthetic-report-credential")
    calls = []
    reply = {
        "status": 201,
        "payload": {
            "number": 42,
            "html_url": "https://github.com/test-owner/test-repo/issues/42",
        },
    }

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["content-length"])))
            calls.append({"path": self.path, "headers": self.headers, "body": body})
            encoded = json.dumps(reply["payload"]).encode()
            self.send_response(reply["status"])
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    creator = GitHubIssueCreator(
        repository="test-owner/test-repo",
        api_url=f"http://127.0.0.1:{server.server_port}",
    )
    try:
        yield creator, calls, reply
    finally:
        server.shutdown()
        server.server_close()
        thread.join(5)
        assert not thread.is_alive()


def test_github_wire_contract_and_dedupe(provider):
    creator, calls, _reply = provider
    first = creator.create_issue(title="Failure", body="Details")
    assert (first.created, first.issue_number, first.issue_url) == (
        True,
        42,
        "https://github.com/test-owner/test-repo/issues/42",
    )
    assert creator.create_issue(title="Failure", body="Details").reason == "deduped"
    assert len(calls) == 1
    assert calls[0]["path"] == "/repos/test-owner/test-repo/issues"
    assert calls[0]["headers"]["Authorization"] == "Bearer synthetic-report-credential"
    assert set(calls[0]["body"]) == {"title", "body"}
    assert "aviation-autoreport:" in calls[0]["body"]["body"]


def test_failure_can_retry(provider):
    creator, calls, reply = provider
    reply["status"] = 503
    assert "HTTP 503" in creator.create_issue(title="Retry", body="Details").reason
    reply["status"] = 201
    assert creator.create_issue(title="Retry", body="Details").created
    assert len(calls) == 2


def test_invalid_provider_response(provider):
    creator, _calls, reply = provider
    reply["payload"] = {"id": "not-an-issue"}
    assert not creator.create_issue(title="Malformed", body="Details").created


def test_credentials_opt_in_and_ci_guard(provider, monkeypatch):
    creator, calls, _reply = provider
    monkeypatch.delenv("GITHUB_ISSUES_AUTOREPORT")
    assert not creator.enabled()
    monkeypatch.setenv("GITHUB_ISSUES_AUTOREPORT", "1")
    monkeypatch.setenv("CI", "true")
    monkeypatch.delenv("GITHUB_ISSUES_AUTOREPORT_FORCE")
    assert not creator.enabled()
    monkeypatch.setenv("GITHUB_ISSUES_AUTOREPORT_FORCE", "1")
    assert not GitHubIssueCreator(token="").enabled()
    monkeypatch.delenv("GITHUB_ISSUES_TOKEN")
    monkeypatch.setenv("MAC_API_URL", "https://retired-tracker.example.test")
    monkeypatch.setenv("MAC_API_TOKEN", "retired-credential")
    assert (
        not GitHubIssueCreator()
        .create_issue(title="Disabled", body="No request")
        .created
    )
    assert not calls


def test_rate_limit(provider):
    creator, calls, _reply = provider
    for i in range(5):
        assert creator.create_issue(title=f"Error {i}", body="Details").created
    assert "rate limited" in creator.create_issue(title="Sixth", body="Details").reason
    assert len(calls) == 5


def test_redacts_secrets_before_publication(provider):
    creator, calls, _reply = provider
    creator.create_auto_filed_issue(
        title="Failure",
        body='https://user:private-pass@example.test/path?token=private-query#private-fragment {"api_key": "private-value"} Authorization: Bearer private-auth',
        auto_filed_context="password=private-context",
    )
    body = calls[0]["body"]["body"]
    assert "https://example.test/path" in body
    assert "Auto-filed context:" in body
    for value in [
        "private-pass",
        "private-query",
        "private-fragment",
        "private-value",
        "private-auth",
        "private-context",
    ]:
        assert value not in body


def test_rejects_unsafe_destinations():
    for options in [
        {"repository": "../repo"},
        {"api_url": "http://external.example.test"},
        {"api_url": "https://user:credential@api.github.com"},
    ]:
        with pytest.raises(ValueError):
            GitHubIssueCreator(**options)
