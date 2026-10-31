#!/usr/bin/env python3
"""Compose, detect, and optionally install selected Flavor host toolchains."""

from __future__ import annotations

import argparse
import json
import os
import platform as host_platform
import shutil
import socket
import struct
import subprocess
import sys
import time
from pathlib import Path

REPOSITORY = Path(__file__).resolve().parents[4]
SOURCE = REPOSITORY / "src"
if str(SOURCE) not in sys.path:
    sys.path.insert(0, str(SOURCE))

from literate_ai.adapters.host_install import (  # noqa: E402
    HostInstallError,
    apply_host_install_path,
    detect_current_install_target,
    ensure_host_install_dependencies,
    load_host_install_sbom,
    observe_host_install_dependencies,
)

CLOCK_SYNC_SOURCE = "time.nist.gov"
CLOCK_SYNC_TIMEOUT_SECONDS = 20
CLOCK_SYNC_CLOSE_ENOUGH_SECONDS = 1.0
NTP_UNIX_OFFSET = 2_208_988_800
NTP_PORT = 123


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--profile", choices=("sample-worker",), default="sample-worker"
    )
    parser.add_argument("--platform", choices=("macos", "linux", "windows"))
    parser.add_argument("--flavor", action="append", default=[], metavar="SELECTOR")
    parser.add_argument(
        "--coding-cli", choices=("codex", "claude", "cursor-agent", "opencode")
    )
    parser.add_argument("--install-missing", action="store_true")
    return parser


def _platform_family() -> str:
    system = host_platform.system().casefold()
    if system == "darwin":
        return "macos"
    if system == "windows":
        return "windows"
    if system == "linux":
        return "linux"
    raise HostInstallError(
        "host-install.platform-unsupported", f"unsupported worker platform: {system}"
    )


def _flavor_name(selector: str) -> str | None:
    """Reduce an already-selected coordinate to its local Flavor directory."""

    value = selector.strip()
    if not value or value.startswith("-"):
        return None
    value = value.removeprefix("+")
    if "::" in value:
        value = value.rsplit("::", 1)[1].removeprefix("+")
    if value.startswith("flavor://"):
        value = value.rsplit("/", 1)[-1]
    if ":" in value:
        _slot, value = value.split(":", 1)
    path = REPOSITORY / "flavors" / value / "host-toolchain.cdx.json"
    return value if path.is_file() else None


def _flavor_names(selectors: list[str]) -> tuple[str, ...]:
    return tuple(
        dict.fromkeys(
            name for selector in selectors if (name := _flavor_name(selector))
        )
    )


def _observation_map(report) -> dict[str, str | None]:
    return {
        item.requirement.capability: (
            str(item.executable) if item.ready and item.executable else None
        )
        for item in report.observations
    }


def _query_ntp_unix(host: str, timeout: float = 8.0) -> float:
    packet = b"\x1b" + (47 * b"\x00")
    last_error: OSError | None = None
    try:
        addresses = socket.getaddrinfo(host, NTP_PORT, type=socket.SOCK_DGRAM)
    except OSError as exc:
        raise OSError(f"NTP resolver failed: {exc}") from exc
    for family, socktype, proto, _canonical, address in addresses:
        try:
            with socket.socket(family, socktype, proto) as connection:
                connection.settimeout(timeout)
                connection.sendto(packet, address)
                data, _ignored = connection.recvfrom(512)
        except OSError as exc:
            last_error = exc
            continue
        if len(data) < 48:
            last_error = OSError("short NTP reply")
            continue
        seconds, fraction = struct.unpack("!II", data[40:48])
        return seconds - NTP_UNIX_OFFSET + fraction / 2**32
    raise OSError(str(last_error) if last_error else "NTP query failed")


def _clock_command(
    platform: str, environment: dict[str, str]
) -> tuple[str, ...] | None:
    path = environment.get("PATH")
    if platform == "windows":
        executable = shutil.which("w32tm.exe", path=path)
        return (executable, "/resync") if executable else None
    if platform == "macos":
        executable = shutil.which("sntp", path=path)
        return (executable, "-sS", CLOCK_SYNC_SOURCE) if executable else None
    timedatectl = shutil.which("timedatectl", path=path)
    if timedatectl:
        return (timedatectl, "set-ntp", "true")
    ntpdate = shutil.which("ntpdate", path=path)
    return (ntpdate, "-u", CLOCK_SYNC_SOURCE) if ntpdate else None


def _synchronize_clock(
    platform: str, environment: dict[str, str]
) -> dict[str, object]:
    try:
        offset = _query_ntp_unix(CLOCK_SYNC_SOURCE) - time.time()
    except OSError as exc:
        return {
            "attempted": True,
            "commands": [],
            "detail": str(exc)[:512],
            "source": CLOCK_SYNC_SOURCE,
            "status": "failed",
        }
    if abs(offset) <= CLOCK_SYNC_CLOSE_ENOUGH_SECONDS:
        return {
            "attempted": True,
            "commands": [],
            "detail": "host clock is within the accepted offset",
            "offset_seconds": round(offset, 3),
            "source": CLOCK_SYNC_SOURCE,
            "status": "ok",
        }
    command = _clock_command(platform, environment)
    if command is None:
        return {
            "attempted": True,
            "commands": [],
            "detail": f"offset {offset:.3f}s; no native clock command is available",
            "offset_seconds": round(offset, 3),
            "source": CLOCK_SYNC_SOURCE,
            "status": "failed",
        }
    try:
        completed = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=CLOCK_SYNC_TIMEOUT_SECONDS,
            env=environment,
        )
        detail = (completed.stdout + completed.stderr).strip()[:512]
        status = "ok" if completed.returncode == 0 else "failed"
    except (OSError, subprocess.TimeoutExpired) as exc:
        detail = str(exc)[:512]
        status = "failed"
    return {
        "attempted": True,
        "commands": [[Path(command[0]).name, *command[1:]]],
        "detail": detail,
        "offset_seconds": round(offset, 3),
        "source": CLOCK_SYNC_SOURCE,
        "status": status,
    }


def main() -> int:
    args = _parser().parse_args()
    environment = dict(os.environ)
    flavors = _flavor_names(args.flavor)
    commands: list[list[str]] = []
    platform = args.platform or "unknown"
    before = None

    try:
        platform = _platform_family()
        if args.platform is not None and args.platform != platform:
            raise HostInstallError(
                "host-install.platform-mismatch",
                f"worker is {platform}, not requested {args.platform}",
            )
        if args.coding_cli:
            environment["CODING_CLI"] = args.coding_cli
        target = detect_current_install_target(environment=environment)
        sbom_path, sbom = load_host_install_sbom(
            REPOSITORY / "flavors", target, flavor_names=flavors
        )

        def run(arguments, **kwargs):
            command = tuple(str(item) for item in arguments)
            if kwargs.get("timeout") == 1800:
                commands.append([Path(command[0]).name, *command[1:]])
            return subprocess.run(command, **kwargs)

        before = observe_host_install_dependencies(
            sbom_path=sbom_path,
            sbom=sbom,
            environment=environment,
            runner=run,
        )
        if args.install_missing:
            environment["LITAI_INSTALL_DEPENDENCIES"] = "yes"
            after = ensure_host_install_dependencies(
                sbom_root=REPOSITORY / "flavors",
                target=target,
                flavor_names=flavors,
                environment=environment,
                runner=run,
                interactive=False,
            )
        else:
            after = before
    except HostInstallError as exc:
        return _emit_failure(
            args,
            platform,
            flavors,
            exc,
            before=before,
            commands=commands,
        )
    apply_host_install_path(after)
    clock_sync = _synchronize_clock(platform, environment)
    report = {
        "schema": "literate-ai/host-bootstrap-report@2",
        "platform": platform,
        "profile": args.profile,
        "selected_flavors": list(flavors),
        "coding_agent": after.coding_agent,
        "install_requested": args.install_missing,
        "commands": commands,
        "before": _observation_map(before),
        "after": _observation_map(after),
        "missing": [
            item.requirement.capability for item in after.missing
        ],
        "composition_warnings": [
            item.to_dict() for item in after.sbom.base.warnings
        ],
        "clock_sync": clock_sync,
        "path_entries": sorted(
            {
                str(item.executable.parent)
                for item in after.observations
                if item.executable
            }
            | {str(item) for item in after.managed_paths}
        ),
        "host_install": after.to_dict(),
        "passed": after.ready,
    }
    print(json.dumps(report, sort_keys=True, separators=(",", ":")))
    return 0 if after.ready else 1


def _emit_failure(
    args: argparse.Namespace,
    platform: str,
    flavors: tuple[str, ...],
    error: HostInstallError,
    *,
    before=None,
    commands: list[list[str]] | None = None,
) -> int:
    report = {
        "schema": "literate-ai/host-bootstrap-report@2",
        "platform": platform,
        "profile": args.profile,
        "selected_flavors": list(flavors),
        "coding_agent": args.coding_cli,
        "install_requested": args.install_missing,
        "commands": commands or [],
        "before": _observation_map(before) if before else {},
        "after": _observation_map(before) if before else {},
        "missing": (
            [item.requirement.capability for item in before.missing]
            if before
            else []
        ),
        "error": {"code": error.code, "message": error.message},
        "clock_sync": {"attempted": False, "status": "skipped"},
        "path_entries": [],
        "passed": False,
    }
    print(json.dumps(report, sort_keys=True, separators=(",", ":")))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
