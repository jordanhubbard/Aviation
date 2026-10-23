# Lessons Learned

## System Context
This project uses MAC as its task system. Key facts for agents:

### MAC Task Lifecycle
- Inspect work with `mac task ready --project Aviation` and `mac task show <task-id>`.
- Start work through MAC's normal assignment and lease flow.
- Complete work only after its required validation and evidence are available.
- Use `mac task close <task-id> --no-ticket` for the normal completion flow.

### Git Workflow
- Keep task IDs in commit or PR context when the change belongs to a MAC task.
- Build and test the affected application before committing.

### Common Mistakes
1. **Forgetting to reconcile MAC** — completed code with a stale task state leaves the project ledger misleading
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
1. Record the attempted approaches and exact blocker on the MAC task.
2. Include the specific error in the task evidence.
3. Do NOT keep retrying the same failing operation
