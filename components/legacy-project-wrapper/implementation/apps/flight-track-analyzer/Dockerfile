FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    AVIATION_AIRPORTS_DATA=/opt/aviation/airports_cache.json \
    KMLAB_DATA_DIR=/var/lib/kmlab
WORKDIR /app

COPY apps/flight-track-analyzer/app/requirements.txt ./requirements.txt
COPY packages/shared-sdk/python /tmp/shared-sdk-python
COPY packages/flight-dynamics /tmp/flight-dynamics
RUN python -m pip install --no-cache-dir -r requirements.txt /tmp/shared-sdk-python /tmp/flight-dynamics
COPY apps/flight-track-analyzer/app/ ./
COPY packages/shared-sdk/data/airports_cache.json /opt/aviation/airports_cache.json

RUN groupadd --system kmlab && useradd --system --gid kmlab --home /var/lib/kmlab kmlab \
    && mkdir -p /var/lib/kmlab && chown kmlab:kmlab /var/lib/kmlab
USER kmlab
EXPOSE 8000
CMD ["python", "run.py", "--host", "0.0.0.0", "--port", "8000"]
