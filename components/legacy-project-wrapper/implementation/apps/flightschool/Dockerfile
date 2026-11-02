ARG PYTHON_VERSION=3.11
FROM node:24-bookworm-slim AS explanation-build
WORKDIR /build
RUN corepack enable pnpm
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile --filter @aviation/ai-explainer...
RUN pnpm --filter @aviation/ai-explainer... run build
RUN pnpm --config.node-linker=hoisted --filter @aviation/ai-explainer deploy --legacy --prod /runtime/explanation

FROM python:${PYTHON_VERSION}-slim AS base

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 libatomic1 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=explanation-build /usr/local/bin/node /usr/local/bin/node
COPY --from=explanation-build /runtime/explanation /opt/aviation/explanation
ENV AVIATION_KEYSTORE_BRIDGE=/opt/aviation/explanation/node_modules/@aviation/keystore/dist/bridge.js \
    KEYSTORE_PATH=/data/.keystore
ENTRYPOINT ["node", "/opt/aviation/explanation/dist/run.js", "--app", "flightschool", "--"]

COPY apps/flightschool/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/flightschool/ .
COPY packages/shared-sdk/python /packages/shared-sdk/python
RUN pip install --no-cache-dir -e /packages/shared-sdk/python

FROM base AS development
CMD ["flask", "--app", "app:create_app", "run", "--host", "0.0.0.0", "--port", "5000", "--debug"]

FROM base AS testing
ENTRYPOINT []
RUN pip install --no-cache-dir pytest pytest-cov
CMD ["pytest", "tests/", "-v", "--tb=short"]

FROM base AS production
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "app:create_app('production')"]
