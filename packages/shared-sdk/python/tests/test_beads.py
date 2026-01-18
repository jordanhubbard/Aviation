import json
import os
from pathlib import Path
import sys

import pytest


sys.path.insert(0, str(Path(__file__).parent.parent))

from aviation.beads import BeadsIssueCreator


@pytest.fixture(autouse=True)
def allow_beads_autoreport(monkeypatch: pytest.MonkeyPatch):
    # The SDK disables autoreport during CI/tests; override for these unit tests.
    monkeypatch.delenv("CI", raising=False)
    monkeypatch.setenv("BEADS_AUTOREPORT", "1")
    monkeypatch.setenv("BEADS_AUTOREPORT_FORCE", "1")


def test_create_issue_dedupes(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    (tmp_path / ".beads").mkdir()

    monkeypatch.setattr("aviation.beads.shutil.which", lambda _cmd: "/usr/local/bin/bd")

    calls: list[list[str]] = []

    def fake_run(cmd, **kwargs):
        calls.append(list(cmd))
        if cmd[1] == "create":
            return type(
                "Proc",
                (),
                {"returncode": 0, "stdout": json.dumps({"id": "Aviation-1"}), "stderr": ""},
            )()
        return type("Proc", (), {"returncode": 0, "stdout": "{}", "stderr": ""})()

    monkeypatch.setattr("aviation.beads.subprocess.run", fake_run)

    creator = BeadsIssueCreator(repo_root=tmp_path)
    first = creator.create_issue(title="t", description="d")
    assert first.created is True
    assert first.issue_id == "Aviation-1"

    second = creator.create_issue(title="t", description="d")
    assert second.created is False
    assert second.reason == "deduped"

    create_calls = [c for c in calls if len(c) > 1 and c[1] == "create"]
    assert len(create_calls) == 1


def test_create_auto_filed_issue_adds_comment(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    (tmp_path / ".beads").mkdir()

    monkeypatch.setattr("aviation.beads.shutil.which", lambda _cmd: "/usr/local/bin/bd")

    captured_comment: str | None = None

    def fake_run(cmd, **kwargs):
        nonlocal captured_comment
        if cmd[1] == "create":
            return type(
                "Proc",
                (),
                {"returncode": 0, "stdout": json.dumps({"id": "Aviation-2"}), "stderr": ""},
            )()
        if cmd[1] == "comments":
            captured_comment = cmd[4]
            return type("Proc", (), {"returncode": 0, "stdout": "{}", "stderr": ""})()
        raise AssertionError(f"unexpected cmd: {cmd}")

    monkeypatch.setattr("aviation.beads.subprocess.run", fake_run)

    creator = BeadsIssueCreator(repo_root=tmp_path)
    res = creator.create_auto_filed_issue(
        title="boom",
        description="stack",
        auto_filed_comment="something happened",
    )

    assert res.created is True
    assert res.issue_id == "Aviation-2"
    assert captured_comment is not None
    assert captured_comment.startswith("[auto-filed]")
