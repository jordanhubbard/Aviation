# AGENTS.md - LLM-Friendly Repository Guidelines

This document provides comprehensive guidelines for LLM agents working with this monorepo. It follows best practices for making codebases easy to understand and work with for both humans and AI assistants.

## Repository Structure

This is a monorepo containing **6 aviation applications** and **3 shared packages**:

```
Aviation/
├── apps/                          # Applications
│   ├── aviation-missions-app/     # Mission management (Clojure + JS)
│   ├── flight-tracker/            # Flight tracking (TypeScript)
│   ├── flightplanner/             # VFR planning (Python + React)
│   ├── flightschool/              # Flight school mgmt (Python Flask)
│   ├── foreflight-dashboard/      # Logbook analysis (Python + React)
│   └── weather-briefing/          # Weather briefing (TypeScript)
├── packages/                      # Shared packages
│   ├── keystore/                  # Encrypted key management
│   ├── shared-sdk/                # Common SDK and patterns
│   └── ui-framework/              # Multi-modal UI framework
├── docs/                          # All user-facing documentation
├── scripts/                       # Build and utility scripts
├── .github/workflows/             # CI/CD pipeline
├── AGENTS.md                      # This file - LLM guidelines
├── CONTRIBUTING.md                # Development guidelines
├── README.md                      # Repository overview
└── LICENSE                        # MIT License
```

## Monorepo Organization

### Applications (`apps/`)
Each application in `apps/` is a complete, standalone application that may depend on shared packages. Applications should:
- Be fully self-contained with their own dependencies
- Include their own README.md with setup and usage instructions
- Have their own tests, build configuration, and deployment setup
- Use relative paths when importing from shared packages

### Packages (`packages/`)
Shared code, libraries, and SDKs that can be used by multiple applications. Packages should:
- Have a clear, single responsibility
- Be independently versioned
- Include comprehensive tests
- Provide TypeScript types or Python type hints

## Work Organization with Beads

This monorepo uses the **beads** pattern for work organization and parallelism:

### What are Beads?

Beads are independent, composable units of work that can be:
1. **Executed in parallel** - Multiple beads can run simultaneously
2. **Tested independently** - Each bead has its own test suite
3. **Developed separately** - Teams can work on different beads without conflicts
4. **Composed together** - Beads can be combined to create complex workflows

### Bead Structure

Each application or package should be organized as a collection of beads:

```
app-or-package/
├── beads/                 # Bead definitions
│   ├── bead-name/
│   │   ├── __init__.py   # Bead entry point
│   │   ├── logic.py      # Business logic
│   │   └── tests/        # Bead-specific tests
├── beads.yaml            # Bead configuration and dependencies
└── README.md
```

### Bead Configuration (beads.yaml)

```yaml
beads:
  - name: import-csv
    description: Import and parse CSV files
    dependencies: []
    parallel: true
    
  - name: validate-data
    description: Validate imported data
    dependencies: [import-csv]
    parallel: true
    
  - name: generate-report
    description: Generate analysis reports
    dependencies: [validate-data]
    parallel: false
```

## Style Guidelines

### Python Code
- Use **Black** for formatting (line length: 88)
- Follow **PEP 8** conventions
- Use **type hints** for all function signatures
- Write **docstrings** for all public functions and classes
- Maximum line length: 88 characters

### TypeScript/JavaScript Code
- Use **Prettier** for formatting
- Follow **ESLint** rules with TypeScript strict mode
- Use **functional components** and hooks in React
- Prefer **named exports** over default exports
- Use **2-space indentation**

### Documentation

**Critical Documentation Rules:**

1. **Top-Level Directory Structure** (STRICTLY ENFORCED):
   - **ONLY** these .md files are allowed at the top level:
     - `README.md` - Main repository overview
     - `AGENTS.md` - This file (LLM guidelines)
     - `CONTRIBUTING.md` - Development guidelines
     - `LICENSE` - MIT License (not .md)
   - **NO temporary .md files** at the top level
   - **NO completion notices** (e.g., INTEGRATION_COMPLETE.md)
   - **NO setup guides** at the top level (they go in `docs/`)

2. **User-Facing Documentation Location**:
   - **ALL user-facing documentation** goes in `docs/` directory
   - Examples of user-facing docs:
     - Setup guides (KEYSTORE_SETUP.md)
     - Quick starts (SECRETS_QUICKSTART.md)
     - Architecture docs (ARCHITECTURE.md)
     - Security guides (SECURITY.md)
     - Migration guides (MIGRATION.md)
     - Feature documentation
     - Integration guides

3. **Application-Specific Documentation**:
   - Each app/package must have its own `README.md` in its directory
   - Application READMEs should include:
     - Clear description and purpose
     - Setup and installation instructions
     - Usage examples and commands
     - API documentation (if applicable)
     - Testing instructions
     - Link to main repo docs where relevant

4. **Documentation Standards**:
   - Use **Markdown** for all documentation
   - Include **code examples** with syntax highlighting
   - Keep documentation **up-to-date** with code changes
   - Add **hot links** in README.md to all docs in `docs/`
   - Use clear, concise language
   - Structure with proper headings (H1, H2, H3)

5. **When Creating New Documentation**:
   - Ask: "Is this user-facing?" → Yes → `docs/` directory
   - Ask: "Is this app-specific?" → Yes → `apps/app-name/` directory
   - Ask: "Is this temporary?" → Yes → Don't create it
   - Update `README.md` with hot link if it's user-facing

### Testing
- Aim for **80%+ code coverage**
- Write **unit tests** for individual functions
- Write **integration tests** for workflows
- Write **E2E tests** for user-facing features
- Tests should be **fast** and **deterministic**

## Git Workflow

### Branch Naming
- Feature branches: `feature/description`
- Bug fixes: `fix/description`
- Documentation: `docs/description`
- Refactoring: `refactor/description`

### Commit Messages
Follow conventional commits format:
```
type(scope): subject

body (optional)
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
```
feat(foreflight-dashboard): add night flight validation

Add validation rules for night flight logging that ensure
proper time accounting and cross-country requirements.
```

## Building and Testing

### Application Development
Each application has its own build and test commands. Refer to the app's README.md for specifics.

Common patterns:
```bash
# Python apps
cd apps/app-name
pip install -r requirements.txt
pytest

# Node/React apps
cd apps/app-name
npm install
npm test
npm run build
```

### Running in Docker
Most applications are designed for Docker deployment:
```bash
cd apps/app-name
docker-compose up --build
```

## Secrets Management

This monorepo uses a **secure, encrypted keystore** for managing secrets:

- **Keystore Location**: `.keystore` file at monorepo root (encrypted)
- **CLI Tool**: `npm run keystore` for managing secrets
- **Encryption**: AES-256-CBC encryption
- **Production Key**: Set `KEYSTORE_ENCRYPTION_KEY` environment variable

### Never Commit:
- `.env` files with secrets
- Unencrypted credentials
- API keys in code
- Passwords or tokens

### Always Use:
- Keystore CLI for setting secrets: `npm run keystore set <service> <KEY> "value"`
- SecretLoader in TypeScript: `createSecretLoader('service-name')`
- Python keystore client: `create_secret_loader('service-name')`
- Environment variable fallback for development: Check keystore first, then env vars

## CI/CD and Automated Workflows

### CI/CD Pipeline
The monorepo has a comprehensive CI/CD pipeline that runs on every push and PR:

1. **Validate Beads Configuration** - Ensures all apps have valid beads.yaml
2. **Lint & Format** - Checks code style (Black, Prettier, ESLint)
3. **Test Applications** - Runs all unit and integration tests
4. **Security Scan** - CodeQL analysis and Trivy container scanning
5. **Accessibility Checks** - Color contrast and accessibility validation
6. **Build Check** - Verifies all applications build successfully

### Automated Dependency Management
- **Dependabot** runs weekly to update dependencies
- **Security updates** are prioritized
- **Grouped updates** for related packages (Flask, MUI, etc.)
- **Staggered schedules** to distribute PR load across weekdays

### When CI/CD Fails:
1. Check the specific job that failed in GitHub Actions
2. Run the same check locally (`npm test`, `npm run lint`, etc.)
3. Fix the issue
4. Commit and push (CI/CD will re-run automatically)
5. Never merge PRs with failing CI/CD checks

## For LLM Agents

### When Adding New Code
1. **Identify the right bead** - Determine which bead the code belongs to
2. **Check dependencies** - Review beads.yaml for dependencies
3. **Follow conventions** - Use existing code style and patterns
4. **Add tests** - Write tests alongside new code (aim for 80%+ coverage)
5. **Update documentation** - Keep README.md and docstrings current
6. **Check secrets** - Use keystore, never hardcode credentials
7. **Run linters** - Ensure code passes Black/Prettier/ESLint
8. **Verify CI/CD** - Make sure all checks pass

### When Modifying Existing Code
1. **Understand the bead** - Read the bead's documentation
2. **Run existing tests** - Ensure tests pass before changes
3. **Make minimal changes** - Keep modifications focused
4. **Preserve behavior** - Don't break existing functionality
5. **Update tests** - Modify tests to reflect changes
6. **Re-run tests** - Verify changes don't break anything
7. **Check dependencies** - Ensure you're not breaking dependent beads
8. **Update docs** - Keep documentation in sync with code

### When Creating Documentation
1. **Determine type**:
   - Temporary/completion notice → Don't create it
   - User-facing guide → `docs/` directory
   - App-specific → `apps/app-name/` directory
   - LLM guidelines → Update this file (`AGENTS.md`)

2. **Create in correct location**:
   ```bash
   # User-facing documentation
   docs/MY_NEW_GUIDE.md
   
   # App-specific documentation
   apps/my-app/README.md
   apps/my-app/docs/SPECIFIC_FEATURE.md
   ```

3. **Add hot link to README.md**:
   - If it's in `docs/`, add link in the "Documentation" section
   - Use descriptive link text
   - Keep links organized by category

4. **Clean up temporary files**:
   - Remove any temporary .md files from top level
   - Remove completion notices
   - Move user-facing docs to `docs/`

### When Reading Code
1. **Start with README.md** - Understand the purpose and structure
2. **Review docs/** - Check for relevant documentation
3. **Check beads.yaml** - See the high-level work organization
4. **Read tests** - Tests document expected behavior
5. **Follow imports** - Understand dependencies
6. **Check for TODOs** - Look for known issues or improvements
7. **Review CI/CD logs** - See what automated checks run

## Repository Maintenance Rules

### Documentation Maintenance (CRITICAL)
1. **Never leave temporary .md files** at the top level
2. **All user-facing docs** must be in `docs/` directory
3. **Keep README.md updated** with hot links to all documentation
4. **Remove completion notices** after work is done
5. **Update AGENTS.md** when changing development patterns

### Dependency Management
1. **Review Dependabot PRs** regularly (they come weekly)
2. **Merge security updates** immediately
3. **Test major version bumps** before merging
4. **Close superseded PRs** if newer versions available
5. **GitHub Actions updates** may need manual merge (workflow scope)

### Code Quality
1. **Run tests before committing** (`npm test` or `pytest`)
2. **Run linters** (`npm run lint` for JS/TS, `black` for Python)
3. **Check CI/CD status** before merging PRs
4. **Fix all failing checks** - never merge failing CI/CD
5. **Maintain 80%+ test coverage**

### Security Best Practices
1. **Never commit secrets** to the repository
2. **Use keystore** for all credentials
3. **Set production encryption key** (`KEYSTORE_ENCRYPTION_KEY`)
4. **Review security scan results** in GitHub Security tab
5. **Update dependencies** to patch vulnerabilities

### Beads Pattern
1. **Each app must have beads.yaml** defining work units
2. **Beads should be independent** where possible (for parallelism)
3. **Define dependencies explicitly** in beads.yaml
4. **Test beads independently** with their own test suites
5. **Validate beads config** with `python validate_beads.py`

## Key Principles

1. **Modularity** - Code should be organized into small, focused modules
2. **Testability** - Every unit of code should be testable
3. **Documentation** - Code should be self-documenting with clear names and docs
4. **Type Safety** - Use type hints/types to catch errors early
5. **Consistency** - Follow established patterns throughout the codebase
6. **Simplicity** - Prefer simple solutions over clever ones
7. **Security First** - Never commit secrets, always use keystore
8. **CI/CD Compliance** - All checks must pass before merging
9. **Documentation Discipline** - Keep docs organized and current

## Common Tasks Quick Reference

### Adding a New Application
```bash
mkdir -p apps/my-app/src
cd apps/my-app
# Create package.json, beads.yaml, README.md
# Add to root README.md documentation section
```

### Managing Secrets
```bash
npm run keystore set my-app API_KEY "secret-value"
npm run keystore get my-app API_KEY
npm run keystore list my-app
```

### Running Tests
```bash
# All tests
npm test

# Specific app
cd apps/my-app && npm test
cd apps/my-app && pytest

# With coverage
pytest --cov=src --cov-report=html
npm test -- --coverage
```

### CI/CD Commands
```bash
python validate_beads.py          # Validate beads configuration
npm run lint                       # Lint all code
npm run check:contrast             # Check accessibility
npm test                           # Run all tests
```

### Documentation Updates
```bash
# Add new user-facing doc
vim docs/MY_NEW_GUIDE.md
# Update README.md with hot link to docs/MY_NEW_GUIDE.md

# Clean up temporary files
rm TEMPORARY_*.md INTEGRATION_COMPLETE*.md
git status  # Verify only proper files remain
```

## Questions?

For questions about this monorepo structure or conventions, please:
1. Check existing code for examples
2. Review the [CONTRIBUTING.md](CONTRIBUTING.md) guide
3. Check [documentation in docs/](docs/)
4. Open a GitHub issue for clarification
