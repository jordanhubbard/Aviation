# syntax=docker/dockerfile:1.4

# Build arguments
ARG PYTHON_VERSION=3.11
ARG BUILDKIT_INLINE_CACHE=1

# Base stage with Python
FROM python:${PYTHON_VERSION}-slim AS base
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV PYTHONPATH=/app \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Create necessary directories
RUN mkdir -p instance uploads static/photos logs

# Copy requirements first for better caching
COPY apps/flightschool/requirements.txt .

# Development stage
FROM base AS development

# Install all dependencies (including dev dependencies)
RUN pip install -r requirements.txt

# Copy application code
COPY apps/flightschool/ .

# Set Flask environment variables
ENV FLASK_APP=app \
    FLASK_ENV=development \
    FLASK_DEBUG=1

# Expose port
EXPOSE 5000

# Set healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/')" || exit 1

# Start Flask development server
CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]

# Testing stage
FROM development AS testing

# Set testing environment variables
ENV FLASK_ENV=testing \
    FLASK_DEBUG=0

# Default command for testing
CMD ["pytest", "tests/", "-v", "--tb=short"]

# Production stage
FROM base AS production

# Install only production dependencies
RUN pip install -r requirements.txt

# Copy application code
COPY apps/flightschool/app ./app
COPY apps/flightschool/config.py apps/flightschool/app_secrets.py ./
COPY apps/flightschool/static ./static
COPY apps/flightschool/migrations ./migrations

# Set Flask environment variables for production
ENV FLASK_APP=app \
    FLASK_ENV=production \
    FLASK_DEBUG=0

# Expose port
EXPOSE 5000

# Set healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/')" || exit 1

# Use gunicorn for production
RUN pip install gunicorn

# Start with gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--timeout", "60", "app:create_app()"]
