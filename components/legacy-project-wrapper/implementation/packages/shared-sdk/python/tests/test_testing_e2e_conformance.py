"""Conformance adapter for Component-owned remote-E2E trust and isolation."""

from copy import deepcopy
from pathlib import Path

import pytest

from aviation.e2e import (
    E2EContractError, create_e2e_lease, classify_e2e_lease,
    assert_test_record_for_run,
    isolated_run_directory,
    isolated_sqlite_path,
    parse_e2e_run_id,
    sign_e2e_headers,
    tag_test_record,
    verify_e2e_headers,
)
from _conformance_contract import load_conformance_contract


CONTRACT = load_conformance_contract("testing-e2e")


@pytest.mark.parametrize("vector", CONTRACT["runIdCases"], ids=lambda item: item["id"])
def test_run_identity(vector: dict[str, object]) -> None:
    assert parse_e2e_run_id(vector["input"]) == vector["expected"]


@pytest.mark.parametrize(
    "vector", CONTRACT["invalidRunIdCases"], ids=lambda item: item["id"]
)
def test_invalid_run_identity(vector: dict[str, object]) -> None:
    with pytest.raises(E2EContractError) as raised:
        parse_e2e_run_id(vector["input"])
    assert raised.value.code == vector["code"]


@pytest.mark.parametrize("vector", CONTRACT["pathCases"], ids=lambda item: item["id"])
def test_isolated_paths(vector: dict[str, str]) -> None:
    root = Path(vector["root"]).resolve()
    directory = isolated_run_directory(vector["root"], vector["runId"])
    sqlite = isolated_sqlite_path(vector["root"], vector["runId"])
    assert directory.name == vector["expectedDirectoryLeaf"]
    assert sqlite.name == vector["expectedSqliteLeaf"]
    assert directory.parent == root
    assert sqlite.parent == root


@pytest.mark.parametrize("vector", CONTRACT["tagCases"], ids=lambda item: item["id"])
def test_tag_record(vector: dict[str, object]) -> None:
    before = deepcopy(vector["input"])
    tagged = tag_test_record(vector["runId"], vector["input"])
    assert tagged == vector["expected"]
    assert vector["input"] == before
    assert_test_record_for_run(tagged, vector["runId"])


@pytest.mark.parametrize(
    "vector", CONTRACT["invalidRecordCases"], ids=lambda item: item["id"]
)
def test_invalid_record(vector: dict[str, object]) -> None:
    before = deepcopy(vector["input"])
    with pytest.raises(E2EContractError) as raised:
        if vector["operation"] == "tag":
            tag_test_record(vector["runId"], vector["input"])
        else:
            assert_test_record_for_run(vector["input"], vector["runId"])
    assert raised.value.code == vector["code"]
    assert vector["input"] == before


@pytest.mark.parametrize(
    "vector", CONTRACT["signingCases"], ids=lambda item: item["id"]
)
def test_signing(vector: dict[str, object]) -> None:
    assert sign_e2e_headers(
        vector["appId"],
        vector["runId"],
        vector["secret"],
        vector["nowMs"],
        vector["ttlMs"],
    ) == vector["expected"]


@pytest.mark.parametrize(
    "vector", CONTRACT["verificationCases"], ids=lambda item: item["id"]
)
def test_verification(vector: dict[str, object]) -> None:
    assert verify_e2e_headers(
        vector["appId"], vector["headers"], vector["secret"], vector["nowMs"]
    ) == vector["expected"]


@pytest.mark.parametrize(
    "vector", CONTRACT["invalidCredentialCases"], ids=lambda item: item["id"]
)
def test_invalid_credential(vector: dict[str, object]) -> None:
    with pytest.raises(E2EContractError) as raised:
        verify_e2e_headers(
            vector["appId"], vector["headers"], vector["secret"], vector["nowMs"]
        )
    assert raised.value.code == vector["code"]



@pytest.mark.parametrize("v", CONTRACT["leaseCreationCases"], ids=lambda v: v["id"])
def test_create_lease(v):
    assert create_e2e_lease(v["appId"], v["runId"], v["nowMs"], v["ttlMs"]) == v["expected"]


@pytest.mark.parametrize("v", CONTRACT["invalidLeaseCreationCases"], ids=lambda v: v["id"])
def test_invalid_lease_creation(v):
    with pytest.raises(E2EContractError) as raised:
        create_e2e_lease(v["appId"], v["runId"], v["nowMs"], v["ttlMs"])
    assert raised.value.code == v["code"]


@pytest.mark.parametrize("v", CONTRACT["leaseClassificationCases"], ids=lambda v: v["id"])
def test_classify_lease(v):
    before = deepcopy(v["input"])
    assert classify_e2e_lease(v["input"], v["appId"], v["nowMs"]) == v["expected"]
    assert v["input"] == before
