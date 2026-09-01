ARG PYTHON_VERSION=3.11
FROM python:${PYTHON_VERSION}-slim AS base

WORKDIR /app

COPY apps/flightschool/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/flightschool/ .
COPY packages/shared-sdk/python /packages/shared-sdk/python
RUN pip install --no-cache-dir -e /packages/shared-sdk/python

FROM base AS development
CMD ["flask", "--app", "app:create_app", "run", "--host", "0.0.0.0", "--port", "5000", "--debug"]

FROM base AS testing
RUN pip install --no-cache-dir pytest pytest-cov
CMD ["pytest", "tests/", "-v", "--tb=short"]

FROM base AS production
CMD ["flask", "--app", "app:create_app", "run", "--host", "0.0.0.0", "--port", "5000"]
