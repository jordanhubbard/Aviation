FROM node:24-alpine AS sdk
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared-sdk/package.json packages/shared-sdk/
RUN pnpm install --frozen-lockfile --filter @aviation/shared-sdk...
COPY packages/shared-sdk packages/shared-sdk
RUN pnpm --filter @aviation/shared-sdk run build

FROM nginxinc/nginx-unprivileged:1.25-alpine
COPY apps/preflight-check/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/preflight-check/public /usr/share/nginx/html
COPY --from=sdk /workspace/packages/shared-sdk/dist-esm/aviation/weight-balance.js /usr/share/nginx/html/aviation-sdk/weight-balance.js
COPY --from=sdk /workspace/packages/shared-sdk/dist-esm/aviation/aircraft.js /usr/share/nginx/html/aviation-sdk/aircraft.js
EXPOSE 8080
