"""Owned foreground NMS synchronization worker; web startup never starts a feed."""

import argparse
import json
import os
from pathlib import Path
import signal
import threading

from .nms_cache import NMSCache
from .nms_client import NMSClient, NMSUnavailable, ORIGINS


class SyncStopped(NMSUnavailable):
    pass


def configuration():
    environment = os.environ.get("FAA_NMS_ENVIRONMENT")
    if environment not in ORIGINS:
        raise ValueError("Explicit FAA_NMS_ENVIRONMENT is required")
    from ..secrets import get_secret

    key = os.environ.get("FAA_NMS_CLIENT_ID") or get_secret("FAA_NMS_CLIENT_ID")
    secret = os.environ.get("FAA_NMS_CLIENT_SECRET") or get_secret("FAA_NMS_CLIENT_SECRET")
    if not key or not secret:
        raise ValueError("NMS server credentials are not configured")
    root = os.environ.get("FAA_NMS_CACHE_DIR")
    if not root:
        data = os.environ.get("DATA_DIR") or Path(__file__).resolve().parents[2] / "data"
        root = str(Path(data) / "nms" / environment)
    return environment, key, secret, root


def run(cache, client, *, once=False):
    """Run in the owning main thread so termination interrupts an in-flight read."""
    stopped = threading.Event()
    previous = {}
    last_status = None

    def terminate(signum, frame):
        stopped.set()
        raise SyncStopped("NMS synchronization stopped")

    for event in (signal.SIGTERM, signal.SIGINT):
        previous[event] = signal.signal(event, terminate)
    try:
        while not stopped.is_set():
            try:
                performed = cache.sync_once(client)
                status = cache.synchronization_status()
                report = {
                    "event": "nms_sync",
                    "environment": cache.environment,
                    "performed": performed,
                    "status": status["status"],
                    "complete_snapshot": status["complete_snapshot"],
                    "synchronized_at": status["synchronized_at"],
                }
                if performed or report != last_status:
                    print(json.dumps(report), flush=True)
                last_status = report
                code = 0
            except NMSUnavailable:
                code = 2
                if not stopped.is_set() and last_status != "error":
                    last_status = "error"
                    print(
                        json.dumps(
                            {"event": "nms_sync_unavailable", "environment": cache.environment}
                        ),
                        flush=True,
                    )
            if stopped.is_set():
                break
            if once:
                return code
            delay = cache.synchronization_status()["retry_in_seconds"]
            stopped.wait(min(30, max(1.05, delay)))
        return 0
    except SyncStopped:
        return 0
    finally:
        client.close()
        for event, handler in previous.items():
            signal.signal(event, handler)
        print(json.dumps({"event": "nms_worker_stopped"}), flush=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Synchronize the shared FAA NMS cache")
    parser.add_argument(
        "--once", action="store_true", help="Perform at most one reserved operation"
    )
    args = parser.parse_args(argv)
    try:
        environment, key, secret, root = configuration()
        cache = NMSCache(root, environment)
        client = NMSClient(environment, key, secret)
    except Exception:
        print(json.dumps({"event": "nms_configuration_unavailable"}), flush=True)
        return 2
    return run(cache, client, once=args.once)


if __name__ == "__main__":
    raise SystemExit(main())
