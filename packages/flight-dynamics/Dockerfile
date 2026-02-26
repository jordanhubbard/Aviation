FROM python:3.11-slim

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir -r requirements.txt

CMD ["uvicorn", "aviation_flight_dynamics.service:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
