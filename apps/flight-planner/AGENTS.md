# Agent Instructions

This application uses the Aviation project in MAC for all task tracking. Do not
create local ticket databases or Markdown task lists.

## Task workflow

Use the current CLI from the MAC source checkout when it is available:

```bash
/Users/jkh/Src/mac/.venv/bin/mac task ready --project Aviation
/Users/jkh/Src/mac/.venv/bin/mac task show <task-id>
/Users/jkh/Src/mac/.venv/bin/mac task create "Follow-up title" \
  --project Aviation --no-ticket --description "Detailed context"
```

The MAC hub owns task state, dependencies, evidence, and dispatch. New tasks
must use `--project Aviation --no-ticket`; dependencies must be MAC task IDs.

## Session completion

1. Create MAC follow-up tasks for remaining work.
2. Run the relevant tests, linters, and builds.
3. Attach evidence and update the active MAC task through its normal lifecycle.
4. Commit and push authorized repository changes.
5. Verify the branch and MAC task state agree before handing off.

Never bypass MAC review or evidence gates merely to make a task appear done.
