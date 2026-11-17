"""Bounded Leidos REST transport. No implicit retries or redirect credential forwarding."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import json
import os
import re
import time
from urllib.parse import quote

import httpx

from .schema import VERSION

ORIGINS = {
    "lab": "https://ffspelabs.leidos.com/Website2/rest",
    "production": "https://www.1800wxbrief.com/Website/rest",
}
MAX_RESPONSE = 1_048_576


class Unavailable(RuntimeError):
    pass


class AccessDenied(RuntimeError):
    pass


class ProtocolError(RuntimeError):
    pass


class UnknownOutcome(RuntimeError):
    pass


@dataclass(frozen=True)
class Configuration:
    environment: str | None
    username: str = field(repr=False)
    password: str = field(repr=False)
    approval_reference: str

    @classmethod
    def load(cls, env=None):
        env = os.environ if env is None else env
        return cls(
            env.get("FLIGHT_SERVICE_ENVIRONMENT"),
            env.get("FLIGHT_SERVICE_VENDOR_USERNAME", ""),
            env.get("FLIGHT_SERVICE_VENDOR_PASSWORD", ""),
            env.get("FLIGHT_SERVICE_OPERATIONS_APPROVAL_REFERENCE", ""),
        )

    @property
    def configured(self):
        return self.environment in ORIGINS and bool(self.username and self.password)

    @property
    def fingerprint(self):
        return hashlib.sha256(
            json.dumps(
                [self.environment, self.username, self.password, self.approval_reference],
                separators=(",", ":"),
            ).encode()
        ).hexdigest()

    def capabilities(self):
        return {
            "provider": "Leidos Flight Service",
            "environment": self.environment if self.environment in ORIGINS else None,
            "configured": self.configured,
            "production_approval_attested": bool(self.approval_reference),
            "provider_access_verified": False,
            "pilot_authorization": "not_checked",
            "actions": {
                "VFR": ["file", "amend", "activate", "cancel", "close"],
                "IFR": ["file", "amend", "cancel"],
            },
            "automatic_polling": False,
            "automatic_mutation_retries": False,
        }

    def require(self, *, mutation=False):
        if not self.configured:
            raise Unavailable(
                "Select a Flight Service environment and configure vendor access on the server"
            )
        if mutation and self.environment == "production" and not self.approval_reference:
            raise Unavailable(
                "Production Flight Service operations are not enabled by an operator approval reference"
            )


def flight_id(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", value):
        raise ProtocolError("Provider returned an invalid flight identifier")
    return value


def stamp(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{17}", value):
        raise ProtocolError("Provider returned an invalid version stamp")
    return value


def messages(body):
    plain = body.get("returnMessage", [])
    coded = body.get("returnCodedMessage", [])
    if plain is None:
        plain = []
    if coded is None:
        coded = []
    if (
        not isinstance(plain, list)
        or len(plain) > 100
        or any(not isinstance(v, str) or len(v) > 4000 for v in plain)
    ):
        raise ProtocolError("Invalid provider message list")
    if (
        not isinstance(coded, list)
        or len(coded) > 100
        or any(
            not isinstance(v, dict)
            or len(json.dumps(v)) > 8000
            or not isinstance(v.get("code"), str)
            or not isinstance(v.get("message"), str)
            for v in coded
        )
    ):
        raise ProtocolError("Invalid provider coded-message list")
    return plain, coded


@dataclass
class Reply:
    body: dict
    source: dict


def _redact(value, secrets):
    if isinstance(value, str):
        for secret in secrets:
            if secret:
                value = value.replace(secret, "[redacted]")
        return value
    if isinstance(value, list):
        return [_redact(v, secrets) for v in value]
    if isinstance(value, dict):
        return {
            k: (
                "[redacted]"
                if k.lower() in {"authorization", "password", "vendorpassword"}
                else _redact(v, secrets)
            )
            for k, v in value.items()
        }
    return value


class Client:
    def __init__(self, config=None, *, transport=None):
        self.config = config or Configuration.load()
        self.transport = transport

    def request(self, method, path, *, data=None, params=None, mutation=False):
        self.config.require(mutation=mutation)
        if not re.fullmatch(
            r"/FP/[A-Za-z0-9_%@.+-]+/(?:retrieve|retrieveFlightPlanSummaries|amend|activate|cancel|close)|/FP/file",
            path,
        ):
            raise ValueError("Unsupported Flight Service operation path")
        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "identity",
            "Content-Type": "application/x-www-form-urlencoded",
        }
        deadline = time.monotonic() + 60
        try:
            with httpx.Client(
                transport=self.transport,
                timeout=httpx.Timeout(30, connect=8, write=10, pool=10),
                follow_redirects=False,
                trust_env=False,
            ) as client:
                with client.stream(
                    method,
                    ORIGINS[self.config.environment] + path,
                    headers=headers,
                    auth=httpx.BasicAuth(self.config.username, self.config.password),
                    data=data,
                    params=params,
                ) as response:
                    status = response.status_code
                    if status in {401, 403}:
                        raise AccessDenied(
                            "Flight Service rejected the vendor credentials or access"
                        )
                    if status != 200:
                        if mutation:
                            raise UnknownOutcome(
                                f"Flight Service outcome is unknown after HTTP {status}; do not resend automatically"
                            )
                        raise Unavailable(f"Flight Service read failed (HTTP {status})")
                    if response.headers.get("content-encoding", "identity").lower() not in {
                        "identity",
                        "",
                    }:
                        raise ProtocolError("Unsupported provider response encoding")
                    payload = bytearray()
                    for chunk in response.iter_raw():
                        if time.monotonic() > deadline:
                            raise ProtocolError("Provider response exceeded its total time budget")
                        if len(payload) + len(chunk) > MAX_RESPONSE:
                            raise ProtocolError("Provider response exceeded its size limit")
                        payload.extend(chunk)
            body = json.loads(
                payload,
                parse_constant=lambda value: (_ for _ in ()).throw(ValueError("Non-finite JSON")),
            )
            if not isinstance(body, dict) or type(body.get("returnStatus")) is not bool:
                raise ProtocolError("Provider response lacks a boolean return status")
            messages(body)
            clean = _redact(body, [self.config.username, self.config.password])
            return Reply(
                clean,
                {
                    "provider": "Leidos Flight Service",
                    "environment": self.config.environment,
                    "retrieved_at": datetime.now(timezone.utc).isoformat(),
                    "raw_response_sha256": hashlib.sha256(payload).hexdigest(),
                    "redacted": clean != body,
                },
            )
        except (AccessDenied, Unavailable, UnknownOutcome):
            raise
        except (httpx.HTTPError, ValueError, ProtocolError, RecursionError) as error:
            if mutation:
                raise UnknownOutcome(
                    "Flight Service outcome is unknown; reconcile before attempting another action"
                ) from error
            raise Unavailable(
                "Flight Service returned an unavailable or invalid read response"
            ) from error

    def summaries(self, pilot_account):
        if not isinstance(pilot_account, str) or not pilot_account or len(pilot_account) > 254:
            raise ValueError("A pilot Flight Service account is required")
        reply = self.request(
            "GET",
            "/FP/" + quote(pilot_account, safe="") + "/retrieveFlightPlanSummaries",
            params={"versionRequested": VERSION, "includeCodedMessages": "true"},
        )
        body = reply.body
        if body["returnStatus"]:
            rows = body.get("flightPlanSummary")
            # The schema allows an omitted zero-length collection, but only with
            # an explicit successful provider return status.
            if rows is None:
                rows = []
            if not isinstance(rows, list) or len(rows) > 1000:
                raise Unavailable("Invalid provider flight-plan summary collection")
            for row in rows:
                if not isinstance(row, dict):
                    raise Unavailable("Invalid provider flight-plan summary")
                try:
                    flight_id(row.get("flightId"))
                    stamp(row.get("versionStamp"))
                except ProtocolError as error:
                    raise Unavailable(str(error)) from error
            body["flightPlanSummary"] = rows
        return reply

    def retrieve(self, identifier):
        reply = self.request(
            "GET",
            "/FP/" + flight_id(identifier) + "/retrieve",
            params={"versionRequested": VERSION, "includeCodedMessages": "true"},
        )
        body = reply.body
        if body["returnStatus"]:
            try:
                stamp(body.get("versionStamp"))
            except ProtocolError as error:
                raise Unavailable(str(error)) from error
            if not isinstance(body.get("currentState"), str) or not isinstance(
                body.get("icaoFlightPlan"), dict
            ):
                raise Unavailable("Provider did not return the requested ICAO flight-plan state")
        return reply

    def mutate(self, action, form, identifier=None):
        if action not in {"file", "amend", "activate", "cancel", "close"}:
            raise ValueError("Unknown filing action")
        path = "/FP/file" if action == "file" else "/FP/" + flight_id(identifier) + "/" + action
        reply = self.request("POST", path, data=form, mutation=True)
        body = reply.body
        if body["returnStatus"]:
            try:
                if action == "file":
                    flight_id(body.get("flightIdentifier"))
                if action in {"file", "amend", "activate"}:
                    stamp(body.get("versionStamp"))
            except ProtocolError as error:
                raise UnknownOutcome(
                    "Provider acknowledgement has an incomplete receipt; reconcile before another action"
                ) from error
        return reply
