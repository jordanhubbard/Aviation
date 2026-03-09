# G1000 Simulator Backend

This is the backend service for the Garmin G1000 Simulator application.

## Services

### Navigation Service

The Navigation Service handles flight plan management, routing, and navigation database access.

#### Key Modules

- **flight_plan.py**: Flight plan CRUD operations
- **nav_database.py**: Navigation database interface
- **routing.py**: Route calculation and optimization
- **procedures.py**: SID/STAR/approach handling
- **geo_calculations.py**: Navigation math utilities

#### API Endpoints

- `POST /api/flight-plan` - Create flight plan
- `GET /api/flight-plan/{id}` - Retrieve flight plan
- `PUT /api/flight-plan/{id}` - Update flight plan
- `DELETE /api/flight-plan/{id}` - Delete flight plan
- `GET /api/nav/search` - Search navigation database
- `GET /api/procedures/{airport}` - Get procedures for airport

## Running the Backend

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Testing

```bash
pytest tests/
```
