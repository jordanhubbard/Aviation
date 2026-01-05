FROM node:20-alpine AS build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


FROM nginx:1.27-alpine AS runtime

ARG REPO_URL=""
ARG GIT_SHA=""

LABEL org.opencontainers.image.source=$REPO_URL \
      org.opencontainers.image.revision=$GIT_SHA

ENV PORT=80 \
    BACKEND_URL=http://backend:8000 \
    BACKEND_HOST=backend \
    BACKEND_PORT=8000

COPY --from=build /app/frontend/dist/ /usr/share/nginx/html/

COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY frontend/docker-entrypoint.d/10-backend-url.sh /docker-entrypoint.d/10-backend-url.sh
COPY frontend/docker-entrypoint.d/99-env.sh /docker-entrypoint.d/99-env.sh
RUN chmod +x /docker-entrypoint.d/10-backend-url.sh /docker-entrypoint.d/99-env.sh

EXPOSE 80
