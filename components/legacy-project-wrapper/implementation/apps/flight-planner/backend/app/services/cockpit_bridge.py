"""Operator-owned UDP lifecycle and bounded, source-separated receiver state."""

from __future__ import annotations

import asyncio
from collections import Counter, OrderedDict, deque
from dataclasses import dataclass
from datetime import datetime, timezone
import ipaddress
import threading
import time

from aviation_avionics.gdl90 import Gdl90Decoder, resolve_geometric_altitude


@dataclass(frozen=True)
class ReceiverSettings:
    bind: str = "0.0.0.0"
    port: int = 4000
    allowed_sources: tuple[str, ...] = ()

    def __post_init__(self):
        ipaddress.ip_address(self.bind)
        if (
            isinstance(self.port, bool)
            or not isinstance(self.port, int)
            or not 0 <= self.port <= 65535
        ):
            raise ValueError("UDP port must be between 0 and 65535")
        if not self.allowed_sources:
            raise ValueError("Configure at least one receiver source address or network")
        for source in self.allowed_sources:
            ipaddress.ip_network(source, strict=False)


class ReceiverState:
    def __init__(self, settings: ReceiverSettings, *, clock=time.monotonic, wall_clock=time.time):
        self.settings, self.clock, self.wall_clock = settings, clock, wall_clock
        self.networks = tuple(
            ipaddress.ip_network(n, strict=False) for n in settings.allowed_sources
        )
        self.lock = threading.RLock()
        self.running = False
        self.bound_port = None
        self.session = 0
        self.senders = OrderedDict()
        self.tracks = OrderedDict()
        self.weather = OrderedDict()
        self.recent = deque(maxlen=128)
        self.counters, self.errors = Counter(), Counter()
        self.tokens, self.token_time = 100.0, clock()
        self.byte_tokens = 256 * 1024.0
        self.elapsed_time = 0.0
        self.observed_monotonic, self.observed_wall = self.token_time, wall_clock()

    def listening(self, port):
        with self.lock:
            self.session += 1
            self.senders.clear()
            self.tracks.clear()
            self.weather.clear()
            self.recent.clear()
            self.counters.clear()
            self.errors.clear()
            self.running, self.bound_port = True, port
            self.tokens, self.token_time = 100.0, self.clock()
            self.byte_tokens = 256 * 1024.0
            self.elapsed_time = 0.0
            self.observed_monotonic, self.observed_wall = (
                self.token_time,
                self.wall_clock(),
            )

    def stopped(self):
        with self.lock:
            self.running, self.bound_port = False, None

    def _observe_time(self, at, wall):
        monotonic_delta, wall_delta = (
            at - self.observed_monotonic,
            wall - self.observed_wall,
        )
        if abs(monotonic_delta - wall_delta) > 1:
            self.counters["clock_discontinuities"] += 1
        self.elapsed_time += max(0, monotonic_delta, wall_delta)
        self.observed_monotonic, self.observed_wall = at, wall
        return self.elapsed_time

    @staticmethod
    def _age(row, elapsed_time):
        row["age_floor"] = max(row["age_floor"], elapsed_time - row["elapsed_at"], 0)
        return row["age_floor"]

    def _expire_profiles(self, elapsed_time):
        for sender in self.senders.values():
            if sender.get("profile_active") and elapsed_time - sender["profile_activity_at"] > 5:
                sender["profile_active"] = False
                sender["profile_unknown"] = True

    def _expire(self, elapsed_time):
        self._expire_profiles(elapsed_time)
        for key, envelope in list(self.tracks.items()):
            if self._age(envelope, elapsed_time) > 60:
                del self.tracks[key]
                self.counters["expired_tracks"] += 1

        for key, envelope in list(self.weather.items()):
            if self._age(envelope, elapsed_time) > 900:
                del self.weather[key]
                self.counters["expired_weather"] += 1

    def ingest(self, data: bytes, address, *, session=None):
        with self.lock:
            if not self.running or (session is not None and session != self.session):
                return
            self.counters["datagrams"] += 1
            try:
                source = ipaddress.ip_address(address[0])
            except ValueError:
                self.counters["rejected_sources"] += 1
                return
            if not any(source in network for network in self.networks):
                self.counters["rejected_sources"] += 1
                return
            at = self.clock()
            wall = self.wall_clock()
            elapsed_time = self._observe_time(at, wall)
            elapsed = max(0, at - self.token_time)
            self.tokens = min(100.0, self.tokens + elapsed * 200)
            self.byte_tokens = min(256 * 1024.0, self.byte_tokens + elapsed * 1024 * 1024)
            self.token_time = at
            if self.tokens < 1:
                self.counters["rate_limited_datagrams"] += 1
                return
            self.tokens -= 1
            if len(data) > 65535:
                self.counters["oversized_datagrams"] += 1
                return
            if len(data) > self.byte_tokens:
                self.counters["byte_rate_limited_datagrams"] += 1
                return
            self.byte_tokens -= len(data)
            sender_id = (
                f"[{source}]:{address[1]}" if source.version == 6 else f"{source}:{address[1]}"
            )
            self._expire(elapsed_time)
            if sender_id not in self.senders and len(self.senders) >= 8:
                self.counters["sender_limit_datagrams"] += 1
                return
            decoder = Gdl90Decoder()
            decoded = decoder.push(data)
            self.errors.update(decoded["errors"] + decoder.finish()["errors"])
            if not decoded["messages"]:
                return
            timestamp = datetime.fromtimestamp(wall, timezone.utc).isoformat()
            for report in decoded["messages"]:
                self.counters["reports"] += 1
                envelope = {
                    "source_id": sender_id,
                    "received_at": timestamp,
                    "elapsed_at": elapsed_time,
                    "age_floor": 0.0,
                    "report": report,
                }
                self.recent.append(envelope)
                kind = report["kind"]
                if kind == "uplink":
                    self.errors.update("uplink-" + code for code in report["errors"])
                    self.counters["unsupported_weather_frames"] += report["unsupported_frames"]
                    for record in report["records"]:
                        key = (sender_id, record["raw_text"])
                        if key in self.weather:
                            self.counters["duplicate_weather"] += 1
                        self.weather[key] = {
                            **envelope,
                            "report": {
                                **record,
                                "kind": "fisb_text",
                                "message_id": 7,
                                "payload_hex": report["payload_hex"],
                                "product_age_seconds": None,
                                "validity": "unassessed",
                            },
                        }
                        self.weather.move_to_end(key)
                        if len(self.weather) > 128:
                            self.weather.popitem(last=False)
                            self.counters["evicted_weather"] += 1
                    if not report["records"]:
                        continue
                if kind == "unsupported":
                    if report["message_id"] == 0x65 and report["payload_hex"].startswith("6500"):
                        sender = self.senders.setdefault(sender_id, {"last_known": None})
                        sender["profile_active"] = False
                        sender["profile_unknown"] = True
                    self.counters["unsupported_reports"] += 1
                    continue
                sender = self.senders.setdefault(sender_id, {"last_known": None})
                if kind == "device_id":
                    previous = sender.get("device_id")
                    previous_serial = previous["report"]["serial_number_hex"] if previous else None
                    if (
                        previous_serial is not None
                        and report["serial_number_hex"] is not None
                        and previous_serial != report["serial_number_hex"]
                    ):
                        for field in ("heartbeat", "ownship", "geometric_altitude"):
                            sender.pop(field, None)
                        sender["last_known"] = None
                        for key in list(self.tracks):
                            if key[0] == sender_id:
                                del self.tracks[key]
                        for key in list(self.weather):
                            if key[0] == sender_id:
                                del self.weather[key]
                    sender.update(
                        device_id=envelope,
                        profile_active=True,
                        profile_unknown=False,
                        profile_activity_at=elapsed_time,
                    )
                    continue
                if kind == "geometric_altitude":
                    active_id = sender.get("device_id") if sender.get("profile_active") else None
                    envelope["report"] = resolve_geometric_altitude(
                        report,
                        active_id["report"] if active_id else None,
                        profile_unknown=sender.get("profile_unknown", False),
                    )
                if sender.get("profile_active"):
                    sender["profile_activity_at"] = elapsed_time
                sender["last_known"] = envelope
                if kind in {"heartbeat", "ownship", "geometric_altitude"}:
                    sender[kind] = envelope
                elif kind == "traffic":
                    key = (
                        sender_id,
                        report["address_type"],
                        report["participant_address"],
                    )
                    self.tracks[key] = envelope
                    self.tracks.move_to_end(key)
                    if len(self.tracks) > 500:
                        self.tracks.popitem(last=False)
                        self.counters["evicted_tracks"] += 1

    def snapshot(self, *, include_reports=True):
        with self.lock:
            at = self.clock()
            wall = self.wall_clock()
            elapsed_time = self._observe_time(at, wall)
            self._expire(elapsed_time)

            def envelope(row, *, stale_after=5):
                if row is None:
                    return None
                age = self._age(row, elapsed_time)
                return {k: row[k] for k in ("source_id", "received_at")} | {
                    "report": dict(row["report"]),
                    "age_seconds": age,
                    "live": self.running and age <= stale_after,
                    "stale": age > stale_after,
                }

            receivers = []
            for identity, sender in self.senders.items():
                heartbeat = envelope(sender.get("heartbeat"))
                ownship = envelope(sender.get("ownship"))
                if ownship is not None:
                    ownship["gps_fix_valid"] = (
                        bool(
                            ownship["live"]
                            and ownship["report"]["position_valid"]
                            and heartbeat["report"]["gps_position_valid"]
                        )
                        if heartbeat and heartbeat["live"]
                        else None
                    )
                last = sender["last_known"]
                receivers.append(
                    {
                        "source_id": identity,
                        "connected": self.running
                        and last is not None
                        and self._age(last, elapsed_time) <= 5,
                        "device_id": envelope(sender.get("device_id")),
                        "device_profile_valid": (
                            (not sender.get("profile_unknown", False))
                            if sender.get("device_id") or sender.get("profile_unknown")
                            else None
                        ),
                        "heartbeat": heartbeat,
                        "ownship": ownship,
                        "geometric_altitude": envelope(sender.get("geometric_altitude")),
                    }
                )
            result = {
                "source": "local-udp-gdl90",
                "session": self.session,
                "listening": self.running,
                "udp_bind": self.settings.bind,
                "udp_port": self.bound_port,
                "connected": any(r["connected"] for r in receivers),
                "counters": dict(self.counters),
                "decode_errors": dict(self.errors),
                "capabilities": {
                    "heartbeat": True,
                    "ownship": True,
                    "traffic": True,
                    "geometric_altitude": True,
                    "device_id": True,
                    "weather_decoding": True,
                    "weather_product_ids": [413],
                    "weather_segmented": False,
                    "weather_graphical": False,
                },
                "limitations": [
                    "Advisory receiver reports; coverage is not complete traffic surveillance.",
                    "Receiver text product 413 only; segmented and graphical weather are not decoded.",
                    "Weather receipt age does not establish product age or validity.",
                    "Receiver heartbeat time has no inferred calendar date.",
                ],
            }
            if include_reports:
                result.update(
                    receivers=receivers,
                    traffic=[envelope(row, stale_after=15) for row in self.tracks.values()],
                    recent_reports=[envelope(row) for row in self.recent],
                    weather=[
                        {**envelope(row, stale_after=900), "live": False}
                        for row in self.weather.values()
                    ],
                )
            return result


class _Protocol(asyncio.DatagramProtocol):
    def __init__(self, state, closed):
        self.state, self.closed = state, closed
        self.session = None

    def datagram_received(self, data, address):
        self.state.ingest(data, address, session=self.session)

    def error_received(self, _error):
        with self.state.lock:
            if self.state.running and self.session == self.state.session:
                self.state.counters["udp_errors"] += 1

    def connection_lost(self, _error):
        with self.state.lock:
            if self.session == self.state.session:
                self.state.stopped()
        if not self.closed.done():
            self.closed.set_result(None)


class ReceiverBridge:
    def __init__(self, state: ReceiverState):
        self.state = state
        self.transport = self.protocol = None
        self.lifecycle = asyncio.Lock()

    async def start(self):
        async with self.lifecycle:
            if self.transport is not None:
                if not self.transport.is_closing():
                    return self.state.snapshot(include_reports=False)
                await asyncio.wait_for(asyncio.shield(self.protocol.closed), timeout=2)
                self.transport = self.protocol = None
            loop = asyncio.get_running_loop()
            protocol = _Protocol(self.state, loop.create_future())
            transport, _ = await loop.create_datagram_endpoint(
                lambda: protocol,
                local_addr=(self.state.settings.bind, self.state.settings.port),
            )
            self.state.listening(transport.get_extra_info("sockname")[1])
            protocol.session = self.state.session
            self.transport, self.protocol = transport, protocol
            return self.state.snapshot(include_reports=False)

    async def stop(self):
        async with self.lifecycle:
            self.state.stopped()
            if self.transport is not None:
                transport, protocol = self.transport, self.protocol
                transport.close()
                await asyncio.wait_for(asyncio.shield(protocol.closed), timeout=2)
                self.transport = self.protocol = None
            return self.state.snapshot(include_reports=False)
