---
id: Aviation-8m2
status: closed
deps: []
links: []
created: 2026-01-13T15:24:01.41774-08:00
type: task
priority: 2
mac-task-id: task_6b50afd07807417b9e2a205a76212a00
---
# Run full monorepo validation and CI/CD suite

**Epic Child: Aviation-gnm - Post-Migration Validation**

Run comprehensive validation across entire monorepo after shared SDK migration.

**Monorepo-Wide Validation:**

**Build System:**
- [ ] `make build` succeeds for all apps
- [ ] `npm run build --workspaces` succeeds
- [ ] No circular dependencies
- [ ] Shared packages build first

**Test Suite:**
- [ ] `make test` passes all apps
- [ ] `make test-node` passes
- [ ] `make test-python` passes
- [ ] `make test-clojure` passes
- [ ] Overall coverage >75%

**Code Quality:**
- [ ] `npm run lint` passes
- [ ] `make lint-python` passes (black, flake8)
- [ ] `python validate_beads.py` passes
- [ ] `./scripts/check-all-contrast.sh` passes

**CI/CD Pipeline:**
- [ ] All GitHub Actions workflows green
- [ ] validate-beads job passes
- [ ] accessibility job passes
- [ ] test-missions-app passes
- [ ] test-flightplanner passes
- [ ] test-flightschool passes
- [ ] test-foreflight passes
- [ ] security-scan passes
- [ ] build-check passes

**Dependencies:**
- [ ] No version conflicts
- [ ] All shared SDK versions aligned
- [ ] npm audit shows no critical issues
- [ ] safety check (Python) passes

**Documentation:**
- [ ] All READMEs updated
- [ ] Shared SDK docs complete
- [ ] Migration guides complete
- [ ] API docs regenerated

**Acceptance Criteria:**
- [ ] 100% CI/CD green
- [ ] All apps validated individually
- [ ] No breaking changes
- [ ] Ready for production deployment
- [ ] Documentation complete

**Commands to Run:**
```bash
cd /Users/jkh/Src/Aviation
make ci-check
python validate_beads.py
./scripts/check-all-contrast.sh
make test
make build
```

**Estimated Effort:** 2-3 days
