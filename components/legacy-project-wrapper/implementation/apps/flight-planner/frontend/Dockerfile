FROM node:20-alpine AS build

WORKDIR /app

# Build context is the repo root. The frontend depends on workspace packages via
# the "workspace:" protocol, which npm cannot resolve (EUNSUPPORTEDPROTOCOL).
RUN corepack enable pnpm

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile --filter flight-planner-frontend...
RUN pnpm --filter flight-planner-frontend... run build


FROM nginx:1.27-alpine AS runtime

ARG REPO_URL=""
ARG GIT_SHA=""

LABEL org.opencontainers.image.source=$REPO_URL \
      org.opencontainers.image.revision=$GIT_SHA

ENV PORT=80 \
    BACKEND_URL=http://backend:8000 \
    BACKEND_HOST=backend \
    BACKEND_PORT=8000

COPY --from=build /app/apps/flight-planner/frontend/dist/ /usr/share/nginx/html/

COPY apps/flight-planner/frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY apps/flight-planner/frontend/docker-entrypoint.d/10-backend-url.sh /docker-entrypoint.d/10-backend-url.sh
COPY apps/flight-planner/frontend/docker-entrypoint.d/99-env.sh /docker-entrypoint.d/99-env.sh
RUN chmod +x /docker-entrypoint.d/10-backend-url.sh /docker-entrypoint.d/99-env.sh

EXPOSE 80
