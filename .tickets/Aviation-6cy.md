---
id: Aviation-6cy
status: closed
deps: []
links: []
created: 2026-01-14T10:05:56.991182-08:00
type: feature
priority: 2
mac-task-id: task_61bbd769fd7d4c93bcda9556d0c5193d
---
# Add authentication and rate limiting to accident-tracker API

Add production-ready authentication and rate limiting to the accident-tracker API.

**Current State:**
- Ingestion endpoint has basic Bearer token auth
- No rate limiting on public endpoints
- No user authentication

**Requirements:**
1. **API Key Authentication:**
   - Generate API keys for external consumers
   - Store keys securely in database
   - Validate on every request
   - Rate limit per API key

2. **Rate Limiting:**
   - Public endpoints: 100 requests/hour per IP
   - Authenticated: 1000 requests/hour per key
   - Ingestion endpoint: Admin only
   - Return appropriate 429 status codes

3. **Admin Dashboard:**
   - View API key usage
   - Create/revoke API keys
   - View rate limit violations
   - Monitor ingestion status

**Implementation:**
- Use express-rate-limit for rate limiting
- Store API keys in SQLite
- Add /admin routes with authentication
- Update OpenAPI spec

**Acceptance Criteria:**
- [ ] API key generation and validation
- [ ] Rate limiting implemented
- [ ] Admin dashboard functional
- [ ] Documentation updated
- [ ] Tests added

**Estimated Effort:** 3-4 days
