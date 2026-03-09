FROM python:3.11-slim

WORKDIR /app

# Copy package files
COPY packages/flight-dynamics/ .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Run the service
CMD ["uvicorn", "aviation_flight_dynamics.service:app", "--host", "0.0.0.0", "--port", "8000"]
