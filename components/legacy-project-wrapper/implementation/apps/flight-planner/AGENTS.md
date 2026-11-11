# Agent Instructions

Follow the repository root `AGENTS.md` and `SKILL.md`. GitHub Issues and pull
requests in `jordanhubbard/Aviation` are the sole work and review authority.

```sh
gh issue list --repo jordanhubbard/Aviation --state open
gh issue view NUMBER --repo jordanhubbard/Aviation
gh issue create --repo jordanhubbard/Aviation --title "Outcome" --body-file issue.md
```

Keep dependencies and acceptance evidence in the issue and its PR. Run relevant
checks, commit and push the change, and close the GitHub issue after completion.
Do not create a task in a separate tracker or require its lifecycle review.
