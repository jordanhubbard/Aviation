# MAC repository-contract mapping

The compatibility target is the schema currently accepted by MAC at
`.mac/project.yaml`:

```yaml
schema: mac.repository_contract.v1
project: example
platforms:
  - linux
toolchain:
  required_commands:
    - git
    - litai
bootstrap:
  command: "litai build"
  creates:
test:
  command: "litai test"
evidence:
  required:
    - repo.head_sha
    - repo.pushed
    - repo.dirty
    - repo.files_changed
    - tests
```

| MAC field | Literate AI authority |
|---|---|
| `project` | canonical `literate.project.json` project ID |
| `platforms` | explicit operator selection constrained to MAC host families |
| `toolchain.required_commands` | executable paths in the exact resolved CycloneDX closure, plus intrinsic `litai` and `git` |
| `bootstrap.command` | canonical LitAI lifecycle command, default `litai build` |
| `bootstrap.creates` | explicit repo-relative artifact hints, empty by default |
| `test.command` | canonical LitAI verification command, default `litai test` |
| `evidence.required` | MAC worker-publication evidence contract |

`.mac/project.contract.json` is Literate AI projection evidence, not part of MAC's YAML
schema. It makes staleness detectable without adding non-MAC extension keys to
`project.yaml`.

MAC uses the repository contract to prepare and verify work and contributes project
requirements to its OpenShell execution policy. Policy enforcement and network or
filesystem grants remain MAC/OpenShell responsibilities.
