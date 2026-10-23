FROM node:24-alpine

WORKDIR /app
RUN corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile --filter @aviation/aviation-chat...
RUN pnpm --filter @aviation/aviation-chat... run build

ENV NODE_ENV=production PORT=31416 APPS_ROOT=/app/apps
EXPOSE 31416
CMD ["node", "apps/aviation-chat/dist/index.js"]
