# Contributing to Aviation Monorepo

Thank you for your interest in contributing! This document provides guidelines for contributing to the Aviation monorepo.

## Getting Started

### Repository Structure

This is a monorepo containing aviation-related applications and SDKs:

- **apps/** - Complete applications (web apps, CLIs, etc.)
- **packages/** - Shared libraries and SDKs
- **AGENTS.md** - Guidelines for LLM agents and automated tools
- **README.md** - Repository overview

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/jordanhubbard/Aviation.git
   cd Aviation
   ```

2. **Set up the application you want to work on**
   ```bash
   cd apps/<app-name>
   # Follow the app's README.md for specific setup instructions
   ```

## Code Style

### Python

We use Black for formatting and follow PEP 8 conventions:

- **Formatter**: Black (line length: 88)
- **Type hints**: Required for all function signatures
- **Docstrings**: Required for all public functions and classes
- **Import order**: Use isort with Black profile

Example:
```python
from typing import List, Optional

def process_flight_data(data: List[dict], validate: bool = True) -> Optional[dict]:
    """Process flight data from CSV import.
    
    Args:
        data: List of flight records as dictionaries
        validate: Whether to validate the data
        
    Returns:
        Processed flight data or None if validation fails
    """
    # Implementation
    pass
```

### TypeScript/JavaScript

We use ESLint and Prettier:

- **Formatter**: Prettier
- **Linting**: ESLint with TypeScript strict mode
- **React**: Functional components with hooks
- **Exports**: Named exports preferred over default exports
- **Indentation**: 2 spaces

Example:
```typescript
interface FlightData {
  date: string;
  aircraft: string;
  duration: number;
}

export const processFlightData = (data: FlightData[]): number => {
  return data.reduce((total, flight) => total + flight.duration, 0);
};
```

### Documentation

- Every app/package must have a comprehensive README.md
- Use clear, concise language
- Include code examples where helpful
- Keep documentation up-to-date with code changes

## Work Organization with Beads

This monorepo uses the **beads pattern** for organizing work:

### What are Beads?

Beads are independent, composable units of work that enable:
- **Parallel execution** - Multiple beads can run simultaneously
- **Independent testing** - Each bead has its own test suite  
- **Team collaboration** - Different teams can work on different beads
- **Clear dependencies** - Bead relationships are explicit

### Creating a New Bead

1. **Define the bead** in `beads.yaml`:
   ```yaml
   beads:
     - name: my-new-bead
       description: Brief description of what this bead does
       dependencies: [other-bead-name]  # Optional
       parallel: true  # Can run in parallel with other beads
   ```

2. **Create the bead directory**:
   ```bash
   mkdir -p beads/my-new-bead
   cd beads/my-new-bead
   ```

3. **Implement the bead**:
   ```python
   # beads/my-new-bead/__init__.py
   """My New Bead - Brief description."""
   
   from typing import Any
   
   def execute(input_data: Any) -> Any:
       """Execute this bead's logic."""
       # Implementation
       pass
   ```

4. **Add tests**:
   ```python
   # beads/my-new-bead/tests/test_my_new_bead.py
   import pytest
   from beads.my_new_bead import execute
   
   def test_execute():
       result = execute(test_input)
       assert result == expected_output
   ```

### Bead Dependencies

- Beads with no dependencies can run in parallel
- Beads with dependencies run after their dependencies complete
- Circular dependencies are not allowed
- Keep dependencies minimal for maximum parallelism

## Testing

### Writing Tests

- Aim for 80%+ code coverage
- Write unit tests for individual functions
- Write integration tests for multi-bead workflows
- Make tests fast and deterministic
- Use descriptive test names

### Running Tests

```bash
# Python tests
pytest

# With coverage
pytest --cov=src --cov-report=html

# JavaScript/TypeScript tests
npm test

# With coverage
npm test -- --coverage
```

## Git Workflow

### Branch Naming

- Features: `feature/short-description`
- Bug fixes: `fix/short-description`
- Documentation: `docs/short-description`
- Refactoring: `refactor/short-description`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(foreflight-dashboard): add ICAO aircraft validation

Implement ICAO aircraft code validation with fuzzy matching
for typos and suggestions for invalid codes.

Closes #123
```

```
fix(csv-import): handle missing time fields

Previously would crash on CSV files with missing duration fields.
Now handles gracefully with appropriate error message.
```

### Pull Requests

1. **Fork and branch** - Create a feature branch from `main`
2. **Make changes** - Follow code style and add tests
3. **Test locally** - Ensure all tests pass
4. **Commit** - Use conventional commit messages
5. **Push** - Push to your fork
6. **Open PR** - Create pull request with clear description
7. **Review** - Address any review feedback
8. **Merge** - PR will be merged after approval

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] All tests passing
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
```

## Code Review

### For Reviewers

- Be constructive and respectful
- Explain reasoning for requested changes
- Approve when satisfied or request changes
- Check for:
  - Code style compliance
  - Test coverage
  - Documentation updates
  - Breaking changes
  - Security concerns

### For Authors

- Respond to all feedback
- Make requested changes or discuss alternatives
- Re-request review after changes
- Keep PRs focused and reasonably sized
- Write clear PR descriptions

## Building and Deployment

### Docker

Most applications use Docker for deployment:

```bash
cd apps/<app-name>

# Build
docker-compose build

# Run
docker-compose up

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Production Deployment

See individual application README files for deployment instructions. Common platforms:
- Railway.app
- DigitalOcean App Platform
- AWS ECS/Fargate
- Google Cloud Run
- Azure Container Instances

## Questions or Issues?

- **Found a bug?** Open an issue with reproduction steps
- **Have a question?** Check existing issues or open a new one
- **Want to contribute?** Open an issue to discuss before starting large changes
- **Need help?** Reach out in the issue comments

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
