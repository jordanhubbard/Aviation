"""Arithmetic, original-source review, scope and drift boundaries (synthetic source)."""

import json
import math
from itertools import product
from pathlib import Path
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.services.aircraft_library.store import Store
from app.services.aircraft_performance import Registry
from app.services.performance_tables import interpolate
from app.schemas.aircraft_performance import DatasetDraft, Calculation, Review, Retirement
from app.routers.aircraft_performance import install
from io import BytesIO
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject


def manual(*pages):
    writer = PdfWriter()
    for text in pages:
        page = writer.add_blank_page(width=612, height=792)
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
        page[NameObject("/Resources")] = DictionaryObject(
            {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
        )
        content = DecodedStreamObject()
        escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        content.set_data(("BT /F1 12 Tf 40 700 Td (" + escaped + ") Tj ET").encode("ascii"))
        page[NameObject("/Contents")] = content
    stream = BytesIO()
    writer.write(stream)
    return stream.getvalue()


TEXT = (
    "SYNTHETIC PERFORMANCE TEST FIGURE. Pressure altitude feet 0 1000. Temperature C 0 20. "
    "Takeoff ground roll feet: 1000 1200 1300 1500. Weight 2400 lb, flaps 10 degrees. "
    "For headwind decrease distances 10 percent for each 9 knots; for tailwind increase 10 percent per 2 knots. "
    "For dry grass increase ground roll 15 percent. Hard surfaced level dry runway. No slope correction supplied. Linear interpolation is permitted within the printed altitude/temperature grid. Apply combined headwind and surface corrections sequentially in that order."
)
CONFIGURATION = "Flaps 10 degrees, full throttle, specified mixture; source test conditions"


@pytest.fixture
def source(tmp_path):
    library = Store(tmp_path / "library")
    document = library.ingest(
        manual(TEXT),
        {
            "icao": "C172",
            "kind": "POH",
            "variant": "C172S",
            "revision": "TEST-1",
            "title": "Synthetic test manual",
        },
    )
    return library, document


def draft(document):
    points = [
        {
            "coordinates": {"pressure_altitude_ft": pa, "temperature_c": t},
            "value": value,
            "citations": [{"page": 1, "quote": TEXT}],
        }
        for pa, t, value in [(0, 0, 1000), (0, 20, 1200), (1000, 0, 1300), (1000, 20, 1500)]
    ]
    return DatasetDraft.model_validate(
        {
            "title": "Source test dataset",
            "source_document_id": document["id"],
            "source_sha256": document["sha256"],
            "icao": "C172",
            "variant": "C172S",
            "source_revision": "TEST-1",
            "configuration": CONFIGURATION,
            "tables": [
                {
                    "id": "takeoff",
                    "metric": "takeoff_ground_roll_ft",
                    "source_table": "Test figure 1",
                    "axes": ["pressure_altitude_ft", "temperature_c"],
                    "interpolation_axes": ["pressure_altitude_ft", "temperature_c"],
                    "interpolation_citations": [{"page": 1, "quote": TEXT}],
                    "fixed_conditions": {
                        "weight_lb": 2400,
                        "headwind_kt": 0,
                        "runway_slope_pct": 0,
                        "runway_surface": "dry paved",
                    },
                    "points": points,
                    "correction_order": ["Headwind", "Tailwind", "Dry grass ground roll"],
                    "combination_citations": [{"page": 1, "quote": TEXT}],
                    "corrections": [
                        {
                            "kind": "linear_percent",
                            "percent_of": "current_result",
                            "name": "Headwind",
                            "variable": "headwind_kt",
                            "reference": 0,
                            "minimum": 0,
                            "maximum": 18,
                            "percent": 10,
                            "per_units": 9,
                            "direction": "decrease",
                            "citations": [{"page": 1, "quote": TEXT}],
                        },
                        {
                            "kind": "linear_percent",
                            "percent_of": "current_result",
                            "name": "Tailwind",
                            "variable": "headwind_kt",
                            "reference": 0,
                            "minimum": -10,
                            "maximum": 0,
                            "percent": 10,
                            "per_units": 2,
                            "direction": "increase",
                            "citations": [{"page": 1, "quote": TEXT}],
                        },
                        {
                            "kind": "surface_percent",
                            "percent_of": "current_result",
                            "name": "Dry grass ground roll",
                            "variable": "runway_surface",
                            "reference": "dry paved",
                            "match_value": "dry grass",
                            "percent": 15,
                            "direction": "increase",
                            "citations": [{"page": 1, "quote": TEXT}],
                        },
                    ],
                }
            ],
        }
    )


def request(**conditions):
    return Calculation(
        icao="C172",
        variant="C172S",
        configuration=CONFIGURATION,
        table_id="takeoff",
        conditions={
            "weight_lb": 2400,
            "pressure_altitude_ft": 500,
            "temperature_c": 10,
            "headwind_kt": 0,
            "runway_slope_pct": 0,
            "runway_surface": "dry paved",
            **conditions,
        },
    )


def reviewed(source):
    library, document = source
    registry = Registry(library)
    created = registry.create(draft(document))
    registry.review(
        created["id"],
        Review(
            expected_content_sha256=created["content_sha256"],
            reviewer="Synthetic-test reviewer",
            attest_source_and_applicability=True,
        ),
    )
    return registry, created


def test_requires_deliberate_review_and_preserves_original_provenance(source):
    library, document = source
    registry = Registry(library)
    record = registry.create(draft(document))
    assert record["state"] == "draft" and not record["usable"]
    with pytest.raises(ValueError, match="Only reviewed"):
        registry.calculate(record["id"], request())
    with pytest.raises(ValueError):
        Review(
            expected_content_sha256=record["content_sha256"],
            reviewer="operator",
            attest_source_and_applicability=False,
        )
    with pytest.raises(ValueError, match="changed before review"):
        registry.review(
            record["id"],
            Review(
                expected_content_sha256="0" * 64,
                reviewer="operator",
                attest_source_and_applicability=True,
            ),
        )
    accepted = registry.review(
        record["id"],
        Review(
            expected_content_sha256=record["content_sha256"],
            reviewer="operator",
            attest_source_and_applicability=True,
        ),
    )
    assert accepted["usable"] and accepted["state"] == "reviewed"
    output = registry.calculate(record["id"], request())
    assert (
        output["value"] == 1250
        and output["units"] == "ft"
        and output["approved_for_flight"] is False
    )
    assert sum(c["weight"] for c in output["contributions"]) == 1
    assert output["source"]["sha256"] == document["sha256"]
    assert output["source"]["original_url"].endswith(document["id"] + "/original")
    assert all(c["citations"][0]["page"] == 1 for c in output["contributions"])
    assert output["reviewer"] == "operator" and output["reviewed_at"] == accepted["reviewed_at"]
    assert registry.create(draft(document))["reviewed_at"] == accepted["reviewed_at"]
    assert Registry(Store(library.root)).calculate(record["id"], request())["value"] == 1250
    assert registry.path.stat().st_mode & 0o777 == 0o600


@pytest.mark.parametrize(
    "conditions,expected",
    [
        ({"headwind_kt": 9}, 1125),
        ({"headwind_kt": -4}, 1500),
        ({"runway_surface": "dry grass"}, 1437.5),
        ({"headwind_kt": 9, "runway_surface": "dry grass"}, 1293.75),
    ],
)
def test_only_cited_corrections_apply_with_visible_steps(source, conditions, expected):
    registry, record = reviewed(source)
    result = registry.calculate(record["id"], request(**conditions))
    assert result["uncorrected_value"] == 1250
    assert result["value"] == pytest.approx(expected)
    assert len(result["corrections"]) == len(conditions)
    assert all(step["rule"]["citations"][0]["quote"] == TEXT for step in result["corrections"])


@pytest.mark.parametrize(
    "changes",
    [
        {"weight_lb": 2500},
        {"runway_slope_pct": 1},
        {"runway_surface": "wet grass"},
        {"headwind_kt": 19},
        {"headwind_kt": -11},
    ],
)
def test_unknown_conditions_have_no_guessed_correction(source, changes):
    registry, record = reviewed(source)
    with pytest.raises(ValueError, match="no unique cited correction"):
        registry.calculate(record["id"], request(**changes))


def test_bounds_missing_conditions_and_nonfinite_values_fail(source):
    registry, record = reviewed(source)
    for key, value in [("temperature_c", 21), ("pressure_altitude_ft", -1)]:
        with pytest.raises(ValueError, match="extrapolation is prohibited"):
            registry.calculate(record["id"], request(**{key: value}))
    values = request().model_dump()
    values["conditions"].pop("weight_lb")
    with pytest.raises(ValueError, match="exactly every"):
        registry.calculate(record["id"], Calculation.model_validate(values))
    for invalid in [float("nan"), float("inf"), True]:
        with pytest.raises(ValueError):
            request(weight_lb=invalid)
    with pytest.raises(ValueError, match="weight_lb requires a finite number"):
        request(weight_lb="2400")


def test_type_tail_variant_revision_and_configuration_are_not_inferred(source):
    library, document = source
    metadata = document["metadata"] | {"tails": ["N123AB"], "scope": "aircraft"}
    library.update_metadata(document["id"], metadata)
    registry, record = reviewed((library, library.get(document["id"])))
    assert (
        registry.list("C172")["datasets"] == []
        and registry.list("C172", registration="N999ZZ")["datasets"] == []
    )
    assert len(registry.list("C172", registration="N123AB")["datasets"]) == 1
    for fields in [
        {},
        {"registration": "N999ZZ"},
        {"registration": "N123AB", "icao": "C182"},
        {"registration": "N123AB", "variant": "C172R"},
        {"registration": "N123AB", "configuration": "different flaps"},
    ]:
        with pytest.raises(ValueError, match="does not match"):
            registry.calculate(record["id"], request().model_copy(update=fields))
    assert (
        registry.calculate(record["id"], request().model_copy(update={"registration": "N123AB"}))[
            "value"
        ]
        == 1250
    )


def test_source_and_metadata_drift_invalidate_review_without_destroying_records(source):
    library, document = source
    registry, record = reviewed(source)
    path = library.original(document["id"])
    original = path.read_bytes()
    path.write_bytes(original + b"tamper")
    assert registry.get(record["id"])["state"] == "stale"
    with pytest.raises(ValueError, match="integrity"):
        registry.calculate(record["id"], request())
    path.write_bytes(original)
    library.update_metadata(document["id"], document["metadata"] | {"revision": "TEST-2"})
    assert registry.get(record["id"])["state"] == "stale"
    with pytest.raises(ValueError, match="metadata/applicability changed"):
        registry.calculate(record["id"], request())
    assert registry.get(record["id"])["reviewed_at"]


def test_changed_cited_text_and_database_corruption_cannot_establish_source_authority(source):
    library, document = source
    registry, record = reviewed(source)
    with library.connection() as connection:
        connection.execute(
            "UPDATE pages SET text='Changed extracted text' WHERE document_id=?", (document["id"],)
        )
    assert registry.get(record["id"])["state"] == "stale"
    with pytest.raises(ValueError, match="page evidence"):
        registry.calculate(record["id"], request())
    with registry.connection() as connection:
        payload = record["content"]
        payload["tables"][0]["points"][0]["value"] = 999
        connection.execute(
            "UPDATE datasets SET content=? WHERE id=?", (json.dumps(payload), record["id"])
        )
    with pytest.raises(ValueError, match="dataset integrity"):
        registry.get(record["id"])


def test_fabricated_quotes_missing_numbers_bad_grids_and_automatic_review_are_rejected(source):
    library, document = source
    registry = Registry(library)
    for change in ["quote", "number", "missing_point", "duplicate_point", "review_flag"]:
        content = draft(document).model_dump()
        points = content["tables"][0]["points"]
        if change == "quote":
            points[0]["citations"][0]["quote"] = "Invented quotation not present in source"
        if change == "number":
            points[0]["value"] = 123456
        if change == "missing_point":
            points.pop()
        if change == "duplicate_point":
            points[-1] = points[0]
        if change == "review_flag":
            content["reviewed"] = True
        with pytest.raises(ValueError):
            registry.create(DatasetDraft.model_validate(content))


def test_retirement_blocks_use_and_review_and_is_persistent(source):
    registry, record = reviewed(source)
    retired = registry.retire(
        record["id"],
        Retirement(
            expected_content_sha256=record["content_sha256"], reason="Source review withdrawn"
        ),
    )
    assert retired["state"] == "retired" and not retired["usable"]
    with pytest.raises(ValueError, match="Only reviewed"):
        registry.calculate(record["id"], request())
    with pytest.raises(ValueError, match="Retired datasets"):
        registry.review(
            record["id"],
            Review(
                expected_content_sha256=record["content_sha256"],
                reviewer="operator",
                attest_source_and_applicability=True,
            ),
        )


def test_multidimensional_kernel_and_legacy_bilinear_boundaries():
    points = [
        {"coordinates": dict(zip(["x", "y", "z"], coordinates)), "value": value}
        for coordinates, value in zip(
            product([0, 1], repeat=3), [100, 104, 103, 107, 102, 106, 105, 109]
        )
    ]
    value, contributions = interpolate(points, ["x", "y", "z"], {"x": 0.5, "y": 0.25, "z": 0.75})
    assert value == 104.75 and math.isclose(sum(p["weight"] for p in contributions), 1)
    assert interpolate(points, ["x", "y", "z"], {"x": 1, "y": 1, "z": 1})[0] == 109
    with pytest.raises(ValueError, match="extrapolation"):
        interpolate(points, ["x", "y", "z"], {"x": 0, "y": 0, "z": 1.01})


def test_private_http_review_calculation_and_openapi(source, monkeypatch):
    library, document = source
    token = "s" * 40
    monkeypatch.setenv("AIRCRAFT_LIBRARY_TOKEN", token)
    app = FastAPI()
    install(app, library=library)
    client = TestClient(app)
    base = "/api/aircraft-performance"
    headers = {"Authorization": "Bearer " + token}
    assert client.post(base + "/datasets", content=b"invalid").status_code == 401
    for weight in [0, -2400, "2400 lb"]:
        malformed = draft(document).model_dump(mode="json")
        malformed["tables"][0]["fixed_conditions"]["weight_lb"] = weight
        rejected = client.post(base + "/datasets", headers=headers, json=malformed)
        assert rejected.status_code == 422
        assert rejected.headers["cache-control"] == "private, no-store"
    assert client.get(base + "/datasets?icao=C172", headers=headers).json()["total"] == 0
    response = client.post(
        base + "/datasets", headers=headers, json=draft(document).model_dump(mode="json")
    )
    assert response.status_code == 201, response.text
    assert response.headers["cache-control"] == "private, no-store"
    record = response.json()
    path = base + "/datasets/" + record["id"]
    assert (
        client.post(
            path + "/calculate", headers=headers, json=request().model_dump(mode="json")
        ).status_code
        == 422
    )
    review = client.post(
        path + "/review",
        headers=headers,
        json={
            "expected_content_sha256": record["content_sha256"],
            "reviewer": "Synthetic-test operator",
            "attest_source_and_applicability": True,
        },
    )
    assert review.status_code == 200, review.text
    calculated = client.post(
        path + "/calculate", headers=headers, json=request().model_dump(mode="json")
    )
    assert calculated.status_code == 200, calculated.text
    assert (
        calculated.json()["value"] == 1250
        and calculated.headers["cache-control"] == "private, no-store"
    )
    listed = client.get(base + "/datasets?icao=C172", headers=headers)
    assert listed.status_code == 200 and listed.json()["total"] == 1
    schema = client.get("/openapi.json").json()
    assert (
        schema["paths"][path.replace(record["id"], "{dataset_id}") + "/calculate"]["post"][
            "operationId"
        ]
        == "aircraft_performance_calculate"
    )
    assert (
        client.post(base + "/datasets", headers=headers, content=b" " * 1_000_001).status_code
        == 413
    )


def test_interpolation_and_combined_corrections_require_separate_explicit_source_review(source):
    library, document = source
    body = draft(document).model_dump()
    table = body["tables"][0]
    table.update(
        interpolation_axes=[],
        interpolation_citations=[],
        correction_order=[],
        combination_citations=[],
    )
    registry = Registry(library)
    record = registry.create(DatasetDraft.model_validate(body))
    registry.review(
        record["id"],
        Review(
            expected_content_sha256=record["content_sha256"],
            reviewer="operator",
            attest_source_and_applicability=True,
        ),
    )
    with pytest.raises(ValueError, match="not reviewed for interpolation"):
        registry.calculate(record["id"], request())
    assert (
        registry.calculate(record["id"], request(pressure_altitude_ft=0, temperature_c=0))["value"]
        == 1000
    )
    with pytest.raises(ValueError, match="Combined corrections require"):
        registry.calculate(
            record["id"],
            request(
                pressure_altitude_ft=0, temperature_c=0, headwind_kt=9, runway_surface="dry grass"
            ),
        )


def test_uncited_correction_and_overlapping_coverage_fail_before_review(source):
    library, document = source
    body = draft(document).model_dump()
    body["tables"][0]["corrections"][0]["per_units"] = 12345
    with pytest.raises(ValueError, match="percentage/divisor"):
        Registry(library).create(DatasetDraft.model_validate(body))
    body = draft(document).model_dump()
    table = body["tables"][0]
    table.update(correction_order=[], combination_citations=[])
    table["corrections"].append(
        table["corrections"][0] | {"name": "Overlapping headwind", "maximum": 9}
    )
    with pytest.raises(ValueError, match="must not overlap"):
        DatasetDraft.model_validate(body)


def test_absolute_and_isa_temperatures_cannot_be_confused_and_reserves_are_explicit(source):
    _, document = source
    body = draft(document).model_dump()
    table = body["tables"][0]
    table["fixed_conditions"]["isa_deviation_c"] = 0
    with pytest.raises(ValueError, match="exactly one"):
        DatasetDraft.model_validate(body)
    body = draft(document).model_dump()
    table = body["tables"][0]
    table.update(metric="range_nm", corrections=[], correction_order=[], combination_citations=[])
    with pytest.raises(ValueError, match="fuel/reserve"):
        DatasetDraft.model_validate(body)
    table["fixed_conditions"].update(fuel_on_board_gal=53, reserve_minutes=45)
    assert DatasetDraft.model_validate(body).tables[0].fixed_conditions["reserve_minutes"] == 45


def test_cumulative_climb_can_start_at_zero_and_does_not_require_a_model(source, monkeypatch):
    library, _ = source
    text = "Synthetic climb-fuel table, US gallons 0 2 4. Pressure altitude feet 0 1000; temperature C 0 20; weight 2400 lb."
    document = library.ingest(
        manual(text), {"icao": "C172", "kind": "POH", "variant": "C172S", "revision": "TEST-1"}
    )
    body = draft(document).model_dump()
    table = body["tables"][0]
    table.update(
        metric="climb_fuel_gal",
        fixed_conditions={"weight_lb": 2400},
        corrections=[],
        correction_order=[],
        combination_citations=[],
        interpolation_axes=[],
        interpolation_citations=[],
    )
    for point, value in zip(table["points"], [0, 0, 2, 4]):
        point.update(value=value, citations=[{"page": 1, "quote": text}])
    registry = Registry(library)
    record = registry.create(DatasetDraft.model_validate(body))
    registry.review(
        record["id"],
        Review(
            expected_content_sha256=record["content_sha256"],
            reviewer="operator",
            attest_source_and_applicability=True,
        ),
    )
    from app.services.aircraft_library.models import Models

    def forbidden(*args, **kwargs):
        raise AssertionError("Performance calculations must not contact a model")

    monkeypatch.setattr(Models, "complete", forbidden)
    monkeypatch.setattr(Models, "embed", forbidden)
    output = registry.calculate(
        record["id"],
        Calculation(
            icao="C172",
            variant="C172S",
            configuration=CONFIGURATION,
            table_id="takeoff",
            conditions={"weight_lb": 2400, "pressure_altitude_ft": 0, "temperature_c": 0},
        ),
    )
    assert output["value"] == 0 and output["units"] == "US gal"


def test_catalog_is_paginated_and_omits_full_source_quotes_and_point_arrays(source):
    library, document = source
    registry = Registry(library)
    for number in range(3):
        body = draft(document).model_dump()
        body["title"] += str(number)
        registry.create(DatasetDraft.model_validate(body))
    result = registry.list("c172", offset=1, limit=1)
    assert result["total"] == 3 and len(result["datasets"]) == 1
    assert "content" not in result["datasets"][0] and "quote" not in json.dumps(result)


def test_future_database_schema_and_index_corruption_are_rejected(source):
    registry, record = reviewed(source)
    with registry.connection() as connection:
        connection.execute("UPDATE datasets SET icao='C182' WHERE id=?", (record["id"],))
    with pytest.raises(ValueError, match="index integrity"):
        registry.get(record["id"])
    with registry.connection() as connection:
        connection.execute("PRAGMA user_version=99")
    with pytest.raises(ValueError, match="Unsupported aircraft-performance database schema"):
        Registry(source[0])


def test_private_errors_are_not_cacheable(source, monkeypatch):
    library, _ = source
    monkeypatch.setenv("AIRCRAFT_LIBRARY_TOKEN", "s" * 40)
    app = FastAPI()
    install(app, library=library)
    client = TestClient(app)
    response = client.get("/api/aircraft-performance/datasets?icao=C172")
    assert response.status_code == 401 and response.headers["cache-control"] == "private, no-store"
    response = client.post(
        "/api/aircraft-performance/datasets",
        headers={"Authorization": "Bearer " + "s" * 40},
        json={},
    )
    assert response.status_code == 422 and response.headers["cache-control"] == "private, no-store"


@pytest.mark.parametrize(
    "key,value",
    [
        ("weight_lb", "2400"),
        ("weight_lb", "2400 kg"),
        ("weight_lb", 0),
        ("weight_lb", -1),
        ("headwind_kt", "12 kt"),
        ("power_pct", -1),
        ("rpm", -1),
        ("fuel_on_board_gal", -1),
        ("reserve_minutes", -1),
        ("flaps_pct", -1),
        ("flaps_pct", 101),
        ("flaps_deg", -1),
        ("temperature_c", -273.16),
    ],
)
def test_physical_conditions_rejected_in_drafts_and_requests(source, key, value):
    _, document = source
    body = draft(document).model_dump()
    table = body["tables"][0]
    if key in table["axes"]:
        table["points"][0]["coordinates"][key] = value
    else:
        table["fixed_conditions"][key] = value
    with pytest.raises(ValueError):
        DatasetDraft.model_validate(body)
    with pytest.raises(ValueError):
        request(**{key: value})


def test_weight_axis_must_be_positive(source):
    _, document = source
    body = draft(document).model_dump()
    table = body["tables"][0]
    table["axes"].append("weight_lb")
    table["fixed_conditions"].pop("weight_lb")
    for point in table["points"]:
        point["coordinates"]["weight_lb"] = -2400
    with pytest.raises(ValueError, match="weight_lb must be positive"):
        DatasetDraft.model_validate(body)


def test_signed_and_categorical_conditions_remain_valid(source):
    conditions = dict(
        headwind_kt=-12,
        runway_slope_pct=-2,
        pressure_altitude_ft=-200,
        isa_deviation_c=-30,
        power_pct=110,
        rpm=0,
        fuel_on_board_gal=0,
        reserve_minutes=0,
        flaps_pct=100,
        flaps_deg=0,
        mixture="leaned per placard",
        air_conditioner="off",
    )
    assert request(**conditions).conditions.items() >= conditions.items()
    _, document = source
    body = draft(document).model_dump()
    table = body["tables"][0]
    table["corrections"] = []
    table["correction_order"] = []
    table["combination_citations"] = []
    table["fixed_conditions"].update(
        {k: v for k, v in conditions.items() if k not in table["axes"] and k != "isa_deviation_c"}
    )
    assert DatasetDraft.model_validate(body).tables[0].fixed_conditions["power_pct"] == 110
