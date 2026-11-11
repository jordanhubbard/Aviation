#!/usr/bin/env python3
"""Fail closed if engineering work or runtime reporters drift to a retired tracker."""
from __future__ import annotations

import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[4]
IMPLEMENTATION = ROOT / 'components/legacy-project-wrapper/implementation'


def validate(root: Path = ROOT) -> None:
    implementation = root / 'components/legacy-project-wrapper/implementation'
    contract = json.loads((root / '.github/issue-tracking.json').read_text())
    assert contract['schema'] == 'aviation/github-issue-tracking@1'
    assert contract['provider'] == 'github' and contract['review'] == 'pull-requests'
    assert re.fullmatch(r'[A-Za-z0-9_-][A-Za-z0-9_.-]*/[A-Za-z0-9_-][A-Za-z0-9_.-]*', contract['repository'])
    assert contract['issues_url'] == f"https://github.com/{contract['repository']}/issues"
    for key in ['migration_map', 'guide']:
        target = (root / contract[key]).resolve()
        assert target.is_relative_to(root.resolve()) and target.is_file(), key
    assert not (root / '.mac/project.yaml').exists()
    assert not (implementation / '.mac/project.yaml').exists()
    for name in ['bug_report.yml', 'feature_request.yml', 'config.yml']:
        assert (root / '.github/ISSUE_TEMPLATE' / name).is_file(), name
    for path in [root / 'AGENTS.md', implementation / 'AGENTS.md', implementation / 'CONTRIBUTING.md',
                 implementation / 'apps/flight-planner/AGENTS.md', implementation / 'apps/flight-planner/@AGENTS.md',
                 implementation / 'apps/flight-planner/CONTRIBUTING.md']:
        text = path.read_text()
        assert 'GitHub' in text, path
        assert not re.search(r'\bmac\s+task\b|MAC is the sole|MAC as its sole', text), path
    obsolete = re.compile(r'MacTaskCreator|aviation\.mac_tasks|\bmac_tasks\b|\bmac_reporter\b|macReporting|MAC_API_URL|MAC_API_TOKEN|MAC_AUTOREPORT')
    for base in [implementation / 'packages/shared-sdk/src', implementation / 'packages/shared-sdk/python/aviation',
                 implementation / 'apps']:
        for path in base.rglob('*'):
            if path.suffix not in {'.py', '.ts', '.tsx', '.mjs'} or not path.is_file():
                continue
            if any(part in {'node_modules', 'dist', 'dist-esm', '_build', 'venv', '.venv', 'tests', '__tests__', '__pycache__'} for part in path.parts):
                continue
            assert not obsolete.search(path.read_text()), f'Retired runtime tracker in {path}'
    print('GitHub issue tracking validated: instructions, forms, configuration and runtime adapters')


if __name__ == '__main__':
    validate()
