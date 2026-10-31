---
name: write-mac-project-contract
description: Create or refresh a MAC-compatible .mac/project.yaml repository contract from an exact Literate AI post-build CycloneDX BOM. Use only when a project opts into MAC runners or OpenShell-sandboxed execution, after build dependency resolution has produced the resolved BOM; it is a build/test runner contract, not task tracking.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Write a MAC project contract

Project MAC runner metadata from existing dependency evidence. Never scan source,
manifests, PATH, Components, Flavors, or other skills to fill gaps: that would create a
second dependency-analysis path beside CycloneDX.

## Preconditions

1. Read the project `SKILL.md`. This contract only lets MAC runners build and test the
   project; issues, reviews, and agent coordination stay on the project's tracker.
2. Build the intended Component/Flavor selection successfully. Locate that lifecycle's
   exact `.literate/resolved-sbom.cdx.json` post-build artifact.
3. Require the BOM to contain the complete component, selected-Flavor, selected-skill,
   package, build, test, toolchain, runtime, and system closure applicable to the run.
   If selected Flavor or skill authority is missing, fix the upstream SBOM projection;
   do not supplement it while writing the MAC contract.
4. Choose MAC platform family names: `darwin`, `linux`, `windows`, or `wsl2`. Use only
   families the project actually supports.

## Project the contract

Run from the canonical project:

```bash
litai project mac-contract PATH/TO/resolved-sbom.cdx.json \
  --project . \
  --platform darwin \
  --platform linux
```

The command writes:

- `.mac/project.yaml`, using `mac.repository_contract.v1`; and
- `.mac/project.contract.json`, a canonical compact sidecar binding the contract to the
  exact source BOM, resolved BOM, and resolved graph identities.

The default bootstrap and test commands are `litai build` and `litai test`. Override
them only when the project has a narrower canonical entry point:

```bash
litai project mac-contract PATH/TO/resolved-sbom.cdx.json \
  --project . --platform linux \
  --bootstrap-command "litai build components/service" \
  --test-command "litai test components/service"
```

The deterministic projector derives `toolchain.required_commands` only from executable
paths in build, test, packaging, deployment, or toolchain-scoped CycloneDX components.
It adds `litai` and `git`, which are intrinsic runner prerequisites for a
Literate AI repository. Runtime libraries are not misrepresented as shell commands.

## Verify and hand off

1. Re-run the command and require byte-identical files.
2. Run `litai project validate .` and the project's ordinary verification gates.
3. If MAC is installed, register or validate the checkout with MAC. MAC owns repository-
   contract validation, runner routing, and composition into an OpenShell policy;
   Literate AI does not generate or weaken OpenShell policy directly.
4. Regenerate after the resolved BOM identity, selected Component/Flavor/skill closure,
   supported platform set, or canonical bootstrap/test commands change.

Read [references/mac-repository-contract.md](references/mac-repository-contract.md) when
reviewing the field mapping or diagnosing a MAC validation failure.
