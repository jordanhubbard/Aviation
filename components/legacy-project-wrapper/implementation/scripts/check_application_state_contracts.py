#!/usr/bin/env python3
"""Validate the retained application persistence and credential inventory."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
IMPLEMENTATION = ROOT / "components" / "legacy-project-wrapper" / "implementation"
INVENTORY = ROOT / "docs" / "roadmap" / "application-state-contracts.json"

PERSISTENCE_CLASSIFICATIONS = {
    "application-private-runtime-state",
    "application-private-ephemeral-state",
    "dormant-retained-source",
}
CREDENTIAL_CLASSIFICATIONS = {
    "application-private-credential-adapter",
    "application-public-client-configuration",
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def validate_evidence(owner: str, evidence: list[dict[str, object]]) -> None:
    require(bool(evidence), f"{owner}: evidence must not be empty")
    for item in evidence:
        relative = item.get("path")
        fragments = item.get("contains")
        require(isinstance(relative, str) and relative, f"{owner}: invalid evidence path")
        require(isinstance(fragments, list) and fragments, f"{owner}: evidence fragments required")
        path = IMPLEMENTATION / relative
        require(path.is_file(), f"{owner}: evidence path does not exist: {relative}")
        text = path.read_text(encoding="utf-8")
        for fragment in fragments:
            require(isinstance(fragment, str) and fragment in text,
                    f"{owner}: {relative} does not contain {fragment!r}")


def main() -> None:
    data = json.loads(INVENTORY.read_text(encoding="utf-8"))
    require(data.get("$schema") == "aviation/application-state-contracts@1", "unexpected schema")
    require(data.get("authority") == "retained-runtime-inventory", "inventory must not claim Component authority")
    validate_evidence("sharedCredentialProvider", data["sharedCredentialProvider"]["evidence"])

    application_dirs = {
        path.name for path in (IMPLEMENTATION / "apps").iterdir() if path.is_dir()
    }
    applications = data.get("applications")
    require(isinstance(applications, list), "applications must be an array")
    application_ids = {application.get("id") for application in applications}
    require(application_ids == application_dirs,
            f"application coverage mismatch: missing={sorted(application_dirs - application_ids)} "
            f"extra={sorted(application_ids - application_dirs)}")

    for application in applications:
        app_id = application["id"]
        persistence = application.get("persistence")
        credentials = application.get("credentials")
        require(isinstance(persistence, list) and persistence, f"{app_id}: persistence inventory required")
        require(isinstance(credentials, list), f"{app_id}: credentials must be an array")
        require(isinstance(application.get("gaps"), list), f"{app_id}: gaps must be an array")

        state_ids: set[str] = set()
        for contract in persistence:
            contract_id = contract.get("id")
            owner = f"{app_id}.persistence.{contract_id}"
            require(isinstance(contract_id, str) and contract_id not in state_ids,
                    f"{owner}: duplicate or invalid id")
            state_ids.add(contract_id)
            for field in ("medium", "location", "schema", "migration", "backup", "rollback", "testOracle"):
                require(isinstance(contract.get(field), str) and contract[field], f"{owner}: {field} required")
            require(contract.get("classification") in PERSISTENCE_CLASSIFICATIONS,
                    f"{owner}: invalid classification")
            validate_evidence(owner, contract.get("evidence", []))

        credential_ids: set[str] = set()
        for contract in credentials:
            contract_id = contract.get("id")
            owner = f"{app_id}.credentials.{contract_id}"
            require(isinstance(contract_id, str) and contract_id not in credential_ids,
                    f"{owner}: duplicate or invalid id")
            credential_ids.add(contract_id)
            for field in ("provider", "namespace", "precedence", "missingBehavior"):
                require(isinstance(contract.get(field), str) and contract[field], f"{owner}: {field} required")
            require(isinstance(contract.get("keys"), list) and contract["keys"], f"{owner}: keys required")
            require(contract.get("classification") in CREDENTIAL_CLASSIFICATIONS,
                    f"{owner}: invalid classification")
            validate_evidence(owner, contract.get("evidence", []))

    print(f"application state contracts: {len(applications)} applications validated")


if __name__ == "__main__":
    main()
