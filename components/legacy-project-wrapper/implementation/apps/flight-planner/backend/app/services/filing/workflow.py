"""Explicit prepare/confirm workflow with durable uncertain-outcome reservations."""

from datetime import datetime, timedelta, timezone
from contextlib import ExitStack
import hashlib
import json
import re
import secrets
import time

from .provider import AccessDenied, Client, Unavailable, UnknownOutcome, flight_id
from .schema import Plan, amendment, form, instant, validate
from .store import Conflict, Invalid, Missing, Store, encoded, identifier, now_iso


def digest(value):
    return hashlib.sha256(encoded(value).encode()).hexdigest()


def timing_plan(baseline, snapshot):
    """Use retrieved timing/rules when ATC or another client changed them."""
    source = snapshot.get("icaoFlightPlan", {})
    if not isinstance(source, dict) or source.get("flightRules") not in {"IFR", "VFR"}:
        raise Invalid("Provider flight rules are missing; timing eligibility is unknown")
    value = source.get("departureInstant")
    try:
        if type(value) in {int, float}:
            departure = datetime.fromtimestamp(value / 1000, timezone.utc)
        elif isinstance(value, str):
            departure = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if departure.tzinfo is None:
                raise ValueError("Timezone is missing")
        else:
            raise ValueError("Departure is missing")
    except (ValueError, OverflowError, OSError) as error:
        raise Invalid(
            "Provider departure time is unavailable; timing eligibility is unknown"
        ) from error
    return baseline.model_copy(
        update={"flight_rules": source["flightRules"], "departure_instant": departure}
    )


def eligibility(action, plan, snapshot, inputs, now):
    """Local constraints; unknown ARTCC timing is left to the provider explicitly."""
    warnings = []
    if action == "file":
        if plan.departure_instant <= now:
            raise Invalid("A new filing requires a future departure time")
        return warnings
    state = snapshot.get("currentState")
    if state not in {"PROPOSED", "ACTIVE", "OVERDUE"}:
        raise Invalid("Refresh a supported open provider state before this action")
    if plan.flight_rules == "IFR":
        if action in {"activate", "close"}:
            raise Invalid("IFR activation and closure are handled by ATC")
        if state != "PROPOSED":
            raise Invalid("IFR amendment/cancellation requires a proposed plan")
        # Only use the provider's explicit ARTCC message address, never an
        # airport-prefix inference. Unknown source centers remain unknown.
        artcc = snapshot.get("artccInfo") or {}
        message = artcc.get("lastTransmittedMessage") or {} if isinstance(artcc, dict) else {}
        address = message.get("artccAddress") if isinstance(message, dict) else None
        center = (
            address[:4] if isinstance(address, str) and re.fullmatch(r"[A-Z]{8}", address) else None
        )
        if center:
            minutes = {
                "PAZA": 43,
                "KZBW": 55,
                "KZID": 61,
                "KZNY": 61,
                "PGZU": 1350,
                "PHZH": 1350,
            }.get(center, 46)
            if now >= plan.departure_instant - timedelta(minutes=minutes):
                raise Invalid(
                    "The source ARTCC's published IFR amendment/cancellation cutoff has passed"
                )
        else:
            warnings.append(
                "Departure ARTCC is unknown; local IFR timing eligibility cannot be established. Provider acceptance remains authoritative."
            )
    elif action in {"amend", "cancel"}:
        if action == "cancel" and state != "PROPOSED":
            raise Invalid("An active VFR plan requires closure rather than cancellation")
        if state == "PROPOSED" and now >= plan.departure_instant + timedelta(hours=2):
            raise Invalid("The proposed VFR amendment/cancellation window has passed")
    elif action == "activate":
        if state != "PROPOSED":
            raise Invalid("Only a proposed VFR plan can be activated")
        value = inputs.get("actual_departure")
        try:
            actual = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (AttributeError, TypeError, ValueError) as error:
            raise Invalid("Provide an explicit UTC actual departure") from error
        if actual.tzinfo is None or abs(actual - now) > timedelta(minutes=30):
            raise Invalid("Actual departure must be timezone-aware and within 30 minutes of now")
    elif action == "close":
        if state not in {"ACTIVE", "OVERDUE"}:
            raise Invalid("Closure requires an active or overdue VFR plan")
        if state == "OVERDUE" and not inputs.get("close_destination_info", "").strip():
            raise Invalid("Overdue closure requires explicit destination information")
    return warnings


class Workflow:
    def __init__(self, store: Store, provider: Client, *, clock=time.time):
        self.store, self.provider, self.clock = store, provider, clock

    @staticmethod
    def blocked(db, draft_id, filing_id=None, *, account=None, action=None):
        if db.execute(
            "SELECT 1 FROM operations WHERE status='unknown' AND (draft_id=? OR filing_id=?)",
            (draft_id, filing_id),
        ).fetchone():
            raise Conflict(
                "An earlier action has an uncertain outcome; reconcile it before another action"
            )
        if (
            action == "file"
            and db.execute(
                "SELECT 1 FROM operations WHERE status='unknown' AND action='file' AND account=?",
                (account,),
            ).fetchone()
        ):
            raise Conflict(
                "An uncertain filing for this pilot account must be reconciled before another filing"
            )

    def refresh(self, filing_id):
        with self.store.transaction() as db:
            filing = self.store.row(db, "filings", filing_id)
            self.blocked(db, filing["draft_id"], filing_id)
        if filing["environment"] != self.provider.config.environment:
            raise Conflict("Select this filing's original provider environment")
        reply = self.provider.retrieve(filing["provider_id"])
        if not reply.body["returnStatus"]:
            raise Unavailable(
                "Flight Service did not return the requested plan; absence does not establish closure"
            )
        with self.store.transaction() as db:
            current = self.store.row(db, "filings", filing_id)
            self.blocked(db, current["draft_id"], filing_id)
            if current["revision"] != filing["revision"]:
                raise Conflict("Filing changed during refresh; reload")
            db.execute(
                "UPDATE filings SET snapshot=?,source=?,revision=revision+1,updated=? WHERE id=?",
                (encoded(reply.body), encoded(reply.source), now_iso(), filing_id),
            )
            self.store.audit(
                db,
                filing_id,
                "provider_refreshed",
                {
                    "version_stamp": reply.body["versionStamp"],
                    "state": reply.body["currentState"],
                    "source": reply.source,
                },
            )
            return self.store.row(db, "filings", filing_id)

    def prepare(self, draft_id, revision, action, *, filing_id=None, inputs=None):
        if action not in {"file", "amend", "activate", "cancel", "close"}:
            raise Invalid("Unknown filing action")
        inputs = inputs or {}
        if not isinstance(inputs, dict) or set(inputs) - {
            "actual_departure",
            "close_destination_info",
        }:
            raise Invalid("Unsupported action inputs")
        if any(
            not isinstance(v, str) or not v.strip() or len(v) > 500 or any(ord(c) < 32 for c in v)
            for v in inputs.values()
        ):
            raise Invalid("Invalid action input")
        if len(inputs.get("close_destination_info", "")) > 100:
            raise Invalid("Closure destination information is limited to 100 characters")
        if ("actual_departure" in inputs and action != "activate") or (
            "close_destination_info" in inputs and action != "close"
        ):
            raise Invalid("Action inputs do not apply to this action")
        self.provider.config.require(mutation=True)
        if action != "file":
            if not filing_id:
                raise Invalid("Select an existing filing for this action")
            self.refresh(filing_id)
        elif filing_id is not None:
            raise Invalid("A file action cannot target an existing filing")
        with self.store.transaction() as db:
            draft = self.store.row(db, "drafts", draft_id)
            if type(revision) is not int or draft["revision"] != revision:
                raise Conflict("Draft changed; reload before preparing an action")
            self.blocked(db, draft_id, filing_id, account=draft["account"], action=action)
            filing = self.store.row(db, "filings", filing_id) if filing_id else None
            if filing and filing["draft_id"] != draft_id:
                raise Invalid("Filing does not belong to this draft")
            if (
                action == "file"
                and db.execute("SELECT 1 FROM filings WHERE draft_id=?", (draft_id,)).fetchone()
            ):
                raise Conflict("This draft already has a provider filing")
            proposed = Plan.model_validate(draft["plan"])
            baseline = Plan.model_validate(filing["submitted"]) if filing else proposed
            if action in {"file", "amend"} and not validate(proposed).format_valid:
                raise Invalid("Resolve draft validation issues before preparing this action")
            snapshot = filing["snapshot"] if filing else {}
            now = datetime.fromtimestamp(self.clock(), timezone.utc)
            effective = timing_plan(baseline, snapshot) if filing else baseline
            warnings = eligibility(action, effective, snapshot, inputs, now)
            if action == "file":
                wire = form(proposed)
                wire["webUserName"] = draft["account"]
            elif action == "amend":
                wire = amendment(baseline, proposed)
                if not set(wire) - {"type", "versionRequested", "includeCodedMessages"}:
                    raise Invalid("No explicitly changed fields to amend")
                wire["versionStamp"] = snapshot["versionStamp"]
            else:
                wire = {"includeCodedMessages": "true"}
                if action == "activate":
                    wire.update(
                        versionStamp=snapshot["versionStamp"],
                        actualDepartureInstant=instant(
                            datetime.fromisoformat(
                                inputs["actual_departure"].replace("Z", "+00:00")
                            )
                        ),
                    )
                if action == "close" and "close_destination_info" in inputs:
                    wire["closeDestinationInfo"] = inputs["close_destination_info"]
            token = secrets.token_urlsafe(32)
            expires = self.clock() + 300
            payload = {
                "action": action,
                "environment": self.provider.config.environment,
                "config": self.provider.config.fingerprint,
                "draft_id": draft_id,
                "draft_revision": revision,
                "filing_id": filing_id,
                "filing_revision": filing["revision"] if filing else None,
                "provider_id": filing["provider_id"] if filing else None,
                "account": draft["account"],
                "plan": proposed.model_dump(mode="json"),
                "baseline": effective.model_dump(mode="json"),
                "snapshot": snapshot,
                "form": wire,
                "inputs": inputs,
                "warnings": warnings,
            }
            db.execute(
                "INSERT INTO confirmations(token_hash,payload,expires) VALUES(?,?,?)",
                (digest(token), encoded(payload), expires),
            )
            self.store.audit(
                db,
                draft_id,
                "action_prepared",
                {
                    "action": action,
                    "environment": payload["environment"],
                    "draft_revision": revision,
                },
            )
            return {
                "confirmation_token": token,
                "expires_at": datetime.fromtimestamp(expires, timezone.utc).isoformat(),
                "action": action,
                "environment": payload["environment"],
                "draft_revision": revision,
                "plan": payload["plan"],
                "provider_state": snapshot.get("currentState"),
                "version_stamp": snapshot.get("versionStamp"),
                "provider_fields": wire,
                "warnings": warnings,
                "provider_mutation_sent": False,
                "changed_fields": (
                    [
                        key
                        for key, value in payload["plan"].items()
                        if filing and filing["submitted"].get(key) != value
                    ]
                    if action == "amend"
                    else []
                ),
            }

    def execute(self, token, idempotency_key, action, environment):
        with ExitStack() as ownership:
            return self._execute(token, idempotency_key, action, environment, ownership)

    def _execute(self, token, idempotency_key, action, environment, ownership):
        if (
            not isinstance(token, str)
            or not 32 <= len(token) <= 128
            or not isinstance(idempotency_key, str)
            or not re.fullmatch(r"[A-Za-z0-9_-]{16,128}", idempotency_key)
        ):
            raise Invalid(
                "A confirmation token and a 16–128 character idempotency key are required"
            )
        identity = digest([token, action, environment])
        with self.store.transaction() as db:
            previous = db.execute(
                "SELECT id,identity FROM operations WHERE idempotency_key=?", (idempotency_key,)
            ).fetchone()
            if previous:
                if previous["identity"] != identity:
                    raise Conflict("Idempotency key already belongs to a different request")
                return self.store.row(db, "operations", previous["id"])
            row = db.execute(
                "SELECT * FROM confirmations WHERE token_hash=?", (digest(token),)
            ).fetchone()
            if row is None or row["consumed"] or row["expires"] <= self.clock():
                raise Conflict(
                    "Confirmation expired, was consumed or does not exist; prepare a new review"
                )
            payload = json.loads(row["payload"])
            self.provider.config.require(mutation=True)
            if (
                payload["action"] != action
                or payload["environment"] != environment
                or payload["config"] != self.provider.config.fingerprint
            ):
                raise Conflict(
                    "Action, environment or provider configuration changed; prepare a new review"
                )
            draft = self.store.row(db, "drafts", payload["draft_id"])
            if draft["revision"] != payload["draft_revision"]:
                raise Conflict("Draft changed after review; prepare a new confirmation")
            filing = (
                self.store.row(db, "filings", payload["filing_id"])
                if payload["filing_id"]
                else None
            )
            if filing and filing["revision"] != payload["filing_revision"]:
                raise Conflict("Provider state changed after review; prepare a new confirmation")
            self.blocked(
                db, draft["id"], payload["filing_id"], account=draft["account"], action=action
            )
            if (
                action == "file"
                and db.execute("SELECT 1 FROM filings WHERE draft_id=?", (draft["id"],)).fetchone()
            ):
                raise Conflict("This draft already has a provider filing")
            eligibility(
                action,
                Plan.model_validate(payload["baseline"]),
                payload["snapshot"],
                payload["inputs"],
                datetime.fromtimestamp(self.clock(), timezone.utc),
            )
            operation = identifier("operation")
            ownership.enter_context(self.store.operation_guard(operation))
            moment = now_iso()
            # An interrupted process cannot lose the fact that transmission may
            # have happened. Unknown is durable BEFORE the first network byte.
            db.execute(
                "INSERT INTO operations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    operation,
                    idempotency_key,
                    identity,
                    draft["id"],
                    payload["filing_id"],
                    draft["account"],
                    action,
                    environment,
                    "unknown",
                    encoded(payload),
                    None,
                    None,
                    moment,
                    moment,
                    self.clock() + 120,
                ),
            )
            db.execute("UPDATE confirmations SET consumed=1 WHERE token_hash=?", (digest(token),))
            self.store.audit(
                db,
                operation,
                "transmission_reserved",
                {"action": action, "environment": environment, "draft_id": draft["id"]},
            )
        try:
            reply = self.provider.mutate(action, payload["form"], payload["provider_id"])
        except AccessDenied:
            return self.finish(
                operation,
                "rejected",
                {
                    "returnStatus": False,
                    "local_error": "Flight Service rejected credentials or access",
                },
                None,
            )
        except (Unavailable, UnknownOutcome):
            # The durable reservation remains uncertain and cannot be retried.
            with self.store.transaction() as db:
                self.store.audit(
                    db,
                    operation,
                    "outcome_uncertain",
                    {"reason": "No unambiguous provider receipt; explicit reconciliation required"},
                )
            return self.store.get("operations", operation)
        return self.finish(
            operation,
            "accepted" if reply.body["returnStatus"] else "rejected",
            reply.body,
            reply.source,
        )

    def finish(self, operation_id, status, body, source):
        with self.store.transaction() as db:
            operation = self.store.row(db, "operations", operation_id)
            if operation["status"] != "unknown":
                raise Conflict("Operation outcome has already been resolved")
            payload = operation["request"]
            filing_id = operation["filing_id"]
            moment = now_iso()
            if status == "accepted":
                # An acknowledgement is a receipt, not a retrieved current state.
                if operation["action"] == "file":
                    filing_id = identifier("filing")
                    db.execute(
                        "INSERT INTO filings VALUES(?,?,?,?,?,1,?,NULL,?,?)",
                        (
                            filing_id,
                            operation["draft_id"],
                            operation["account"],
                            body["flightIdentifier"],
                            operation["environment"],
                            encoded(payload["plan"]),
                            encoded(source),
                            moment,
                        ),
                    )
                else:
                    if operation["action"] == "amend":
                        db.execute(
                            "UPDATE filings SET submitted=? WHERE id=?",
                            (encoded(payload["plan"]), filing_id),
                        )
                    db.execute(
                        "UPDATE filings SET snapshot=NULL,source=?,revision=revision+1,updated=? WHERE id=?",
                        (encoded(source), moment, filing_id),
                    )
            db.execute(
                "UPDATE operations SET filing_id=?,status=?,response=?,source=?,updated=? WHERE id=?",
                (filing_id, status, encoded(body), encoded(source), moment, operation_id),
            )
            self.store.audit(
                db, operation_id, "provider_" + status, {"source": source, "filing_id": filing_id}
            )
            return self.store.row(db, "operations", operation_id)

    def reconcile(
        self, operation_id, resolution, reference, *, operator_attestation=False, provider_id=None
    ):
        """Resolve explicitly; an empty account list never proves non-filing."""
        with self.store.operation_guard(operation_id):
            return self._reconcile(
                operation_id,
                resolution,
                reference,
                operator_attestation=operator_attestation,
                provider_id=provider_id,
            )

    def _reconcile(
        self, operation_id, resolution, reference, *, operator_attestation=False, provider_id=None
    ):
        if operator_attestation is not True or resolution not in {"applied", "not_applied"}:
            raise Invalid(
                "Explicit operator attestation and an applied/not_applied resolution are required"
            )
        if (
            not isinstance(reference, str)
            or not 8 <= len(reference.strip()) <= 500
            or any(ord(c) < 32 for c in reference)
        ):
            raise Invalid("Provide an 8–500 character provider-resolution reference")
        attestation = {
            "operator_attested": True,
            "resolution": resolution,
            "reference": reference.strip(),
            "provider_id": provider_id,
        }
        operation = self.store.get("operations", operation_id)
        if operation["status"] == "resolved":
            if operation["response"].get("attestation") != attestation:
                raise Conflict("Operation has a different recorded resolution")
            return operation
        if operation["status"] != "unknown":
            raise Conflict("Only uncertain operations require reconciliation")
        if self.clock() < operation["reconcile_after"]:
            raise Conflict(
                "The bounded transmission window has not elapsed; wait before reconciling"
            )
        if operation["environment"] != self.provider.config.environment:
            raise Conflict("Select the operation's original provider environment")
        payload = operation["request"]
        verified = None
        if resolution == "applied" and operation["action"] == "file":
            provider_id = flight_id(provider_id)
            summaries = self.provider.summaries(operation["account"])
            if not summaries.body["returnStatus"] or not any(
                row["flightId"] == provider_id for row in summaries.body["flightPlanSummary"]
            ):
                raise Invalid(
                    "The supplied flight identifier was not verified in this pilot account; absence does not prove non-filing"
                )
            verified = self.provider.retrieve(provider_id)
            if not verified.body["returnStatus"]:
                raise Invalid(
                    "The supplied provider flight plan could not be retrieved for matching"
                )
            source = verified.body["icaoFlightPlan"]
            expected = Plan.model_validate(payload["plan"])
            departure = source.get("departure")
            destination = source.get("destination")
            if (
                source.get("aircraftIdentifier") != expected.aircraft_identifier
                or not isinstance(departure, dict)
                or departure.get("locationIdentifier") != expected.departure
                or not isinstance(destination, dict)
                or destination.get("locationIdentifier") != expected.destination
                or timing_plan(expected, verified.body).departure_instant
                != expected.departure_instant
            ):
                raise Invalid(
                    "Provider plan does not match the uncertain filing's aircraft, route endpoints and departure time"
                )
        elif provider_id is not None:
            raise Invalid("A provider identifier is only used to match an applied file action")
        with self.store.transaction() as db:
            current = self.store.row(db, "operations", operation_id)
            if current["status"] != "unknown":
                raise Conflict("Operation changed during reconciliation; reload its receipt")
            filing_id = current["filing_id"]
            moment = now_iso()
            if resolution == "applied":
                if current["action"] == "file":
                    filing_id = identifier("filing")
                    db.execute(
                        "INSERT INTO filings VALUES(?,?,?,?,?,1,?,?,?,?)",
                        (
                            filing_id,
                            current["draft_id"],
                            current["account"],
                            provider_id,
                            current["environment"],
                            encoded(payload["plan"]),
                            encoded(verified.body),
                            encoded(verified.source),
                            moment,
                        ),
                    )
                else:
                    if current["action"] == "amend":
                        db.execute(
                            "UPDATE filings SET submitted=? WHERE id=?",
                            (encoded(payload["plan"]), filing_id),
                        )
                    # Operator attestation is recorded as such. It does not
                    # fabricate a current CLOSED/CANCELLED provider state.
                    db.execute(
                        "UPDATE filings SET snapshot=NULL,source=NULL,revision=revision+1,updated=? WHERE id=?",
                        (moment, filing_id),
                    )
            body = {
                "attestation": attestation,
                "matched_provider_read": verified.body if verified else None,
            }
            source = verified.source if verified else None
            db.execute(
                "UPDATE operations SET status='resolved',filing_id=?,response=?,source=?,updated=? WHERE id=?",
                (filing_id, encoded(body), encoded(source), moment, operation_id),
            )
            self.store.audit(
                db,
                operation_id,
                "operator_reconciled",
                {"attestation": attestation, "source": source, "filing_id": filing_id},
            )
            return self.store.row(db, "operations", operation_id)
