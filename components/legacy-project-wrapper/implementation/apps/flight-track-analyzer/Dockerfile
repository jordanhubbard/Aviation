FROM node:24-bookworm-slim AS explanation-build
WORKDIR /build
RUN corepack enable pnpm
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile --filter @aviation/ai-explainer...
RUN pnpm --filter @aviation/ai-explainer... run build
RUN pnpm --config.node-linker=hoisted --filter @aviation/ai-explainer deploy --legacy --prod /runtime/explanation

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 libatomic1 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=explanation-build /usr/local/bin/node /usr/local/bin/node
COPY --from=explanation-build /runtime/explanation /opt/aviation/explanation
ENV AVIATION_KEYSTORE_BRIDGE=/opt/aviation/explanation/node_modules/@aviation/keystore/dist/bridge.js

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
ENTRYPOINT ["node", "/opt/aviation/explanation/dist/run.js", "--app", "flight-track-analyzer", "--"]
CMD ["python", "run.py", "--host", "0.0.0.0", "--port", "8000"]
