# Agent Instructions

This project tracks issues in **mac** under the project **Aviation**. Tasks are
mirrored to git-tracked files in the repo's `.tickets/` directory.

## Quick Reference

```bash
mac task ready --project Aviation   # Find available work
mac task list --project Aviation    # List all tasks
mac task claim <id> --project Aviation   # Claim work
mac task close <id> --project Aviation   # Complete work
mac task stats --project Aviation   # Show task statistics
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds



<!-- BEGIN MAC INTEGRATION -->
## Issue Tracking with mac

**IMPORTANT**: This project tracks ALL work in **mac** under the project
**Aviation**. Do NOT use markdown TODOs, task lists, or other tracking methods.
Tasks are mirrored to git-tracked files in the repo's `.tickets/` directory
(each ticket's frontmatter carries its `mac-task-id`).

### Why mac?

- Dependency-aware: tasks become "ready" once their blockers are complete
- Git-friendly: a `.tickets/<id>.md` mirror is version-controlled with the code
- Single source of truth: prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
mac task ready --project Aviation
```

**Create new tasks:**

```bash
mac task create "Task title" --project Aviation
```

**Claim and complete:**

```bash
mac task claim <id> --project Aviation
mac task close <id> --project Aviation
```

**See task statistics:**

```bash
mac task stats --project Aviation
```

### Workflow for AI Agents

1. **Check ready work**: `mac task ready --project Aviation` shows unblocked tasks
2. **Claim your task**: `mac task claim <id> --project Aviation`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create a task: `mac task create "Found bug" --project Aviation`
5. **Complete**: `mac task close <id> --project Aviation`

### Important Rules

- ✅ Use mac for ALL task tracking
- ✅ Commit the changed `.tickets/` files alongside your code
- ✅ Check `mac task ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

<!-- END MAC INTEGRATION -->
