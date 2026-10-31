#!/usr/bin/env python3
"""Validate retained workspace membership, dependency edges, and build authority."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
IMPLEMENTATION = ROOT / "components" / "legacy-project-wrapper" / "implementation"
INVENTORY = ROOT / "docs" / "roadmap" / "workspace-package-graph.json"

CLASSIFICATIONS = {
    "native-component-realization",
    "shared-component-adapter",
    "shared-application-service",
    "repository-infrastructure",
}
TEST_GATES = {
    "monorepo-ci",
    "common-sdk-ci",
    "common-sdk-python",
    "common-sdk-ci-and-go",
    "common-sdk-ci-typescript-python",
    "common-sdk-ci-typescript-python-go",
}
PYTHON_GATE_PATHS = {
    "@aviation/flight-dynamics": "packages/flight-dynamics/tests",
    "@aviation/g1000-avionics-sdk": "packages/g1000-avionics-sdk/python/tests",
    "@aviation/keystore": "packages/keystore/python/tests",
    "@aviation/shared-sdk": "packages/shared-sdk/python/tests",
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def manifest_workspace_dependencies(manifest: dict[str, object]) -> list[str]:
    dependencies: dict[str, str] = {}
    for field in ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies"):
        value = manifest.get(field, {})
        require(isinstance(value, dict), f"package manifest {field} must be an object")
        dependencies.update(value)
    return sorted(name for name, version in dependencies.items()
                  if isinstance(version, str) and version.startswith("workspace:"))


def workspace_manifests() -> set[str]:
    paths: set[str] = set()
    for owner in ("packages", "apps"):
        for manifest in (IMPLEMENTATION / owner).rglob("package.json"):
            relative = manifest.relative_to(IMPLEMENTATION)
            if "node_modules" in relative.parts or "dist-esm" in relative.parts:
                continue
            if relative.parts[0] == "packages":
                require(len(relative.parts) == 3,
                        f"nested shared package is outside declared workspace globs: {relative}")
            else:
                require(len(relative.parts) in (3, 4),
                        f"nested application package is outside declared workspace globs: {relative}")
            paths.add(relative.parent.as_posix())
    return paths


def workspace_globs() -> list[str]:
    lines = (IMPLEMENTATION / "pnpm-workspace.yaml").read_text(encoding="utf-8").splitlines()
    globs: list[str] = []
    in_packages = False
    for line in lines:
        if line == "packages:":
            in_packages = True
            continue
        if in_packages and line and not line.startswith((" ", "\t", "#")):
            break
        stripped = line.strip()
        if in_packages and stripped.startswith("- "):
            globs.append(stripped[2:].strip('"\''))
    return globs


def validate_package(entry: dict[str, object], *, shared: bool) -> None:
    relative = entry.get("path")
    require(isinstance(relative, str) and relative, "package path required")
    manifest_path = IMPLEMENTATION / relative / "package.json"
    require(manifest_path.is_file(), f"missing package manifest: {relative}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    require(entry.get("name") == manifest.get("name"), f"{relative}: package name drift")
    require(entry.get("workspaceDependencies") == manifest_workspace_dependencies(manifest),
            f"{relative}: workspace dependency graph drift")
    scripts = manifest.get("scripts", {})
    require(isinstance(scripts, dict), f"{relative}: scripts must be an object")
    require(entry.get("buildScript") == scripts.get("build"), f"{relative}: build script drift")
    require(entry.get("testScript") == scripts.get("test"), f"{relative}: test script drift")
    if shared:
        require(entry.get("classification") in CLASSIFICATIONS,
                f"{relative}: invalid shared package classification")
        owners = entry.get("componentOwners")
        require(isinstance(owners, list), f"{relative}: componentOwners must be an array")
        if entry["classification"] in {"native-component-realization", "shared-component-adapter"}:
            require(bool(owners), f"{relative}: Component-backed package must name its owners")
        else:
            require(not owners, f"{relative}: non-Component package must not claim Component authority")
        require(isinstance(entry.get("testGate"), str) and entry["testGate"],
                f"{relative}: independent test gate required")
    else:
        require(entry.get("application") == relative.split("/")[1],
                f"{relative}: application owner mismatch")


def main() -> None:
    data = json.loads(INVENTORY.read_text(encoding="utf-8"))
    require(data.get("$schema") == "aviation/workspace-package-graph@1", "unexpected schema")
    require(data.get("authority") == "retained-build-inventory",
            "inventory must not claim native source authority")
    workspace = data.get("workspace")
    require(isinstance(workspace, dict), "workspace object required")
    root_manifest = json.loads((IMPLEMENTATION / "package.json").read_text(encoding="utf-8"))
    require(workspace.get("packageManager") == root_manifest.get("packageManager"),
            "pinned package manager drift")
    require(workspace.get("manifest") == "pnpm-workspace.yaml", "unexpected workspace manifest")
    require(workspace.get("globs") == workspace_globs(), "pnpm workspace glob drift")
    require(workspace.get("globs") == root_manifest.get("workspaces"),
            "package.json and pnpm workspace globs disagree")
    require(workspace.get("rootWorkspaceDependencies") ==
            manifest_workspace_dependencies(root_manifest), "root workspace dependency drift")

    component_packages = data.get("componentPackages")
    require(isinstance(component_packages, list) and component_packages,
            "componentPackages must be a non-empty array")
    for entry in component_packages:
        relative = entry.get("path")
        require(isinstance(relative, str) and relative.startswith("components/"),
                "Component package path must be repository-relative")
        manifest_path = ROOT / relative / "package.json"
        require(manifest_path.is_file(), f"missing Component package manifest: {relative}")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        require(entry.get("name") == manifest.get("name"), f"{relative}: package name drift")
        require(manifest.get("packageManager") == workspace.get("packageManager"),
                f"{relative}: package manager pin drift")
        require(entry.get("classification") == "component-owned-qualification-candidate",
                f"{relative}: Component package must remain a qualification candidate")
        require(entry.get("componentOwner") == "aviation.service.health",
                f"{relative}: unexpected Component owner")
        scripts = manifest.get("scripts", {})
        require(entry.get("buildScript") == scripts.get("build"), f"{relative}: build script drift")
        require(entry.get("testScript") == scripts.get("test"), f"{relative}: test script drift")
        require((ROOT / relative / "pnpm-lock.yaml").is_file(),
                f"{relative}: independently pinned lockfile required")

    shared = data.get("sharedPackages")
    application_packages = data.get("applicationPackages")
    require(isinstance(shared, list) and shared, "sharedPackages must be a non-empty array")
    require(isinstance(application_packages, list), "applicationPackages must be an array")
    entries = shared + application_packages
    paths = [entry.get("path") for entry in entries]
    names = [entry.get("name") for entry in entries]
    require(len(paths) == len(set(paths)), "duplicate package path")
    require(len(names) == len(set(names)), "duplicate package name")
    require(set(paths) == workspace_manifests(),
            f"workspace coverage mismatch: inventory={sorted(paths)} actual={sorted(workspace_manifests())}")
    for entry in shared:
        validate_package(entry, shared=True)
    for entry in application_packages:
        validate_package(entry, shared=False)

    sdk_workflow = (ROOT / ".github" / "workflows" / "sdk-ci.yml").read_text(encoding="utf-8")
    for entry in component_packages:
        require(entry["path"] in sdk_workflow, f"{entry['path']}: missing Common SDK CI path")
        require("pnpm install --frozen-lockfile --ignore-workspace" in sdk_workflow,
                f"{entry['path']}: missing independent install gate")
    monorepo_makefile = (IMPLEMENTATION / "Makefile").read_text(encoding="utf-8")
    for entry in shared:
        gate = entry["testGate"]
        require(gate in TEST_GATES, f"{entry['path']}: unknown test gate: {gate}")
        if "common-sdk-ci" in gate:
            command = f"pnpm --filter {entry['name']} run test"
            require(command in sdk_workflow, f"{entry['path']}: missing Common SDK test command")
        if "python" in gate:
            python_path = PYTHON_GATE_PATHS.get(entry["name"])
            require(python_path is not None and python_path in sdk_workflow,
                    f"{entry['path']}: missing Common SDK Python test evidence")
        if "go" in gate:
            require("go test ./..." in sdk_workflow,
                    f"{entry['path']}: missing Common SDK Go test evidence")
        if gate == "monorepo-ci":
            require(entry["path"] in monorepo_makefile,
                    f"{entry['path']}: missing monorepo test orchestration")

    package_names = set(names)
    for entry in entries:
        unknown = set(entry["workspaceDependencies"]) - package_names
        require(not unknown, f"{entry['path']}: unknown workspace dependencies: {sorted(unknown)}")

    applications = data.get("applications")
    require(isinstance(applications, list), "applications must be an array")
    actual_apps = {path.name for path in (IMPLEMENTATION / "apps").iterdir() if path.is_dir()}
    application_ids = {entry.get("id") for entry in applications}
    require(application_ids == actual_apps, "application build-authority coverage mismatch")
    package_paths = set(paths)
    for application in applications:
        app_id = application["id"]
        for relative in application.get("buildAuthorities", []):
            require((IMPLEMENTATION / relative).is_file(),
                    f"{app_id}: build authority does not exist: {relative}")
        node_packages = application.get("nodePackages")
        require(isinstance(node_packages, list), f"{app_id}: nodePackages must be an array")
        require(set(node_packages) <= package_paths, f"{app_id}: unknown node package")
        for relative in node_packages:
            require(relative == f"apps/{app_id}" or relative.startswith(f"apps/{app_id}/"),
                    f"{app_id}: node package belongs to another application: {relative}")

    require(isinstance(data.get("knownGaps"), list) and data["knownGaps"],
            "known build/test gaps must remain explicit")
    print(f"workspace package graph: {len(shared)} shared packages, "
          f"{len(application_packages)} application packages, {len(applications)} applications validated")


if __name__ == "__main__":
    main()
