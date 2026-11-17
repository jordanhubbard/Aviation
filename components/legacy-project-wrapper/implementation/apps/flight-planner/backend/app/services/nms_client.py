"""Internal FAA NMS wire adapter; the durable feed coordinator owns data cadence."""

import json
import zlib
import math
import threading
import time
from urllib.parse import urlsplit
from email.utils import parsedate_to_datetime

import httpx


def reject_constant(_):
    raise ValueError("Non-finite JSON constant")


ORIGINS = {
    "production": "https://api-nms.aim.faa.gov",
    "staging": "https://api-staging.cgifederal-aim.com",
    "fit": "https://api-fit.cgifederal-aim.com",
}


class NMSUnavailable(RuntimeError):
    def __init__(self, message, *, status=None, retry_after=None):
        super().__init__(message)
        self.status = status
        self.retry_after = retry_after


class NMSClient:
    """No secrets in errors, disk artifacts, redirects or public response metadata."""

    def __init__(
        self,
        environment,
        key,
        secret,
        *,
        transport=None,
        clock=time.monotonic,
        pause=time.sleep,
        wall_clock=time.time,
    ):
        if environment not in ORIGINS:
            raise ValueError("Select an explicit supported NMS environment")
        if not key or not secret or key == secret or any(c in key + secret for c in "\r\n"):
            raise ValueError("Distinct NMS key and secret are required")
        self.environment = environment
        self.origin = ORIGINS[environment]
        self._key, self._secret = key, secret
        self._token, self._expires = None, 0
        self._clock = clock
        self._pause, self._wall_clock = pause, wall_clock
        self._wire_lock, self._next_wire = threading.Lock(), 0
        self._lock = threading.RLock()
        self._http = httpx.Client(
            timeout=httpx.Timeout(40, connect=10),
            follow_redirects=False,
            trust_env=False,
            transport=transport,
        )

    def close(self):
        self._http.close()
        self._token, self._expires = None, 0

    def _read(self, method, path, *, limit, **kwargs):
        with self._wire_lock:
            delay = self._next_wire - self._clock()
            if delay > 0:
                self._pause(delay)
            self._next_wire = self._clock() + 1.05
            return self._send(method, path, limit=limit, **kwargs)

    def _send(self, method, path, *, limit, **kwargs):
        try:
            with self._http.stream(method, self.origin + path, **kwargs) as response:
                if response.status_code != 200:
                    retry_after = response.headers.get("retry-after", "")
                    retry_after = (
                        min(int(retry_after), 86400)
                        if retry_after.isascii()
                        and retry_after.isdecimal()
                        and len(retry_after) <= 8
                        else None
                    )
                    if retry_after is None and response.headers.get("retry-after"):
                        try:
                            instant = parsedate_to_datetime(response.headers["retry-after"])
                            if instant.utcoffset() is not None:
                                retry_after = max(
                                    0,
                                    min(86400, math.ceil(instant.timestamp() - self._wall_clock())),
                                )
                        except (ValueError, TypeError, OverflowError):
                            pass
                    raise NMSUnavailable(
                        f"NMS provider unavailable (HTTP {response.status_code})",
                        status=response.status_code,
                        retry_after=retry_after,
                    )
                chunks, size = [], 0
                deadline = self._clock() + 120
                for chunk in response.iter_bytes():
                    if self._clock() > deadline:
                        raise NMSUnavailable("NMS response exceeded its time limit")
                    size += len(chunk)
                    if size > limit:
                        raise NMSUnavailable("NMS response exceeds the allowed size")
                    chunks.append(chunk)
                return b"".join(chunks)
        except httpx.HTTPError:
            raise NMSUnavailable("NMS provider connection failed") from None

    def _bearer(self, rejected=None):
        import json

        with self._lock:
            if self._token and self._clock() < self._expires and self._token != rejected:
                return self._token
            started = self._clock()
            raw = self._read(
                "POST",
                "/v1/auth/token",
                limit=65536,
                auth=(self._key, self._secret),
                data={"grant_type": "client_credentials"},
            )
            try:
                value = json.loads(raw, parse_constant=reject_constant)
                token, lifetime = value["access_token"], float(value["expires_in"])
                if (
                    not isinstance(token, str)
                    or not 1 <= len(token) <= 16384
                    or any(ord(c) < 33 or ord(c) > 126 for c in token)
                    or isinstance(value["expires_in"], bool)
                    or not math.isfinite(lifetime)
                    or lifetime <= 0
                    or lifetime > 86400
                ):
                    raise ValueError()
            except (ValueError, TypeError, KeyError):
                raise NMSUnavailable(
                    "NMS authentication returned an invalid token envelope"
                ) from None
            self._token = token
            self._expires = started + max(0, lifetime - min(60, lifetime / 10))
            return token

    def get_json(self, resource, *, params=None, archive=None):
        """Only the cadence-reserving coordinator may call this data operation."""
        import json

        if resource not in {"notams", "notams/checklist", "locationseries"}:
            raise ValueError("Unsupported NMS data resource")
        token = self._bearer()
        for attempt in range(2):
            try:
                raw = self._read(
                    "GET",
                    "/nmsapi/v1/" + resource,
                    limit=24 * 1024 * 1024,
                    params=params,
                    headers={"Authorization": "Bearer " + token, "nmsResponseFormat": "GEOJSON"},
                )
                break
            except NMSUnavailable as error:
                if attempt or error.status != 401:
                    raise
                token = self._bearer(rejected=token)
        try:
            value = json.loads(raw, parse_constant=reject_constant)
            if (
                not isinstance(value, dict)
                or value.get("status") != "Success"
                or value.get("errors")
                or not isinstance(value.get("data"), dict)
            ):
                raise ValueError()
            if archive is not None and "geojson" in value["data"] and "url" not in value["data"]:
                archive(raw)
            return value["data"]
        except (ValueError, TypeError):
            raise NMSUnavailable("NMS returned an invalid or partial data envelope") from None

    def content_path(self, value):
        """Validate provider content references before any authenticated download."""
        if not isinstance(value, str) or len(value) > 8192:
            raise NMSUnavailable("NMS content reference is invalid")
        try:
            parsed = urlsplit(value)
        except ValueError:
            raise NMSUnavailable("NMS content reference is invalid") from None
        if (
            parsed.scheme
            or parsed.netloc
            or parsed.query
            or parsed.fragment
            or not parsed.path.startswith("/nmsapi/v1/content/")
            or not parsed.path.removeprefix("/nmsapi/v1/content/")
            or any(c in value for c in ("\\", "%"))
            or any(ord(c) < 33 or ord(c) > 126 for c in value)
            or any(part in {".", ".."} for part in parsed.path.split("/"))
        ):
            raise NMSUnavailable("NMS content reference is invalid")
        return value

    def features(self, params, *, archive=None):
        """Read one coordinator-reserved GeoJSON pull, including bounded bulk content."""
        data = self.get_json("notams", params={**params, "allowRedirect": "false"}, archive=archive)
        if "url" in data:
            if set(data) != {"url"}:
                raise NMSUnavailable("NMS returned ambiguous content coverage")
            path = self.content_path(data["url"])
            token = self._bearer()
            for attempt in range(2):
                try:
                    raw = self._read(
                        "GET",
                        path,
                        limit=128 * 1024 * 1024,
                        headers={"Authorization": "Bearer " + token},
                    )
                    break
                except NMSUnavailable as error:
                    if attempt or error.status != 401:
                        raise
                    token = self._bearer(rejected=token)
            if archive is not None:
                archive(raw)
            return decode_features(raw)
        if "geojson" not in data or set(data) != {"geojson"}:
            raise NMSUnavailable("NMS response lacks explicit GeoJSON coverage")
        return feature_list(data["geojson"])


def feature_list(value):
    if isinstance(value, dict) and value.get("type") == "FeatureCollection":
        collection = value
        value = collection.get("features")
        if collection.get("truncated") or collection.get("hasMore") or collection.get("next"):
            raise NMSUnavailable("NMS GeoJSON collection declares incomplete coverage")
        if isinstance(value, list):
            for name in ("numberMatched", "totalFeatures"):
                total = collection.get(name)
                if type(total) in (int, float) and total > len(value):
                    raise NMSUnavailable("NMS GeoJSON collection declares incomplete coverage")
    if not isinstance(value, list) or len(value) > 250000:
        raise NMSUnavailable("NMS GeoJSON collection is invalid or oversized")
    if any(not isinstance(row, dict) or row.get("type") != "Feature" for row in value):
        raise NMSUnavailable("NMS GeoJSON collection contains an invalid feature")
    return value


def decode_features(raw):
    try:
        if raw.startswith(b"\x1f\x8b"):
            decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
            raw = decoder.decompress(raw, 256 * 1024 * 1024 + 1)
            if len(raw) > 256 * 1024 * 1024 or not decoder.eof or decoder.unused_data:
                raise ValueError()
        value = json.loads(raw, parse_constant=reject_constant)
        if isinstance(value, dict) and "status" in value:
            if value.get("status") != "Success" or value.get("errors"):
                raise ValueError()
            if set(value["data"]) != {"geojson"}:
                raise ValueError()
            value = value["data"]["geojson"]
        return feature_list(value)
    except (ValueError, TypeError, KeyError, zlib.error):
        raise NMSUnavailable("NMS bulk GeoJSON is invalid, partial or oversized") from None
