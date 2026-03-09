# Lessons Learned

## System Context
This project runs inside the Loom autonomous agent platform. Key facts for agents:

### Bead Lifecycle
- A bead transitions: `open` → `in_progress` → `closed` (success) or `blocked` (stuck)
- Your job: **close the bead** by completing the task, committing, pushing, then calling `close_bead` or `done`
- Bead stays `in_progress` until YOU close it — the system does NOT auto-close

### Git Workflow
- Always commit changes with `git_commit` action
- Always push with `git_push` action after committing
- Commit message format: `type: description\n\nBead: <bead-id>`
- Build must pass before committing (`go build ./...` or equivalent)

### Common Mistakes
1. **Forgetting to close the bead** — task work done but no `close_bead`/`done` action = bead stuck in_progress forever
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
1. Describe what you tried in a `done` or `close_bead` action with `status: blocked`
2. Include the specific error in the description
3. Do NOT keep retrying the same failing operation
