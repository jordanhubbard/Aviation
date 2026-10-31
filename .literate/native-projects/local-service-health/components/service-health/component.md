---
namespace: local
version: 1.0.0
display_name: Service Health
kind: library
profiles:
  - library
  - portable
  - source-derived
sample: false
provides:
  - name: aviation.service.health
    version: 1.0.0
    interface:
      uri: specs/derived/interface-aviation-service-health-9d9b83efa0.md
requires: []
specification_provider: openspec
specification_roots:
  - specs/derived/spec.md
authoring_inputs:
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/portable-application-implementation/SKILL.md
    pin: sha256:55dece8843519c6ced884d7cd9eb5d8bff04ebccef055c74c5bfcf176ccd06cd
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/portable-application/SKILL.md
    pin: sha256:79519b3fde095c4189cd95c0e6ff3049a31557c34938ca5df4d0481b64f6e606
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/portable-specification-planning/SKILL.md
    pin: sha256:7bfdd0ddf52d2ddf5d6ac5ed6536b999da474323978937e72f4e4d3b1dface38
workflow_definition:
  uri: workflows/production/staging/dev/workflow.md
  pin: sha256:64424cf72fde2c06f73df88fcba06a00f781a82c4ecdbe22747938412be8ddd8
routing_policy:
  uri: routing/production/staging/dev/routing.json
  pin: sha256:cfd83da047b5ba1534316e856eb74686b90b4a33f803e936e848a1798624f110
flavor_slots:
  - slot_id: build-system
    axis: build.system
    cardinality: zero-or-one
    capability_contract: aviation.service.health
  - slot_id: implementation-language-ecosystem
    axis: implementation.language-ecosystem
    cardinality: exactly-one
    capability_contract: aviation.service.health
  - slot_id: platform-os
    axis: platform.os
    cardinality: exactly-one
    capability_contract: aviation.service.health
entrypoints: []
acceptance_contracts:
  - uri: qualification/profile.json
    pin: sha256:b36064b0196bddc0729b28cb21086a4d9185f947dfedab4dbe38054ebfbafa78
source_dependencies: []
library_imports:
  - language: javascript
    package: aviation-service-health
    capability: aviation.service.health
    module: aviation-service-health/index
    symbols:
      - HealthReportError
      - createHealthReport
      - normalizeHealthStatus
---
Source-derived Component. Intent authority is the accepted specification; release implementation authority remains with the recorded source baseline until regenerative qualification passes.
