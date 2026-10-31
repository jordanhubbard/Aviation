"""Flight Planner storage adapter for the shared SDK's isolated E2E runtime."""
from __future__ import annotations

import os
import json
from pathlib import Path

from aviation.e2e import (
    E2EContractError,
    assert_test_record_for_run,
    isolated_run_directory,
    tag_test_record,
)

RUN_ID = os.environ.get('AVIATION_E2E_RUN_ID')
SECRET = os.environ.get('AVIATION_E2E_SECRET')
DATA_DIR = os.environ.get('AVIATION_E2E_DATA_DIR')

if RUN_ID:
    expected = isolated_run_directory('/tmp/aviation-e2e', RUN_ID)
    if not SECRET or len(SECRET) < 32 or not DATA_DIR or Path(DATA_DIR).resolve() != expected:
        raise RuntimeError('Flight Planner E2E requires a signed, isolated data directory')
    expected.mkdir(parents=True, exist_ok=True)
    (expected / 'e2e_runs.json').write_text(json.dumps([
        {'test_run_id': RUN_ID, 'is_test_data': True}
    ]))
elif DATA_DIR:
    raise RuntimeError('Partial Flight Planner E2E configuration')


def data_dir(production: str | Path) -> Path:
    return isolated_run_directory('/tmp/aviation-e2e', RUN_ID) if RUN_ID else Path(production)


def stored_record(value: dict) -> dict:
    return tag_test_record(RUN_ID, value) if RUN_ID else value


def assert_store_isolated(records: list[dict]) -> None:
    if not RUN_ID:
        return
    try:
        for record in records:
            assert_test_record_for_run(record, RUN_ID)
    except E2EContractError:
        raise RuntimeError(
            'Flight Planner test store contains an untagged or foreign record'
        ) from None
