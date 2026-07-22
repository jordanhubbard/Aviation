import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from aviation.mac_tasks import MacTaskCreator


class FakeResponse:
    def __init__(self, payload: dict):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self) -> bytes:
        return json.dumps(self.payload).encode("utf-8")


@pytest.fixture(autouse=True)
def allow_mac_autoreport(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("CI", raising=False)
    monkeypatch.setenv("MAC_AUTOREPORT", "1")
    monkeypatch.setenv("MAC_AUTOREPORT_FORCE", "1")


def test_create_task_dedupes(monkeypatch: pytest.MonkeyPatch):
    calls = []

    def fake_urlopen(request, **_kwargs):
        calls.append(request)
        return FakeResponse({"id": "task_1"})

    monkeypatch.setattr("aviation.mac_tasks.urllib.request.urlopen", fake_urlopen)
    creator = MacTaskCreator(
        hub_url="https://mac.example.test", token="test-token", project="Aviation"
    )

    first = creator.create_task(title="t", description="d")
    assert first.created is True
    assert first.task_id == "task_1"

    second = creator.create_task(title="t", description="d")
    assert second.created is False
    assert second.reason == "deduped"
    assert len(calls) == 1

    body = json.loads(calls[0].data.decode("utf-8"))
    assert body["project"] == "Aviation"
    assert body["idempotency_key"].startswith("aviation-autoreport:")


def test_create_auto_filed_task_adds_context(monkeypatch: pytest.MonkeyPatch):
    calls = []

    def fake_urlopen(request, **_kwargs):
        calls.append(request)
        return FakeResponse({"id": "task_2"})

    monkeypatch.setattr("aviation.mac_tasks.urllib.request.urlopen", fake_urlopen)
    creator = MacTaskCreator(hub_url="https://mac.example.test")
    result = creator.create_auto_filed_task(
        title="boom",
        description="stack",
        auto_filed_context="something happened",
    )

    assert result.task_id == "task_2"
    body = json.loads(calls[0].data.decode("utf-8"))
    assert "Auto-filed context:" in body["description"]
    assert "something happened" in body["description"]
