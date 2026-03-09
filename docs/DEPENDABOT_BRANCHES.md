# Dependabot branch investigation

Investigation date: 2026-03. All remote branches matching `dependabot/*` were reviewed against `origin/main`.

## Summary

| Category | Count | Action |
|----------|--------|--------|
| **Stale** (main already has same or higher) | Most npm/pip per-package branches | Close branch / delete remote |
| **Target wrong path** (e.g. `apps/flightplanner` vs `apps/flight-planner`) | 6+ | Close branch |
| **Relevant** (upgrade not on main) | GitHub Actions, a few pip/npm | Apply upgrade to main, then close branch |

## Branch-by-branch verdict

### GitHub Actions (RELEVANT – apply to main)

- `dependabot/github_actions/actions/checkout-6` – main has v4 → bump to v6
- `dependabot/github_actions/actions/setup-java-5` – main has v3 → bump to v5
- `dependabot/github_actions/actions/setup-python-6` – main has v4 → bump to v6
- `dependabot/github_actions/codecov/codecov-action-5` – main has v3 → bump to v5
- `dependabot/github_actions/docker/build-push-action-6` – main already v6 → **STALE**
- `dependabot/github_actions/github/codeql-action-4` – main has v3 → bump to v4

### NPM – accident-tracker backend

Main already has: express ^5.2.1, express-rate-limit ^8.2.1, pdfkit ^0.17.2, supertest ^7.2.2, @types/express ^5.0.6, @types/uuid ^11.0.0. **All STALE.**

- apollo/server-5.4.0, express-5.2.1, express-rate-limit-8.2.1, pdfkit-0.17.2, supertest-7.2.2, types/express-5.0.6, types/supertest-7.2.0, types/uuid-11.0.0 → **STALE**

### NPM – flight-planner frontend

Branches under `apps/flight-planner/frontend` (npm_and_yarn-*) are lockfile/group updates. Main has different major versions (e.g. MUI 5, framer-motion 10). **Treat as STALE or evaluate lockfile only.**

### NPM – apps/flightplanner (wrong path)

Repo uses `apps/flight-planner` (hyphen). `apps/flightplanner` exists but is minimal. All branches under `dependabot/.../apps/flightplanner/...` target the wrong app path. **STALE / close.**

- framer-motion-12.*, mui/x-date-pickers-8.*, multi-*, typescript-eslint/parser-8.* → **Close (wrong path)**

### NPM – foreflight-dashboard frontend

Main has eslint 8.x, MUI 5.x. Dependabot has eslint 9, MUI 7, etc. (major bumps). **Relevant but higher risk** – leave for separate upgrade or close after applying only safe minors if any.

### NPM – root / packages

- `cors-2.8.6` – aviation-chat has cors ^2.8.5 → **RELEVANT** (bump to 2.8.6)
- `react-leaflet-5.0.0` – ui-framework already ^5.0.0 → **STALE**
- `types/node-25.0.7` – main has ^25.3.0 → **STALE** (25.3 >= 25.0.7)
- `uuid-13.0.0` – accident-tracker already ^13.0.0 → **STALE**
- `packages/shared-sdk/jsdom-27.4.0` – shared-sdk has no jsdom in current package.json → **STALE**
- `packages/ui-framework/jsdom-27.4.0`, `jsdom-28.0.0` – main has jsdom ^28.1.0 → **STALE**
- `packages/ui-framework/types/react-19.2.8`, `types/react-dom-19.2.3` – main has ^19.2.9 / ^19.2.3 → **STALE**
- dev-dependencies-*, multi-* – lockfile/group → **STALE** (or apply if needed)

### Pip – flightschool

Main: Flask==2.3.3, Flask-Cors==4.0.0, Flask-Migrate==4.0.7, Flask-WTF==1.2.1. Dependabot: Flask 3.1.x, flask-cors 6.0.2, flask-migrate 4.1.0, flask-wtf 1.2.2. **Relevant** – Flask 3 is major; others are minor. Apply minor bumps (Flask-WTF 1.2.2, Flask-Migrate 4.1.0, flask-cors 6.0.2) if desired; Flask 3.x needs separate testing.

### Pip – foreflight-dashboard

Main: fastapi==0.133.0, sqlalchemy==2.0.46, uvicorn==0.41.0, python-dotenv==1.0.1, pytz==2025.2. **RELEVANT** – bump to fastapi 0.135.1, sqlalchemy 2.0.48, uvicorn 0.40.0, python-dotenv 1.2.2, pytz 2026.1.post1 (and related if any). pytest 9.0.2, pytest-asyncio 1.3.0, etc. – apply if compatible.

## Actions taken

1. **Apply relevant upgrades** to main (CI workflow actions, foreflight-dashboard deps, aviation-chat cors).
2. **Delete all Dependabot remote branches** so PRs close and the list stays manageable. Any remaining upgrades can be redone by Dependabot or manually.

## Deleting branches

From repo root:

```bash
# List then delete (requires push access)
git branch -r | grep dependabot | sed 's|origin/||' | xargs -I {} git push origin --delete {}
```

Or use GitHub UI: close each Dependabot PR, then delete the branch.

**Note:** "remote ref does not exist" means the branch was already deleted on GitHub (e.g. PR merged/closed); safe to ignore.
