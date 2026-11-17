"""Contract fixtures only: these tests never contact or file with Flight Service."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
from threading import Event
import selectors
import subprocess
import sys
from urllib.parse import parse_qs

import httpx
import pytest
from pydantic import ValidationError

from app.services.filing.provider import (
    AccessDenied,
    Client,
    Configuration,
    Unavailable,
    UnknownOutcome,
)
from app.services.filing.schema import Plan, amendment, form, validate
from app.services.filing.store import Conflict, Invalid, Missing, Store
from app.services.filing.workflow import Workflow, eligibility, timing_plan

NOW = datetime(2026, 11, 18, 12, tzinfo=timezone.utc)
STAMP = "20261118120000000"
FLIGHT_ID = "218354344_717225_11803"
CONFIG = Configuration("lab", "fixture-vendor", "fixture-secret", "")


def plan(**changes):
    values = dict(
        flight_rules="VFR",
        aircraft_identifier="N123AB",
        aircraft_type="C172",
        departure="KPAO",
        destination="KSQL",
        departure_instant=NOW + timedelta(hours=4),
        flight_duration_minutes=60,
        route="DCT",
        aircraft_equipment="S",
        surveillance_equipment="C",
        fuel_minutes=180,
        pilot_data="Fixture Pilot",
        people_on_board="2",
        speed_knots=110,
        altitude_type="A",
        altitude_value=35,
    )
    values.update(changes)
    return Plan(**values)


def response(body, status=200, **kwargs):
    # A fresh byte stream models an unread HTTP response in Client.stream().
    return httpx.Response(status, stream=httpx.ByteStream(json.dumps(body).encode()), **kwargs)


def state(value="PROPOSED", **fields):
    body = {
        "returnStatus": True,
        "currentState": value,
        "versionStamp": STAMP,
        "icaoFlightPlan": {
            "flightRules": "VFR",
            "departureInstant": (NOW + timedelta(hours=4)).timestamp() * 1000,
        },
    }
    body.update(fields)
    return body


class Wire:
    def __init__(self):
        self.calls = []
        self.snapshot = state()
        self.receipt = {"returnStatus": True, "flightIdentifier": FLIGHT_ID, "versionStamp": STAMP}
        self.failure = None

    def __call__(self, request):
        self.calls.append(
            (
                request.method,
                request.url.path,
                parse_qs(request.content.decode(), keep_blank_values=True),
            )
        )
        if request.method == "GET":
            return response(self.snapshot)
        if self.failure:
            raise self.failure
        return response(self.receipt)


@pytest.fixture
def setup(tmp_path):
    wire = Wire()
    store = Store(tmp_path / "private")
    workflow = Workflow(
        store, Client(CONFIG, transport=httpx.MockTransport(wire)), clock=lambda: NOW.timestamp()
    )
    draft = store.draft("pilot@example.test", plan().model_dump(mode="json"))
    return store, workflow, wire, draft


def filed(setup):
    store, workflow, wire, draft = setup
    review = workflow.prepare(draft["id"], 1, "file")
    receipt = workflow.execute(review["confirmation_token"], "first-filing-key-0001", "file", "lab")
    assert receipt["status"] == "accepted"
    return receipt["filing_id"]


def test_incomplete_draft_is_saved_but_cannot_prepare(setup):
    store, workflow, wire, draft = setup
    store.draft(draft["account"], {}, key=draft["id"], revision=1)
    with pytest.raises(Invalid, match="validation"):
        workflow.prepare(draft["id"], 2, "file")
    assert wire.calls == []
    assert not validate(Plan()).format_valid


def test_prepare_is_not_filing_and_identical_execution_is_durable(setup):
    store, workflow, wire, draft = setup
    review = workflow.prepare(draft["id"], 1, "file")
    assert not wire.calls
    assert not store.listing("filings")
    args = (review["confirmation_token"], "idempotency-fixture-001", "file", "lab")
    result = workflow.execute(*args)
    restored = Workflow(Store(store.path.parent), workflow.provider, clock=workflow.clock)
    assert restored.execute(*args) == result
    assert len(wire.calls) == 1
    assert result["response"]["flightIdentifier"] == FLIGHT_ID
    assert store.get("filings", result["filing_id"])["snapshot"] is None
    assert store.history(result["id"])[-1]["event"] == "provider_accepted"
    with pytest.raises(Conflict, match="consumed"):
        restored.execute(args[0], "different-fixture-key", "file", "lab")
    with pytest.raises(Conflict, match="different request"):
        restored.execute(args[0], args[1], "cancel", "lab")
    with pytest.raises(Conflict, match="already"):
        restored.prepare(draft["id"], 1, "file")


@pytest.mark.parametrize("change", ["draft", "clock", "environment", "config"])
def test_changes_invalidate_confirmation(setup, change):
    store, workflow, wire, draft = setup
    review = workflow.prepare(draft["id"], 1, "file")
    environment = "lab"
    if change == "draft":
        store.draft(
            draft["account"],
            plan(route="DCT OSI DCT").model_dump(mode="json"),
            key=draft["id"],
            revision=1,
        )
    elif change == "clock":
        workflow.clock = lambda: NOW.timestamp() + 301
    elif change == "environment":
        environment = "production"
    else:
        workflow.provider.config = Configuration("lab", "fixture-vendor", "rotated-secret", "")
    with pytest.raises(Conflict):
        workflow.execute(
            review["confirmation_token"], "invalidate-fixture-key", "file", environment
        )
    assert not wire.calls


def test_timeout_cannot_be_retried_or_bypassed_with_new_draft(setup):
    store, workflow, wire, draft = setup
    wire.failure = httpx.ReadTimeout("fixture")
    review = workflow.prepare(draft["id"], 1, "file")
    args = (review["confirmation_token"], "uncertain-fixture-key", "file", "lab")
    operation = workflow.execute(*args)
    assert operation["status"] == "unknown"
    assert workflow.execute(*args) == operation
    assert len(wire.calls) == 1
    with pytest.raises(Conflict, match="uncertain"):
        workflow.prepare(draft["id"], 1, "file")
    other = store.draft(draft["account"], plan().model_dump(mode="json"))
    with pytest.raises(Conflict, match="uncertain"):
        workflow.prepare(other["id"], 1, "file")
    with pytest.raises(Conflict):
        store.delete_draft(draft["id"], 1)


def test_process_loss_leaves_durable_unknown(setup):
    store, workflow, wire, draft = setup
    wire.failure = KeyboardInterrupt()
    review = workflow.prepare(draft["id"], 1, "file")
    args = (review["confirmation_token"], "process-loss-fixture", "file", "lab")
    with pytest.raises(KeyboardInterrupt):
        workflow.execute(*args)
    restored = Workflow(Store(store.path.parent), workflow.provider, clock=workflow.clock)
    assert restored.execute(*args)["status"] == "unknown"
    assert len(wire.calls) == 1


def test_concurrent_execution_has_one_outbound_mutation(setup):
    store, workflow, wire, draft = setup
    entered, release = Event(), Event()
    original = workflow.provider.mutate

    def blocked(*args):
        entered.set()
        assert release.wait(5)
        return original(*args)

    workflow.provider.mutate = blocked
    review = workflow.prepare(draft["id"], 1, "file")
    args = (review["confirmation_token"], "concurrency-fixture-key", "file", "lab")
    with ThreadPoolExecutor(max_workers=2) as executor:
        future = executor.submit(workflow.execute, *args)
        assert entered.wait(5)
        assert workflow.execute(*args)["status"] == "unknown"
        release.set()
        assert future.result(timeout=5)["status"] == "accepted"
    assert len(wire.calls) == 1


def test_live_transmission_cannot_be_reconciled_after_nominal_deadline(setup):
    store, workflow, wire, draft = setup
    entered, release = Event(), Event()
    original = workflow.provider.mutate

    def stalled(*args):
        entered.set()
        assert release.wait(5)
        return original(*args)

    workflow.provider.mutate = stalled
    review = workflow.prepare(draft["id"], 1, "file")
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(
            workflow.execute, review["confirmation_token"], "stalled-owner-fixture", "file", "lab"
        )
        try:
            assert entered.wait(5)
            operation = store.listing("operations")[0]
            workflow.clock = lambda: NOW.timestamp() + 3600
            with pytest.raises(Conflict, match="live process"):
                workflow.reconcile(
                    operation["id"],
                    "not_applied",
                    "Fixture resolution reference",
                    operator_attestation=True,
                )
            assert store.get("operations", operation["id"])["status"] == "unknown"
        finally:
            release.set()
        assert future.result(timeout=5)["status"] == "accepted"


def test_os_guard_is_cross_process_and_released_on_owner_loss(setup):
    store, _, _, _ = setup
    operation_id = "operation_" + "a" * 32
    code = """import sys
from app.services.filing.store import Store
with Store(sys.argv[1]).operation_guard(sys.argv[2]):
 print('owned',flush=True)
 sys.stdin.read()
"""
    process = subprocess.Popen(
        [sys.executable, "-c", code, str(store.path.parent), operation_id],
        cwd=Path(__file__).resolve().parents[1] / "backend",
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True,
    )
    try:
        with selectors.DefaultSelector() as ready:
            ready.register(process.stdout, selectors.EVENT_READ)
            assert ready.select(timeout=5), "Child did not acquire operation ownership"
        assert process.stdout.readline().strip() == "owned"
        with pytest.raises(Conflict, match="live process"):
            with store.operation_guard(operation_id):
                pytest.fail("Two processes acquired the same operation guard")
        process.terminate()
        process.wait(timeout=5)
        with store.operation_guard(operation_id):
            pass
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)
        process.stdin.close()
        process.stdout.close()


def test_explicit_rejection_is_not_unknown_and_new_review_can_retry(setup):
    store, workflow, wire, draft = setup
    wire.receipt = {"returnStatus": False, "returnMessage": ["Fixture plan rejected"]}
    review = workflow.prepare(draft["id"], 1, "file")
    assert (
        workflow.execute(review["confirmation_token"], "rejection-fixture-key", "file", "lab")[
            "status"
        ]
        == "rejected"
    )
    assert not store.listing("filings")
    assert workflow.prepare(draft["id"], 1, "file")["provider_mutation_sent"] is False


def test_amendment_only_sends_explicit_changes_with_current_stamp(setup):
    store, workflow, wire, draft = setup
    filing_id = filed(setup)
    # Another client changed its route. Our desired fuel-only amendment must
    # not retransmit the old local route over that provider change.
    wire.snapshot["icaoFlightPlan"]["route"] = "PROVIDER CHANGED ROUTE"
    store.draft(
        draft["account"],
        plan(fuel_minutes=240).model_dump(mode="json"),
        key=draft["id"],
        revision=1,
    )
    review = workflow.prepare(draft["id"], 2, "amend", filing_id=filing_id)
    assert set(review["provider_fields"]) == {
        "type",
        "versionRequested",
        "includeCodedMessages",
        "fuelOnBoard",
        "versionStamp",
    }
    result = workflow.execute(
        review["confirmation_token"], "fuel-amend-fixture-key", "amend", "lab"
    )
    assert result["status"] == "accepted"
    assert wire.calls[-1][2]["versionStamp"] == [STAMP]
    assert "route" not in wire.calls[-1][2]
    assert store.get("filings", filing_id)["snapshot"] is None


def test_provider_refresh_invalidates_prepared_action(setup):
    store, workflow, wire, draft = setup
    filing_id = filed(setup)
    review = workflow.prepare(draft["id"], 1, "cancel", filing_id=filing_id)
    workflow.refresh(filing_id)
    with pytest.raises(Conflict, match="state changed"):
        workflow.execute(review["confirmation_token"], "stale-refresh-fixture", "cancel", "lab")
    assert sum(method == "POST" for method, _, _ in wire.calls) == 1


def test_vfr_activate_close_cancel_lifecycle(setup):
    store, workflow, wire, draft = setup
    filing_id = filed(setup)
    review = workflow.prepare(
        draft["id"],
        1,
        "activate",
        filing_id=filing_id,
        inputs={"actual_departure": NOW.isoformat()},
    )
    assert (
        workflow.execute(review["confirmation_token"], "activate-fixture-key", "activate", "lab")[
            "status"
        ]
        == "accepted"
    )
    wire.snapshot = state("OVERDUE")
    with pytest.raises(Invalid, match="destination"):
        workflow.prepare(draft["id"], 1, "close", filing_id=filing_id)
    with pytest.raises(Invalid, match="closure"):
        workflow.prepare(draft["id"], 1, "cancel", filing_id=filing_id)
    review = workflow.prepare(
        draft["id"],
        1,
        "close",
        filing_id=filing_id,
        inputs={"close_destination_info": "Fixture arrival KSQL"},
    )
    wire.receipt = {"returnStatus": True}
    assert (
        workflow.execute(review["confirmation_token"], "closure-fixture-key-1", "close", "lab")[
            "status"
        ]
        == "accepted"
    )


@pytest.mark.parametrize(
    "center,minutes",
    [
        ("PAZA", 43),
        ("KZBW", 55),
        ("KZID", 61),
        ("KZNY", 61),
        ("PHZH", 1350),
        ("PGZU", 1350),
        ("KZSE", 46),
    ],
)
def test_source_artcc_cutoffs(center, minutes):
    aircraft = plan(flight_rules="IFR", departure_instant=NOW + timedelta(minutes=minutes))
    snapshot = state(artccInfo={"lastTransmittedMessage": {"artccAddress": center + "ZQZX"}})
    with pytest.raises(Invalid, match="cutoff"):
        eligibility("cancel", aircraft, snapshot, {}, NOW)
    assert not eligibility("cancel", aircraft, snapshot, {}, NOW - timedelta(seconds=1))


def test_current_provider_rules_and_time_own_eligibility():
    baseline = plan()
    current = timing_plan(
        baseline,
        state(
            icaoFlightPlan={
                "flightRules": "IFR",
                "departureInstant": (NOW + timedelta(minutes=40)).timestamp() * 1000,
            }
        ),
    )
    with pytest.raises(Invalid, match="ATC"):
        eligibility("activate", current, state(), {}, NOW)
    warnings = eligibility("cancel", current, state(), {}, NOW)
    assert "unknown" in warnings[0]
    for snapshot in [
        state(icaoFlightPlan={}),
        state(icaoFlightPlan={"flightRules": "VFR", "departureInstant": "invalid"}),
    ]:
        with pytest.raises(Invalid, match="unknown"):
            timing_plan(baseline, snapshot)


def test_private_store_cas_delete_backup_and_unsupported_schema(setup, tmp_path):
    store, workflow, wire, draft = setup
    assert os.stat(store.path).st_mode & 0o777 == 0o600
    assert os.stat(store.path.parent).st_mode & 0o777 == 0o700
    with pytest.raises(Conflict):
        store.draft(draft["account"], {}, key=draft["id"], revision=0)
    with pytest.raises(Conflict):
        store.draft("other@example.test", {}, key=draft["id"], revision=1)
    backup = tmp_path / "snapshot.sqlite3"
    store.backup(backup)
    with pytest.raises(FileExistsError):
        store.backup(backup)
    assert os.stat(backup).st_mode & 0o777 == 0o600
    store.delete_draft(draft["id"], 1)
    with pytest.raises(Missing):
        store.get("drafts", draft["id"])
    assert not store.listing("drafts")
    assert store.history(draft["id"])[-1]["event"] == "draft_deleted"
    with store.transaction() as db:
        db.execute("PRAGMA user_version=2")
    with pytest.raises(Invalid, match="version"):
        Store(store.path.parent)


@pytest.mark.parametrize(
    "field,value",
    [
        ("radios", "ABCDE"),
        ("survival", "abc"),
        ("jackets", "123"),
        ("color_of_dinghies", "red"),
        ("capacity_of_dinghies", 1000),
        ("number_of_dinghies", True),
        ("departure_lat_long", "9060N18100W"),
    ],
)
def test_icao_schema_bounds(field, value):
    with pytest.raises(ValidationError):
        plan(**{field: value})


def test_icao_duration_units_choices_and_optional_clear():
    aircraft = plan(
        altitude_type="M",
        altitude_value=250,
        speed_knots=None,
        speed_mach=0.82,
        fuel_minutes=185,
        alternate1="KSJC",
    )
    wire = form(aircraft)
    assert wire["altitudeTypeM"] == "250"
    assert wire["speedMach"] == "0.82"
    assert wire["fuelOnBoard"] == "PT3H5M"
    assert "speedKnots" not in wire
    changes = amendment(
        aircraft,
        aircraft.model_copy(update={"alternate1": None, "speed_knots": 110, "speed_mach": None}),
    )
    assert changes["altDestination1"] == ""
    assert changes["speedKnots"] == "110"
    assert "speedMach" not in changes
    assert validate(aircraft).format_valid
    assert not validate(
        plan(flight_rules="IFR", altitude_type="VFR", altitude_value=None)
    ).format_valid
    assert validate(
        plan(flight_duration_minutes=0, estimated_arrival=NOW + timedelta(days=10))
    ).format_valid


def test_persons_require_explicit_value_or_explicit_tbn():
    assert not validate(plan(people_on_board=None)).format_valid
    assert not validate(plan(people_on_board="  ")).format_valid
    assert validate(plan(people_on_board=None, people_unknown=True)).format_valid
    assert not validate(plan(people_on_board="2", people_unknown=True)).format_valid
    with pytest.raises(ValidationError):
        plan(speed_knots=None, speed_mach=True)


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"returnStatus": "true"},
        {"returnStatus": True},
        {"returnStatus": True, "flightIdentifier": "bad/id", "versionStamp": STAMP},
        {"returnStatus": True, "flightIdentifier": FLIGHT_ID, "versionStamp": "bad"},
    ],
)
def test_malformed_receipt_is_unknown(body):
    client = Client(CONFIG, transport=httpx.MockTransport(lambda request: response(body)))
    with pytest.raises(UnknownOutcome):
        client.mutate("file", {})


@pytest.mark.parametrize(
    "status,error",
    [
        (302, UnknownOutcome),
        (429, UnknownOutcome),
        (500, UnknownOutcome),
        (401, AccessDenied),
        (403, AccessDenied),
    ],
)
def test_provider_http_status_never_retries(status, error):
    requests = []

    def handler(request):
        requests.append(request)
        return response({}, status, headers={"Location": "https://foreign.example/"})

    client = Client(CONFIG, transport=httpx.MockTransport(handler))
    with pytest.raises(error):
        client.mutate("file", {})
    assert len(requests) == 1


def test_credentials_redacted_and_config_readiness_is_not_verification():
    body = {
        "returnStatus": False,
        "returnMessage": ["fixture-secret fixture-vendor"],
        "password": "fixture-secret",
    }
    client = Client(CONFIG, transport=httpx.MockTransport(lambda request: response(body)))
    reply = client.mutate("file", {})
    assert "fixture-secret" not in json.dumps(reply.body)
    assert "fixture-vendor" not in json.dumps(reply.body)
    assert reply.source["redacted"]
    assert len(reply.source["raw_response_sha256"]) == 64
    assert "fixture-secret" not in repr(CONFIG)
    assert not CONFIG.capabilities()["provider_access_verified"]
    with pytest.raises(Unavailable, match="Production"):
        Configuration("production", "fixture-vendor", "fixture-secret", "").require(mutation=True)
    with pytest.raises(Unavailable):
        Configuration(None, "", "", "").require()


def test_empty_summaries_require_success_and_remain_explicit():
    client = Client(
        CONFIG, transport=httpx.MockTransport(lambda request: response({"returnStatus": True}))
    )
    assert client.summaries("pilot+fixture@example.test").body["flightPlanSummary"] == []
    client = Client(
        CONFIG, transport=httpx.MockTransport(lambda request: response({"returnStatus": False}))
    )
    assert not client.summaries("pilot@example.test").body["returnStatus"]


def uncertain(setup):
    store, workflow, wire, draft = setup
    wire.failure = httpx.ReadTimeout("fixture")
    review = workflow.prepare(draft["id"], 1, "file")
    return workflow.execute(review["confirmation_token"], "reconcile-fixture-key", "file", "lab")


def test_reconciliation_waits_and_records_attestation_without_fabricated_receipt(setup):
    store, workflow, wire, draft = setup
    operation = uncertain(setup)
    args = (operation["id"], "not_applied", "Fixture provider resolution reference")
    with pytest.raises(Invalid, match="attestation"):
        workflow.reconcile(*args)
    with pytest.raises(Conflict, match="window"):
        workflow.reconcile(*args, operator_attestation=True)
    workflow.clock = lambda: NOW.timestamp() + 121
    resolved = workflow.reconcile(*args, operator_attestation=True)
    assert resolved["status"] == "resolved"
    assert resolved["source"] is None
    assert resolved["response"]["attestation"]["operator_attested"]
    assert "returnStatus" not in resolved["response"]
    assert workflow.reconcile(*args, operator_attestation=True) == resolved
    with pytest.raises(Conflict):
        workflow.reconcile(
            operation["id"],
            "not_applied",
            "Different provider reference",
            operator_attestation=True,
        )
    assert workflow.prepare(draft["id"], 1, "file")["provider_mutation_sent"] is False
    assert store.history(operation["id"])[-1]["event"] == "operator_reconciled"


def test_applied_filing_requires_account_and_exact_source_match(setup):
    store, workflow, wire, draft = setup
    operation = uncertain(setup)
    workflow.clock = lambda: NOW.timestamp() + 121
    original = plan()
    snapshot = state(
        icaoFlightPlan={
            "flightRules": "VFR",
            "aircraftIdentifier": original.aircraft_identifier,
            "departure": {"locationIdentifier": "KPAO"},
            "destination": {"locationIdentifier": "KSQL"},
            "departureInstant": original.departure_instant.timestamp() * 1000,
        }
    )
    rows = []

    def handler(request):
        return response(
            {"returnStatus": True, "flightPlanSummary": rows}
            if request.url.path.endswith("retrieveFlightPlanSummaries")
            else snapshot
        )

    workflow.provider.transport = httpx.MockTransport(handler)
    args = (operation["id"], "applied", "Fixture confirmed with provider")
    with pytest.raises(Invalid, match="not verified"):
        workflow.reconcile(*args, operator_attestation=True, provider_id=FLIGHT_ID)
    assert store.get("operations", operation["id"])["status"] == "unknown"
    rows.append({"flightId": FLIGHT_ID, "versionStamp": STAMP})
    snapshot["icaoFlightPlan"]["aircraftIdentifier"] = "OTHER"
    with pytest.raises(Invalid, match="does not match"):
        workflow.reconcile(*args, operator_attestation=True, provider_id=FLIGHT_ID)
    snapshot["icaoFlightPlan"]["aircraftIdentifier"] = original.aircraft_identifier
    result = workflow.reconcile(*args, operator_attestation=True, provider_id=FLIGHT_ID)
    assert result["status"] == "resolved"
    assert result["source"]["environment"] == "lab"
    filing = store.get("filings", result["filing_id"])
    assert filing["snapshot"]["currentState"] == "PROPOSED"
    with pytest.raises(Conflict, match="already"):
        workflow.prepare(draft["id"], 1, "file")


@pytest.mark.parametrize(
    "kind", ["oversize", "compressed", "invalid_json", "coded_message", "nonfinite"]
)
def test_bounded_provider_responses_are_uncertain_for_mutations(kind):
    def handler(request):
        if kind == "oversize":
            return httpx.Response(200, stream=httpx.ByteStream(b"x" * 1_048_577))
        if kind == "compressed":
            return response({"returnStatus": True}, headers={"Content-Encoding": "gzip"})
        if kind == "invalid_json":
            return httpx.Response(200, stream=httpx.ByteStream(b"not-json"))
        if kind == "nonfinite":
            return httpx.Response(
                200, stream=httpx.ByteStream(b'{"returnStatus":true,"value":NaN}')
            )
        return response(
            {"returnStatus": True, "returnCodedMessage": [{"code": 4, "message": "invalid"}]}
        )

    client = Client(CONFIG, transport=httpx.MockTransport(handler))
    with pytest.raises(UnknownOutcome):
        client.mutate("file", {})
