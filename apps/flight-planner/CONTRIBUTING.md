# Contributing

Thanks for your interest in contributing to **flight-planner**.

## 1) Issue tracking (required)

This repo tracks issues in **mac** under the project **Aviation**. Tasks are
mirrored to git-tracked files in the repo's `.tickets/` directory.

- Find ready work:

```bash
mac task ready --project Aviation
```

- Claim work:

```bash
mac task claim <id> --project Aviation
```

- Close work:

```bash
mac task close <id> --project Aviation
```

## 2) Development setup

See `README.md` for full setup, but in short:

### Backend

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

## 3) Code style and quality gates

### Python (backend/tests/scripts)

- Format:

```bash
.venv/bin/python -m black backend tests scripts
```

- Lint:

```bash
.venv/bin/python -m flake8 backend tests scripts
```

- Type check:

```bash
.venv/bin/python -m mypy --config-file pyproject.toml backend
```

### Frontend

- Type check / lint:

```bash
cd frontend
npm run type-check
npm run lint
```

- Format:

```bash
cd frontend
npm run format
```

## 4) Tests

### Backend

```bash
.venv/bin/python -m pytest
```

### Frontend

```bash
cd frontend
npm run test
```

### End-to-end (Playwright)

```bash
cd frontend
npm run e2e
```

## 5) Pre-commit hooks (recommended)

If you have Python tooling installed in the venv, you can enable local hooks:

```bash
.venv/bin/python -m pre_commit install
```

Then hooks will run automatically on commits.

## 6) Pull request checklist

- [ ] Work is tracked in mac (project Aviation) and the relevant task is closed (or clearly left `in_progress` with context).
- [ ] Backend tests pass (`pytest`).
- [ ] Frontend checks pass (`npm run type-check`, `npm run lint`, `npm run test`).
- [ ] If UI flows changed, Playwright e2e passes (`npm run e2e`).
- [ ] No secrets committed.
