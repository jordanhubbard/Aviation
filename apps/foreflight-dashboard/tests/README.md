# ForeFlight Dashboard Test Suite

This directory contains comprehensive tests for the ForeFlight Dashboard application, covering both the React frontend and Python backend APIs.

## Test Structure

```
tests/
├── conftest.py                 # Test fixtures and configuration
├── test_api/                   # API endpoint tests
│   ├── test_fastapi_endpoints.py    # FastAPI route tests
│   ├── test_flask_routes.py         # Flask route tests
│   └── test_authentication.py      # Auth flow tests
├── test_core/                  # Core functionality tests
│   ├── test_models.py              # Data model tests
│   └── test_validation.py          # CSV validation tests
├── test_services/              # Service layer tests
│   ├── test_importer.py            # Import service tests
│   └── test_foreflight_client.py   # Client service tests
└── test_integration/           # End-to-end tests
    └── test_end_to_end.py          # Integration workflows
```

## Test Categories

### Unit Tests (`@pytest.mark.unit`)
- Test individual functions and classes in isolation
- Fast execution (< 1 second each)
- No external dependencies
- Located in `test_core/` and `test_services/`

### API Tests (`@pytest.mark.api`)
- Test HTTP endpoints and API responses
- Mock external dependencies
- Validate request/response formats
- Located in `test_api/`

### Integration Tests (`@pytest.mark.integration`)
- Test complete user workflows
- Test interactions between components
- May use real database (in-memory SQLite)
- Located in `test_integration/`

### Authentication Tests (`@pytest.mark.auth`)
- Test login, logout, registration flows
- Test role-based access control
- Test session management
- Located in `test_api/test_authentication.py`

## Running Tests

### Using Make (Recommended)
```bash
# Run all tests with coverage in Docker
make test

# View results
open htmlcov/index.html
```

### Using Python Test Runner
```bash
# Run all tests
./run_tests.py all

# Run only fast tests
./run_tests.py fast

# Run specific test category
./run_tests.py unit
./run_tests.py api
./run_tests.py integration

# Run specific test file
./run_tests.py --specific tests/test_api/test_fastapi_endpoints.py

# Run with coverage report
./run_tests.py coverage
```

### Using Pytest Directly
```bash
# Install test dependencies
pip install -r requirements.txt

# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific markers
pytest -m "not slow and not integration"
pytest -m "api"
pytest -m "unit"

# Run specific test
pytest tests/test_api/test_fastapi_endpoints.py::TestFastAPIEndpoints::test_upload_logbook_success
```

## Test Coverage Goals

- **Overall Coverage**: 80%+ (enforced)
- **API Endpoints**: 95%+ coverage
- **Core Models**: 90%+ coverage
- **Service Classes**: 85%+ coverage
- **Authentication**: 100% coverage

## Test Fixtures

### Database Fixtures
- `flask_test_client`: Flask test client with in-memory database
- `test_user`: Regular user for testing
- `admin_user`: Admin user with elevated permissions
- `student_user`: Student pilot user
- `authenticated_client`: Pre-authenticated test client

### File Fixtures
- `temp_dir`: Temporary directory for test files
- `sample_csv_content`: Valid ForeFlight CSV data
- `sample_csv_file`: Temporary CSV file with sample data

### Mock Fixtures
- `mock_upload_folder`: Mocked upload directory
- `fastapi_client`: FastAPI test client

## API Endpoint Coverage

### FastAPI Endpoints (`/api/*`)
✅ `GET /` - Serve main page  
✅ `POST /upload` - Upload logbook file  
✅ `GET /entries` - Get logbook entries with filtering  
✅ `POST /entries` - Create new logbook entry  
✅ `PUT /entries/{entry_id}` - Update logbook entry  

### Flask Routes
✅ `GET /` - Main dashboard (login required)  
✅ `POST /upload` - Upload logbook file (Flask version)  
✅ `POST /verify-pic` - Verify PIC requirements  
✅ `POST /filter-flights` - Filter flights with criteria  
✅ `GET /api/user` - Get current user info  
✅ `PUT /api/user` - Update user info  
✅ `GET /api/logbook` - Get user's logbook data  
✅ `POST /api/upload` - Upload logbook via API  
✅ `GET /api/endorsements` - Get user endorsements  
✅ `POST /api/endorsements` - Add endorsement  
✅ `DELETE /api/endorsements/{id}` - Delete endorsement  

### Authentication Routes (Flask-Security)
✅ Login, logout, register flows  
✅ Password reset functionality  
✅ Role-based access control  
✅ Session management  

## Test Data

### Sample CSV Structure
The test suite uses a standardized ForeFlight CSV format:
- Aircraft table with N125CM (Bellanca 7ECA) and N198JJ (American Champion 8KCAB)
- Flight entries with valid dates, times, and airports
- Proper ForeFlight header structure

### User Test Data
- **Regular User**: test@example.com / testpass
- **Admin User**: admin@example.com / adminpass  
- **Student User**: student@example.com / studentpass

## Continuous Integration

### GitHub Actions (if configured)
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run tests
        run: make test
      - name: Upload coverage
        uses: codecov/codecov-action@v1
```

### Coverage Reporting
- HTML reports: `htmlcov/index.html`
- XML reports: `coverage.xml`
- Terminal reports: Shown during test execution

## Writing New Tests

### Test Naming Convention
- Test files: `test_*.py`
- Test classes: `Test*`
- Test methods: `test_*`

### Example Test Structure
```python
import pytest
from unittest.mock import Mock, patch

class TestMyFeature:
    """Test my feature functionality."""
    
    def test_valid_input(self, fixture_name):
        """Test with valid input."""
        # Arrange
        input_data = {"key": "value"}
        
        # Act
        result = my_function(input_data)
        
        # Assert
        assert result.success is True
        assert result.data == expected_data
    
    def test_invalid_input(self):
        """Test with invalid input."""
        with pytest.raises(ValueError):
            my_function(None)
    
    @pytest.mark.slow
    def test_performance(self):
        """Test performance characteristics."""
        # Long-running test
        pass
```

### Mocking Guidelines
- Mock external dependencies (file system, network, database)
- Use `patch` for replacing functions/methods
- Use `Mock` for creating fake objects
- Verify mock calls with `assert_called_with()`

### Assertion Best Practices
- Use specific assertions (`assert x == y` not `assert x`)
- Test both success and failure cases
- Verify error messages and types
- Check side effects (database changes, file creation)

## Troubleshooting

### Common Issues

1. **Import Errors**
   ```bash
   # Add src to Python path
   export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"
   ```

2. **Database Errors**
   ```bash
   # Clean test database
   rm -f test_*.db
   ```

3. **Permission Errors**
   ```bash
   # Fix file permissions
   chmod +x run_tests.py
   ```

4. **Coverage Not Working**
   ```bash
   # Install coverage
   pip install coverage pytest-cov
   ```

### Debug Mode
```bash
# Run with debug output
pytest -v -s --tb=long

# Run single test with debugging
pytest tests/test_api/test_fastapi_endpoints.py::TestFastAPIEndpoints::test_upload_logbook_success -v -s
```

## Performance Testing

### Benchmarking
```bash
# Run performance tests
pytest -m slow --durations=0

# Profile test execution
pytest --profile
```

### Load Testing
For API load testing, consider using:
- `locust` for HTTP load testing
- `pytest-benchmark` for function benchmarking
- `memory_profiler` for memory usage analysis

## Contributing

When adding new features:

1. **Write tests first** (TDD approach)
2. **Aim for high coverage** (80%+ for new code)
3. **Test edge cases** and error conditions
4. **Use appropriate markers** (`@pytest.mark.slow`, etc.)
5. **Update this documentation** if adding new test categories

### Test Review Checklist

- [ ] Tests cover happy path and edge cases
- [ ] Error conditions are tested
- [ ] Mocks are used appropriately
- [ ] Tests are fast (< 1s for unit tests)
- [ ] Tests are deterministic (no random failures)
- [ ] Test names are descriptive
- [ ] Coverage meets requirements
