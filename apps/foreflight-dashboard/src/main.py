"""
ForeFlight Dashboard - Modern FastAPI Application
Replaces the old Flask application with a clean, modern architecture.
"""

import os
import logging.handlers
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any, Annotated
import tempfile
import shutil
import traceback
from collections import defaultdict
from copy import deepcopy
from functools import lru_cache
import html

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Request, Response, status, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.exceptions import RequestValidationError
from fastapi.templating import Jinja2Templates
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, ValidationError
import uvicorn
from contextlib import nullcontext
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Database imports
from sqlalchemy.orm import Session

# Application imports
from src.core.models import LogbookEntry, Aircraft, Airport, FlightConditions, RunningTotals
# Removed authentication system - now stateless session-based application
from src.services.foreflight_client import ForeFlightClient
from src.services.importer import ForeFlightImporter
from src.core.validation import validate_csv

# Configure logging
os.makedirs('logs', exist_ok=True)
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.handlers.RotatingFileHandler(
            'logs/foreflight.log',
            maxBytes=1024*1024,  # 1MB
            backupCount=5,
            encoding='utf-8'
        ),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="ForeFlight Dashboard API",
    description="""
    ## ForeFlight Dashboard API
    
    A comprehensive API for managing ForeFlight logbook data, user authentication, and flight statistics.
    
    ### Features
    - **User Authentication**: JWT-based authentication system
    - **Logbook Management**: Upload and process ForeFlight CSV logbooks
    - **Flight Statistics**: Calculate flight time statistics and currency
    - **Aircraft Analytics**: Track time by aircraft and type
    - **Student Pilot Support**: Endorsement tracking and validation
    
    ### Authentication
    Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:
    ```
    Authorization: Bearer <your-jwt-token>
    ```
    
    ### File Uploads
    Logbook files should be in ForeFlight CSV format. The system supports:
    - Flight entries with aircraft, route, and time information
    - Running totals calculation
    - Data validation and error reporting
    
    ### Data Models
    The API uses comprehensive Pydantic models with validation for:
    - Flight entries with time constraints
    - Aircraft information
    - User profiles and preferences
    - Statistical calculations
    """,
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    contact={
        "name": "ForeFlight Dashboard Support",
        "url": "https://github.com/jordanhubbard/foreflight-dashboard",
    },
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT",
    },
)

# CORS middleware - allow all origins for simplified stateless application
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    # Content Security Policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' https://codecov.io;"
    )
    # HTTP Strict Transport Security
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # X-Frame-Options
    response.headers["X-Frame-Options"] = "DENY"
    # X-Content-Type-Options
    response.headers["X-Content-Type-Options"] = "nosniff"
    # X-XSS-Protection
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Referrer-Policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Permissions-Policy
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Database is now configured in src.core.database

# Create upload directory
upload_dir = Path("uploads")
upload_dir.mkdir(exist_ok=True)

# Mount static files for React build
static_path = Path(__file__).parent / "static"
static_path.mkdir(exist_ok=True)

# Mount the dist directory directly for React assets
dist_path = static_path / "dist"
if dist_path.exists():
    app.mount("/assets", StaticFiles(directory=str(dist_path / "assets")), name="assets")
    
# Mount general static files
app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

# Templates for any server-side rendering needed
templates_path = Path(__file__).parent / "templates"
templates = Jinja2Templates(directory=str(templates_path))

# Security utilities
def sanitize_input(text: str) -> str:
    """Sanitize user input to prevent XSS attacks."""
    if not text:
        return ""
    return html.escape(text.strip())

# Pydantic models for API
# Removed authentication-related Pydantic models - now stateless

# Removed authentication dependencies - now stateless

# Exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Don't include body in response as it may contain non-serializable data like FormData
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# Utility functions
def convert_entries_to_template_data(entries: List[LogbookEntry]) -> List[Dict]:
    """Convert LogbookEntry objects to template-friendly dictionaries."""
    template_data = []
    for entry in entries:
        entry_dict = {
            'date': entry.date.isoformat(),
            'aircraft': entry.aircraft.to_dict(),
            'departure': {
                'identifier': entry.departure.identifier if entry.departure else None
            },
            'destination': {
                'identifier': entry.destination.identifier if entry.destination else None
            },
            'route': f"{entry.departure.identifier if entry.departure else '---'} → {entry.destination.identifier if entry.destination else '---'}",
            'total_time': float(entry.total_time),
            'pic_time': float(entry.pic_time),
            'dual_received': float(entry.dual_received),
            'solo_time': float(entry.solo_time) if entry.solo_time else 0.0,
            'ground_training': float(entry.ground_training) if entry.ground_training else 0.0,
            'night_time': float(entry.conditions.night) if entry.conditions else 0.0,
            'conditions': {
                'day': float(entry.conditions.day),
                'night': float(entry.conditions.night),
                'cross_country': float(entry.conditions.cross_country),
                'simulated_instrument': float(entry.conditions.simulated_instrument),
                'actual_instrument': float(entry.conditions.actual_instrument)
            },
            'landings_day': entry.landings_day,
            'landings_night': entry.landings_night,
            'pilot_role': entry.pilot_role,
            'remarks': entry.remarks,
            'running_totals': {
                'total_time': float(entry.running_totals.total_time) if entry.running_totals else 0.0,
                'pic_time': float(entry.running_totals.pic_time) if entry.running_totals else 0.0,
                'dual_received': float(entry.running_totals.dual_received) if entry.running_totals else 0.0,
                'cross_country': float(entry.running_totals.cross_country) if entry.running_totals else 0.0,
                'day_time': float(entry.running_totals.day_time) if entry.running_totals else 0.0,
                'night_time': float(entry.running_totals.night_time) if entry.running_totals else 0.0,
                'sim_instrument': float(entry.running_totals.sim_instrument) if entry.running_totals else 0.0,
                'asel_time': float(entry.running_totals.asel_time) if entry.running_totals else 0.0,
                'ground_training': float(entry.running_totals.ground_training) if entry.running_totals else 0.0
            },
            'error_explanation': getattr(entry, 'error_explanation', None),
            'warning_explanation': getattr(entry, 'warning_explanation', None)
        }
        template_data.append(entry_dict)
    
    return template_data

def calculate_running_totals(entries: List[LogbookEntry]) -> List[LogbookEntry]:
    """Calculate running totals for entries."""
    # Sort entries by date
    sorted_entries = sorted(entries, key=lambda x: x.date)
    
    # Initialize running totals
    running_totals = RunningTotals()
    
    for entry in sorted_entries:
        # Update running totals
        running_totals.total_time += entry.total_time
        running_totals.pic_time += entry.pic_time
        running_totals.dual_received += entry.dual_received
        running_totals.cross_country += entry.conditions.cross_country
        running_totals.day_time += entry.conditions.day
        running_totals.night_time += entry.conditions.night
        running_totals.sim_instrument += entry.conditions.simulated_instrument + entry.conditions.actual_instrument
        
        # Aircraft category specific totals
        if 'ASEL' in entry.aircraft.category_class:
            running_totals.asel_time += entry.total_time
        
        # Assign running totals to entry (create copy to avoid reference issues)
        entry.running_totals = deepcopy(running_totals)
    
    return sorted_entries

@lru_cache(maxsize=128)
def calculate_stats_for_entries_cached(entries_hash: str, entries_count: int) -> Dict:
    """Calculate statistics for a list of entries (cached version)."""
    # This is a cached wrapper - the actual calculation is done by calculate_stats_for_entries
    pass

def calculate_stats_for_entries(entries: List[LogbookEntry]) -> Dict:
    """Calculate statistics for a list of entries."""
    if not entries:
        return {
            'total_time': 0.0,
            'total_hours': 0.0,  # Alias for frontend compatibility
            'total_pic': 0.0,
            'total_dual': 0.0,
            'total_night': 0.0,
            'total_cross_country': 0.0,
            'total_sim_instrument': 0.0,
            'total_landings': 0,
            'total_time_asel': 0.0,
            'total_time_tailwheel': 0.0,
            'total_time_complex': 0.0,
            'total_time_high_performance': 0.0
        }
    
    return {
        'total_time': sum(float(e.total_time) for e in entries),
        'total_hours': sum(float(e.total_time) for e in entries),  # Alias for frontend compatibility
        'total_pic': sum(float(e.pic_time) for e in entries),
        'total_dual': sum(float(e.dual_received) for e in entries),
        'total_night': sum(float(e.conditions.night) for e in entries),
        'total_cross_country': sum(float(e.conditions.cross_country) for e in entries),
        'total_sim_instrument': sum(float(e.conditions.simulated_instrument + e.conditions.actual_instrument) for e in entries),
        'total_landings': sum(e.landings_day + e.landings_night for e in entries),
        'total_time_asel': sum(float(e.total_time) for e in entries if 'ASEL' in e.aircraft.category_class),
        'total_time_tailwheel': 0.0,  # TODO: Implement tailwheel detection
        'total_time_complex': 0.0,    # TODO: Implement complex aircraft detection
        'total_time_high_performance': 0.0  # TODO: Implement high performance detection
    }

# Authentication Routes

# Removed all authentication endpoints - now stateless application

# Main Routes

@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the React application."""
    # In development mode, return API info instead of serving React
    if os.environ.get('ENVIRONMENT') == 'development':
        return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>ForeFlight Dashboard API - Development Mode</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }}
                .container {{ background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
                .api-link {{ display: inline-block; margin: 10px 0; padding: 10px 15px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }}
                .api-link:hover {{ background: #0056b3; }}
                .dev-info {{ background: #e7f3ff; padding: 15px; border-radius: 4px; margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 ForeFlight Dashboard API</h1>
                <div class="dev-info">
                    <strong>Development Mode Active</strong><br>
                    FastAPI backend running on port 5051<br>
                    React dev server running on port 3001
                </div>
                <h2>API Documentation</h2>
                <a href="/docs" class="api-link">📚 Interactive API Docs (Swagger)</a><br>
                <a href="/redoc" class="api-link">📖 ReDoc Documentation</a><br>
                <a href="/health" class="api-link">❤️ Health Check</a>
                
                <h2>Frontend Application</h2>
                <a href="http://localhost:3001" class="api-link">🎨 React Frontend (Port 3001)</a>
                
                <h2>Quick Test</h2>
                <p>Test authentication: <code>POST /api/auth/login</code></p>
                <p>Default admin: admin@foreflight-dashboard.com / admin123</p>
            </div>
        </body>
        </html>
        """)
    
    # Production mode: serve built React app
    try:
        index_file = static_path / "dist" / "index.html"
        if index_file.exists():
            with open(index_file, 'r', encoding='utf-8') as f:
                content = f.read()
            return HTMLResponse(content=content)
        else:
            logger.warning(f"React build not found at {index_file}")
            return HTMLResponse(content=f"""
            <!DOCTYPE html>
            <html>
            <head>
                <title>ForeFlight Dashboard</title>
            </head>
            <body>
                <h1>ForeFlight Dashboard</h1>
                <p>React build not found at: <code>{index_file}</code></p>
                <p>Please build the frontend:</p>
                <pre>cd frontend && npm run build</pre>
            </body>
            </html>
            """)
    except Exception as e:
        logger.error(f"Error serving root: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Health check (must be before catch-all route)
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# API Routes - Simplified Stateless Application

@app.post("/api/process-logbook")
@limiter.limit("10/minute")  # Rate limit: 10 uploads per minute per IP
async def process_logbook(
    request: Request,
    file: UploadFile = File(...),
    student_pilot: bool = Form(False)
):
    """Process logbook file and return dashboard data directly (no persistence)."""
    try:
        # Validate file type
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="Only CSV files are supported")
        
        # Create temporary file
        import tempfile
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_filepath = temp_file.name
        
        try:
            # Validate CSV format
            validate_csv(temp_filepath)
            
            # Process logbook data
            importer = ForeFlightImporter(temp_filepath)
            entries_objects = importer.get_flight_entries()
            aircraft_objects = importer.get_aircraft_list()
            
            # Calculate running totals
            entries_objects = calculate_running_totals(entries_objects)
            
            # Validate all entries for errors
            for entry in entries_objects:
                entry.validate_entry()
            
            # Calculate statistics (use UTC to avoid timezone issues)
            now_utc = datetime.now(timezone.utc)
            current_year_entries = [e for e in entries_objects if e.date.year == now_utc.year]
            thirty_days_ago = now_utc.date() - timedelta(days=30)
            recent_entries = [
                e for e in entries_objects 
                if e.date.date() >= thirty_days_ago
            ]
            
            stats = calculate_stats_for_entries(current_year_entries)
            all_time = calculate_stats_for_entries(entries_objects)
            recent_experience = calculate_stats_for_entries(recent_entries)
            
            # Convert to template data
            entries = convert_entries_to_template_data(entries_objects)
            
            return {
                "entries": entries,
                "stats": stats,
                "all_time": all_time,
                "recent_experience": recent_experience,
                "aircraft_stats": [],  # TODO: Implement aircraft stats
                "logbook_filename": file.filename,
                "error_count": 0,
                "student_pilot": student_pilot
            }
            
        finally:
            # Clean up temporary file
            import os
            os.unlink(temp_filepath)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing logbook: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

# API Documentation routes
@app.get("/docs", response_class=HTMLResponse)
async def api_docs_redirect():
    """Redirect to API documentation."""
    return RedirectResponse(url="/api/docs", status_code=302)

@app.get("/api-docs", response_class=HTMLResponse) 
async def api_docs_alt():
    """Alternative API documentation endpoint."""
    return RedirectResponse(url="/api/docs", status_code=302)

# Catch-all route for React SPA (must be last!)
@app.get("/{path:path}", response_class=HTMLResponse)
async def serve_spa(path: str):
    """Serve React SPA for all routes (client-side routing)."""
    # Don't serve SPA for API routes - let them return proper 404
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    
    return await root()

# Initialize database on startup
# Removed database initialization - now stateless application

if __name__ == "__main__":
    port = int(os.environ.get("PORT") or os.environ.get("FASTAPI_PORT") or 5051)
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="debug"
    )
