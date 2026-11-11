# GitHub issue tracking

Use [Aviation Issues](https://github.com/jordanhubbard/Aviation/issues) for all
engineering work and GitHub pull requests for review and CI evidence. GitHub is the
status authority; roadmap documents provide design context and historical links.

```sh
gh issue list --repo jordanhubbard/Aviation --state open
gh issue view NUMBER --repo jordanhubbard/Aviation
gh issue create --repo jordanhubbard/Aviation --title "Outcome" --body-file issue.md
gh pr create --repo jordanhubbard/Aviation --base main --body-file pr.md
```

Reuse an existing issue, state the desired outcome and acceptance evidence, and link
blocking/related issues in its body. Reference it from the PR. Keep the issue current
with evidence and close it after the work lands and its declared gates pass. A failed
check remains a failed check; use a separately linked issue for unrelated follow-ups.
No separate task service or task-lifecycle review gates this workflow.

The [work index](../roadmap/active-work.md) preserves design references. The
[tracker migration archive](../history/tracker/README.md) records imported issue
mappings and terminal history; it is read-only evidence.

## Optional runtime reports

The shared TypeScript `GitHubIssueCreator` and Python
`aviation.github_issues.GitHubIssueCreator` file engineering issues directly in
GitHub. Existing manual feedback already files GitHub issues through Meta App.
Runtime automation requires explicit server-side configuration:

```text
GITHUB_ISSUES_REPOSITORY=jordanhubbard/Aviation
GITHUB_ISSUES_TOKEN=<scoped server-side issue-write credential>
GITHUB_ISSUES_AUTOREPORT=1
```

Automatic reporting stays disabled without opt-in and a credential, and stays off in
CI/tests unless `GITHUB_ISSUES_AUTOREPORT_FORCE=1` explicitly selects a private test
provider. Never use that force flag to send test failures to the public repository.
Existing debug-only application gates remain in force. An optional `GITHUB_API_URL`
selects a trusted GitHub Enterprise API; only HTTPS or explicit loopback HTTP is
accepted. No retired tracker setting or credential is a fallback.

Clients return `issueNumber`/`issueUrl` (Python: `issue_number`/`issue_url`). Bodies
use GitHub's title/body contract, common credentials and URL query values are
redacted, duplicate/in-flight reports are suppressed, and each process allows at
most five filing attempts per hour. Failed requests can be retried. Review diagnostic
content before enabling automation for a repository's visibility; redaction is not a
substitute for avoiding private application data in error context.

App reporters use `/api/issues/enabled` and `/api/issues/report`. Credentials remain
server-side; the browser receives only capability and issue-result fields.
