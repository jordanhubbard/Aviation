#!/usr/bin/env python3
"""Materialize one exact Git revision with recursive submodules and Git LFS."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
from pathlib import Path

_POINTER_HEADER = b"version https://git-lfs.github.com/spec/v1\n"
_MAX_DEPTH = 1_000_000
_PROCESS_TIMEOUT_SECONDS = 7200


class CheckoutError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def _environment() -> dict[str, str]:
    environment = {
        key: value
        for key, value in os.environ.items()
        if key not in {"GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"}
    }
    environment.update(
        {
            "GIT_LFS_SKIP_SMUDGE": "1",
            "GIT_TERMINAL_PROMPT": "0",
            "GCM_INTERACTIVE": "Never",
        }
    )
    return environment


def _run(
    *arguments: str,
    cwd: Path,
    environment: dict[str, str],
    input_bytes: bytes | None = None,
) -> bytes:
    try:
        completed = subprocess.run(
            arguments,
            cwd=cwd,
            env=environment,
            input=input_bytes,
            capture_output=True,
            check=False,
            timeout=_PROCESS_TIMEOUT_SECONDS,
        )
    except FileNotFoundError as exc:
        raise CheckoutError(
            "repository-checkout.git-unavailable",
            "Git is required to materialize a repository",
        ) from exc
    except OSError as exc:
        raise CheckoutError(
            "repository-checkout.process-failed",
            "repository checkout process could not be launched",
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise CheckoutError(
            "repository-checkout.timeout",
            "repository checkout exceeded its bounded process deadline",
        ) from exc
    if completed.returncode != 0:
        detail = completed.stderr.decode("utf-8", errors="replace").strip()
        command = " ".join(arguments[:4])
        raise CheckoutError(
            "repository-checkout.command-failed",
            f"{command} failed" + (f": {detail}" if detail else ""),
        )
    return completed.stdout


def _git(
    repository: Path,
    *arguments: str,
    environment: dict[str, str],
    input_bytes: bytes | None = None,
) -> bytes:
    return _run(
        "git",
        "-c",
        f"core.hooksPath={os.devnull}",
        "-c",
        "protocol.file.allow=always",
        "-C",
        str(repository),
        *arguments,
        cwd=repository,
        environment=environment,
        input_bytes=input_bytes,
    )


def _git_lfs(repository: Path, *arguments: str, environment: dict[str, str]) -> bytes:
    return _run(
        "git",
        "-c",
        "protocol.file.allow=always",
        "-C",
        str(repository),
        "lfs",
        *arguments,
        cwd=repository,
        environment=environment,
    )


def _text(repository: Path, *arguments: str, environment: dict[str, str]) -> str:
    try:
        return (
            _git(repository, *arguments, environment=environment)
            .decode("utf-8", errors="strict")
            .strip()
        )
    except UnicodeError as exc:
        raise CheckoutError(
            "repository-checkout.git-output-invalid", "Git emitted non-UTF-8 output"
        ) from exc


def _repositories(root: Path, environment: dict[str, str]) -> tuple[Path, ...]:
    output = _text(
        root,
        "submodule",
        "foreach",
        "--recursive",
        "--quiet",
        "git rev-parse --show-toplevel",
        environment=environment,
    )
    repositories = [root]
    for value in output.splitlines():
        candidate = Path(value).resolve()
        try:
            candidate.relative_to(root)
        except ValueError as exc:
            raise CheckoutError(
                "repository-checkout.submodule-escape",
                "a submodule resolved outside the checkout root",
            ) from exc
        if candidate not in repositories:
            repositories.append(candidate)
    return tuple(repositories)


def _unresolved_lfs_paths(
    repository: Path, environment: dict[str, str]
) -> tuple[str, ...]:
    try:
        manifest = json.loads(
            _git_lfs(repository, "ls-files", "--json", environment=environment)
        )
        files = manifest["files"]
        if files is None:
            files = []
        if not isinstance(files, list):
            raise TypeError("Git LFS files must be an array or null")
        objects = {
            item["name"]: (item["oid"], item["size"])
            for item in files
            if isinstance(item, dict)
        }
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise CheckoutError(
            "repository-checkout.lfs-manifest-invalid",
            "Git LFS returned malformed current-tree object evidence",
        ) from exc
    tracked = _git(repository, "ls-files", "-z", environment=environment)
    if not tracked:
        return ()
    attributes = _git(
        repository,
        "check-attr",
        "-z",
        "--stdin",
        "filter",
        environment=environment,
        input_bytes=tracked,
    ).split(b"\0")
    if attributes and attributes[-1] == b"":
        attributes.pop()
    if len(attributes) % 3:
        raise CheckoutError(
            "repository-checkout.attributes-invalid",
            "Git returned malformed attribute evidence",
        )
    unresolved: list[str] = []
    for index in range(0, len(attributes), 3):
        raw_path, attribute, value = attributes[index : index + 3]
        if attribute != b"filter" or value != b"lfs":
            continue
        try:
            relative = raw_path.decode("utf-8", errors="strict")
        except UnicodeError as exc:
            raise CheckoutError(
                "repository-checkout.path-invalid",
                "a tracked LFS path is not UTF-8",
            ) from exc
        path = repository.joinpath(*Path(relative).parts)
        try:
            expected_oid, expected_size = objects[relative]
            digest = hashlib.sha256()
            actual_size = 0
            with path.open("rb") as stream:
                first = stream.read(len(_POINTER_HEADER))
                if first == _POINTER_HEADER:
                    unresolved.append(relative)
                    continue
                digest.update(first)
                actual_size += len(first)
                while chunk := stream.read(1024 * 1024):
                    digest.update(chunk)
                    actual_size += len(chunk)
            invalid = (
                not isinstance(expected_oid, str)
                or not isinstance(expected_size, int)
                or digest.hexdigest() != expected_oid
                or actual_size != expected_size
            )
        except KeyError:
            # A repository may contain an ordinary Git blob beneath a broad LFS
            # attribute. Only paths whose selected Git object is an LFS pointer
            # appear in the current-tree LFS manifest and require hydration.
            continue
        except OSError as exc:
            raise CheckoutError(
                "repository-checkout.lfs-content-unavailable",
                f"tracked LFS content is unavailable: {relative}",
            ) from exc
        if invalid:
            unresolved.append(relative)
    return tuple(unresolved)


def _restore_excluded_lfs_pointers(
    repository: Path, environment: dict[str, str]
) -> int:
    """Undo git-lfs pull changes to HEAD pointers whose effective filter is unset."""

    status = _git(
        repository,
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
        environment=environment,
    )
    restore: list[bytes] = []
    for record in status.split(b"\0"):
        if not record or len(record) < 4 or record[:2] == b"??":
            continue
        if record[2:3] != b" " or record[:1] in {b"R", b"C"}:
            continue
        raw_path = record[3:]
        try:
            relative = raw_path.decode("utf-8", errors="strict")
        except UnicodeError as exc:
            raise CheckoutError(
                "repository-checkout.path-invalid",
                "a tracked checkout path is not UTF-8",
            ) from exc
        attributes = _git(
            repository,
            "check-attr",
            "-z",
            "filter",
            "--",
            relative,
            environment=environment,
        ).split(b"\0")
        if len(attributes) < 3 or attributes[1] != b"filter":
            raise CheckoutError(
                "repository-checkout.attributes-invalid",
                "Git returned malformed attribute evidence",
            )
        if attributes[2] == b"lfs":
            continue
        head_content = _git(
            repository,
            "cat-file",
            "blob",
            f"HEAD:{relative}",
            environment=environment,
        )
        if head_content.startswith(_POINTER_HEADER):
            restore.append(raw_path)
    if restore:
        _git(
            repository,
            "restore",
            "--source=HEAD",
            "--staged",
            "--worktree",
            "--pathspec-from-file=-",
            "--pathspec-file-nul",
            environment=environment,
            input_bytes=b"\0".join(restore) + b"\0",
        )
    return len(restore)


def materialize(
    source: str,
    revision: str,
    destination: Path,
    *,
    history_depth: int | None = 1,
) -> dict[str, object]:
    if history_depth is not None and not 1 <= history_depth <= _MAX_DEPTH:
        raise CheckoutError(
            "repository-checkout.depth-invalid",
            f"history depth must be between 1 and {_MAX_DEPTH}",
        )
    root = destination.expanduser().resolve()
    if root.exists() and (not root.is_dir() or any(root.iterdir())):
        raise CheckoutError(
            "repository-checkout.destination-occupied",
            "checkout destination must be absent or an empty directory",
        )
    root.mkdir(parents=True, exist_ok=True)
    environment = _environment()
    try:
        _run("git", "lfs", "version", cwd=root, environment=environment)
    except CheckoutError as exc:
        raise CheckoutError(
            "repository-checkout.git-lfs-unavailable",
            "Git LFS is required before repository materialization",
        ) from exc
    _run("git", "init", str(root), cwd=root, environment=environment)
    _git(root, "remote", "add", "origin", source, environment=environment)
    fetch = ["fetch", "--no-tags", "--force", "--progress"]
    if history_depth is not None:
        fetch.append(f"--depth={history_depth}")
    fetch.extend(("origin", revision))
    _git(root, *fetch, environment=environment)
    fetched = _text(root, "rev-parse", "FETCH_HEAD^{commit}", environment=environment)
    _git(root, "checkout", "--detach", "--force", fetched, environment=environment)
    actual = _text(root, "rev-parse", "HEAD", environment=environment)
    if actual != fetched:
        raise CheckoutError(
            "repository-checkout.revision-mismatch",
            "checked-out revision differs from the exact fetched commit",
        )
    submodules = ["submodule", "update", "--init", "--recursive", "--force"]
    if history_depth is not None:
        submodules.extend(("--depth", str(history_depth)))
    _git(root, *submodules, environment=environment)
    status = _text(root, "submodule", "status", "--recursive", environment=environment)
    incomplete = [line for line in status.splitlines() if line[:1] in {"-", "+", "U"}]
    if incomplete:
        raise CheckoutError(
            "repository-checkout.submodule-incomplete",
            "recursive submodule state does not match the selected tree",
        )
    repositories = _repositories(root, environment)
    hydrated = 0
    restored_excluded = 0
    for repository in repositories:
        _git_lfs(repository, "install", "--local", environment=environment)
        _git_lfs(repository, "pull", environment=environment)
        restored_excluded += _restore_excluded_lfs_pointers(repository, environment)
        unresolved = _unresolved_lfs_paths(repository, environment)
        if unresolved:
            preview = ", ".join(unresolved[:3])
            raise CheckoutError(
                "repository-checkout.lfs-unresolved",
                f"Git LFS content remains unresolved in {repository}: {preview}",
            )
        hydrated += 1
    dirty = _text(
        root,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        environment=environment,
    )
    if dirty:
        raise CheckoutError(
            "repository-checkout.dirty",
            "content hydration did not leave a clean checkout",
        )
    return {
        "schema": "literate-ai/repository-checkout@1",
        "revision": actual,
        "tree": _text(root, "rev-parse", "HEAD^{tree}", environment=environment),
        "shallow": _text(
            root, "rev-parse", "--is-shallow-repository", environment=environment
        )
        == "true",
        "history_depth": history_depth,
        "repositories": len(repositories),
        "lfs_verified_repositories": hydrated,
        "restored_excluded_lfs_pointers": restored_excluded,
        "clean": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("revision")
    parser.add_argument("destination", type=Path)
    history = parser.add_mutually_exclusive_group()
    history.add_argument("--history-depth", type=int, default=1)
    history.add_argument("--full-history", action="store_true")
    arguments = parser.parse_args()
    try:
        report = materialize(
            arguments.source,
            arguments.revision,
            arguments.destination,
            history_depth=None if arguments.full_history else arguments.history_depth,
        )
    except CheckoutError as exc:
        print(
            json.dumps(
                {
                    "schema": "literate-ai/repository-checkout-error@1",
                    "ok": False,
                    "error": {"code": exc.code, "message": exc.message},
                },
                sort_keys=True,
                separators=(",", ":"),
            )
        )
        return 1
    print(json.dumps(report, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
