# Lessons Learned

> Tracker note: work and review now live in [GitHub Issues](https://github.com/jordanhubbard/Aviation/issues). Legacy task references below are historical provenance.

## System Context
This project tracks engineering work in [GitHub Issues](https://github.com/jordanhubbard/Aviation/issues).

### Issue and review lifecycle
- Inspect work with `gh issue list --repo jordanhubbard/Aviation` and `gh issue view NUMBER`.
- Reuse or file the issue before implementation; link evidence and blockers there.
- Build and test the affected application before committing, push the branch, and
  submit a pull request. Close the issue after the required gates pass and work lands.

### Common Mistakes
1. **Forgetting to reconcile GitHub** — completed code with a stale issue state leaves the project tracker misleading
2. **Committing without pushing** — commit exists locally but remote never gets it; always push
3. **Import errors** — do NOT add `import (...)` statements inside function bodies; imports go at top of file
4. **Duplicate declarations** — check if a function/method already exists before adding it
5. **Wrong placeholder variables** — do NOT use `projectID`, `err`, `dr` unless they're in scope
6. **Loop detection** — if you get the same error 5+ times, change your approach rather than retrying

### Build System
- Go project: `go build ./...` to verify build
- Tests: `go test ./...` (requires postgres running with env vars)
- If build fails, FIX IT before declaring done

### Deadlock Escape
If you are stuck and cannot make progress:
1. Record the attempted approaches and exact blocker on the GitHub issue.
2. Include the specific error in the issue evidence.
3. Do NOT keep retrying the same failing operation
