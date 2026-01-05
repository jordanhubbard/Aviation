# AGENTS.md - LLM-Friendly Repository Guidelines

This document provides guidelines for LLM agents working with this monorepo. It follows best practices for making codebases easy to understand and work with for both humans and AI assistants.

## Repository Structure

This is a monorepo containing multiple aviation-related applications and SDKs:

```
Aviation/
├── apps/                    # Applications
│   └── foreflight-dashboard/  # ForeFlight logbook analysis web app
├── packages/               # Shared packages and SDKs (future)
├── AGENTS.md              # This file - LLM guidelines
├── CONTRIBUTING.md        # Development guidelines
└── README.md              # Repository overview
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
- Every app/package must have a README.md with:
  - Clear description and purpose
  - Setup and installation instructions
  - Usage examples
  - API documentation (if applicable)
  - Testing instructions
- Use **Markdown** for all documentation
- Include **code examples** where helpful

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

## For LLM Agents

### When Adding New Code
1. **Identify the right bead** - Determine which bead the code belongs to
2. **Check dependencies** - Review beads.yaml for dependencies
3. **Follow conventions** - Use existing code style and patterns
4. **Add tests** - Write tests alongside new code
5. **Update documentation** - Keep README.md and docstrings current

### When Modifying Existing Code
1. **Understand the bead** - Read the bead's documentation
2. **Run existing tests** - Ensure tests pass before changes
3. **Make minimal changes** - Keep modifications focused
4. **Preserve behavior** - Don't break existing functionality
5. **Re-run tests** - Verify changes don't break anything

### When Reading Code
1. **Start with README.md** - Understand the purpose first
2. **Review beads.yaml** - See the high-level structure
3. **Read tests** - Tests document expected behavior
4. **Follow imports** - Understand dependencies
5. **Check for TODOs** - Look for known issues or improvements

## Key Principles

1. **Modularity** - Code should be organized into small, focused modules
2. **Testability** - Every unit of code should be testable
3. **Documentation** - Code should be self-documenting with clear names and docs
4. **Type Safety** - Use type hints/types to catch errors early
5. **Consistency** - Follow established patterns throughout the codebase
6. **Simplicity** - Prefer simple solutions over clever ones

## Questions?

For questions about this monorepo structure or conventions, please:
1. Check existing code for examples
2. Review the CONTRIBUTING.md guide
3. Open a GitHub issue for clarification
