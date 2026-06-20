---
id: Aviation-tcy
status: closed
deps: []
links: []
created: 2026-01-13T15:23:27.158697-08:00
type: task
priority: 2
mac-task-id: task_ab93091a394443ab989e6d6624c7ff38
---
# Migrate aviation-missions-app to use shared SDK (minimal)

**Epic Child: Aviation-q0h - Migrate Apps to Shared SDK**

Audit and migrate aviation-missions-app if applicable.

**Current State:**
- Clojure application
- H2 database
- Minimal external dependencies (from env.example)

**Analysis Required:**
- Review what aviation data is used
- Determine if shared SDK applicable
- May need Clojure wrapper or HTTP API calls

**Options:**
1. If using airports/weather: Call shared SDK via HTTP service
2. If minimal dependencies: May not need migration
3. If using Java libraries: Consider JVM-compatible shared code

**Migration Steps:**
1. [ ] Audit current implementation
2. [ ] Identify shared SDK opportunities
3. [ ] Determine integration approach (HTTP vs native)
4. [ ] Implement integration if needed
5. [ ] Run tests
6. [ ] Update documentation

**Acceptance Criteria:**
- [ ] Audit complete
- [ ] Integration approach decided
- [ ] Migration completed (if applicable)
- [ ] All tests passing
- [ ] Build successful

**Estimated Effort:** 1 day (audit + minimal work)
