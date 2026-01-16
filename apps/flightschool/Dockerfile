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
ENV PYTHONPATH=/app:/packages/shared-sdk/python \
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
COPY packages/shared-sdk/python /packages/shared-sdk/python

# Set Flask environment variables
ENV FLASK_APP=app \
    FLASK_ENV=development \
    FLASK_DEBUG=1

# Expose port
EXPOSE 5000

# Set healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen('http://localhost:%s/' % os.getenv('PORT','5000'))" || exit 1

# Start Flask development server
CMD ["sh", "-c", "flask run --host=0.0.0.0 --port ${PORT:-5000}"]

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
COPY apps/flightschool/app/static ./static
COPY packages/shared-sdk/python /packages/shared-sdk/python

# Set Flask environment variables for production
ENV FLASK_APP=app \
    FLASK_ENV=production \
    FLASK_DEBUG=0

# Expose port
EXPOSE 5000

# Set healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen('http://localhost:%s/' % os.getenv('PORT','5000'))" || exit 1

# Use gunicorn for production
RUN pip install gunicorn

# Start with gunicorn
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 4 --timeout 60 'app:create_app()'"]
