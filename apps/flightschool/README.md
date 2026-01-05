# Tailwheel Addicts Aviation Flight School Management System

A Flask-based web application for managing a flight school's operations, including student registration, aircraft and instructor management, booking system, and administrative functions.

# Quick start
- make demo
- log in as student@example.com / student123
  - This username and password comes from tests/test_data.json - see this file
  for admin user credentials as well as pre-loaded aircraft types and other data

## Features

- User Management
  - Student registration and authentication
  - Instructor management with certification tracking
  - Role-based access control (Admin, Instructor, Student)
- Booking System
  - Aircraft and instructor scheduling
  - Interactive calendar with real-time availability
  - Current time display on booking page
  - Color-coded blocks for aircraft and instructor conflicts
  - Conflict prevention for bookings
- Aircraft Management
  - Aircraft registration and status tracking
  - Maintenance status updates
- Administrative Dashboard
  - Resource management interface
  - User status monitoring
  - Booking oversight
- Modern UI/UX
  - Responsive Bootstrap-based design
  - Interactive calendar interface
  - Status indicators and notifications
  - Real-time feedback for booking conflicts
  - Dynamic updates based on selected aircraft/instructor

## Project Structure

```
flightschool/
├── app/
│   ├── __init__.py          # Application factory and extensions
│   ├── models/              # Database models
│   ├── routes/              # Route handlers
│   │   ├── admin.py        # Admin dashboard routes
│   │   ├── auth.py         # Authentication routes
│   │   ├── booking.py      # Booking system routes
│   │   └── main.py         # Main application routes
│   ├── templates/          # Jinja2 templates
│   │   ├── admin/         # Admin interface templates
│   │   ├── auth/          # Authentication templates
│   │   ├── booking/       # Booking system templates
│   │   └── base.html      # Base template
│   └── static/            # Static assets
├── tests/                  # Test suite
│   ├── test_admin.py      # Admin functionality tests
│   ├── test_auth.py       # Authentication tests
│   ├── test_booking.py    # Booking system tests
│   └── test_frontend.py   # UI/Frontend tests
├── migrations/             # Database migrations
├── scripts/               # Utility scripts
├── Makefile              # Build and management commands
├── config.py             # Configuration settings
├── requirements.txt      # Python dependencies
└── run.py               # Application entry point
```

## Setup Instructions

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd flightschool
   ```

2. Set up the environment and install dependencies:
   ```bash
   make init
   ```
   This will:
   - Create a virtual environment
   - Install required packages
   - Initialize the database
   - Create necessary tables

3. Create a `.env` file with the following variables:
   ```
   FLASK_APP=run.py
   FLASK_ENV=development
   SECRET_KEY=your-secret-key
   DATABASE_URL=sqlite:///flightschool.db
   ```

## Available Make Commands

- `make init` - Initialize the project (create venv, install deps, setup db)
- `make run` - Start the development server
- `make test` - Run the full test suite
- `make clean` - Remove temporary files and virtual environment
- `make db-init` - Initialize a new database
- `make db-migrate` - Generate database migrations
- `make db-upgrade` - Apply database migrations

## Running the Application

1. Start the development server:
   ```bash
   make run
   ```
   The application will be available at `http://localhost:5000`
   - Or at `http://localhost:5001` if configured for alternate port

2. Default admin credentials:
   - Email: admin@example.com
   - Password: admin123
   - You can log in as a student or instructor using the test data accounts in `tests/test_data.json`.

## Testing

Run the complete test suite:
```bash
make test
```

Run specific test categories:
```bash
# Run frontend tests only
make test-frontend

# Run admin functionality tests
make test-admin

# Run booking system tests
make test-booking
```

## Frontend Smoke Testing

To verify that all major endpoints are up and responding (and that there are no server-side errors or backtraces), use the frontend smoke test workflow:

1. **Start the application in demo mode:**
   ```bash
   make demo
   ```
   This will initialize the database with test data and run the app.

2. **In a separate terminal, run the frontend smoke tests:**
   ```bash
   make frontend-test
   ```
   This will send HTTP requests to all major endpoints and verify:
   - The endpoint responds with a 2xx or 3xx status code
   - The response does not contain a Python traceback or Flask error page

You can add or adjust endpoints in `tests/frontend_smoke_test.py` as your app evolves.

## Development Guidelines

1. Code Style
   - Follow PEP 8 style guide
   - Use meaningful variable and function names
   - Include docstrings for functions and classes
   - Keep functions focused and single-purpose

2. Testing
   - Write tests for new features
   - Ensure all tests pass before committing
   - Include both unit and integration tests
   - Test edge cases and error conditions

3. Git Workflow
   - Create feature branches for new development
   - Write clear, descriptive commit messages
   - Keep commits focused and atomic
   - Test before merging to main branch

4. Adding New Features
   - Update database models in `app/models/`
   - Add new routes in appropriate route module
   - Create/update templates in `app/templates/`
   - Add corresponding tests in `tests/`
   - Update documentation as needed

## Application Behavior Notes

- The booking calendar visually displays all aircraft and instructor conflicts for the selected week.
- Aircraft conflicts are shown in red, instructor conflicts in blue.
- The current UTC time is always displayed above the calendar widget.
- All bookings are validated to prevent double-booking of aircraft or instructors.
- The test data loader (`scripts/load_test_data.py`) automatically converts date fields and ensures consistency with the models.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add/update tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
