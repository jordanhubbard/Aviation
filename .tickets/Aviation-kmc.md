---
id: Aviation-kmc
status: closed
deps: []
links: []
created: 2026-01-13T15:23:02.303881-08:00
type: task
priority: 2
mac-task-id: task_43cce799bf15450e9feeb475bb7faf99
---
# Migrate foreflight-dashboard to use shared SDK

**Epic Child: Aviation-q0h - Migrate Apps to Shared SDK**

Migrate foreflight-dashboard to use shared SDK for common functionality.

**Potential Shared Code:**
- Airport lookups (if used)
- ForeFlight API client (extract to shared SDK if reusable)
- Any map components

**Analysis Required:**
- Review what external services are used
- Identify opportunities for shared code
- May be minimal migration if mostly ForeFlight-specific

**Migration Steps:**
1. [ ] Audit current external service usage
2. [ ] Identify shared SDK opportunities
3. [ ] Add shared-sdk dependency if needed
4. [ ] Replace any airport/weather lookups
5. [ ] Extract ForeFlight client if reusable
6. [ ] Run full test suite
7. [ ] Update documentation

**Acceptance Criteria:**
- [ ] Audit complete
- [ ] Shared code identified
- [ ] Migration plan documented
- [ ] All tests passing
- [ ] Build successful

**Estimated Effort:** 1-2 days (may be minimal)

## Notes

Audit complete: foreflight-dashboard has minimal aviation data needs.

Current state:
- Simple Airport model (identifier + name only)
- ICAO aircraft type validator (local, comprehensive)
- No weather integration
- No navigation calculations
- No map components

Conclusion: No migration needed. The app is ForeFlight logbook-specific and doesn't use shared aviation services. The ICAO validator is comprehensive and app-specific (200+ aircraft types for logbooks).

If future needs arise:
- Airport lookups → shared SDK
- Weather data → shared SDK
- Navigation → shared SDK

Estimated effort if needed: 1 day
