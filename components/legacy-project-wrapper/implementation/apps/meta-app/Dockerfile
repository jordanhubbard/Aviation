# syntax=docker/dockerfile:1.4

ARG NODE_VERSION=20
ARG BUILDKIT_INLINE_CACHE=1

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app

RUN apk add --no-cache python3 make g++

# This repo is a pnpm workspace and its packages use the "workspace:" protocol,
# which npm cannot resolve (EUNSUPPORTEDPROTOCOL). Use the pinned pnpm.
RUN corepack enable pnpm

ENV NODE_ENV=development

# Workspace manifests first so dependency installation caches independently of source.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# The lockfile describes every workspace member, so they must all be present
# for --frozen-lockfile to succeed.
COPY packages ./packages
COPY apps ./apps

FROM base AS build

ARG VITE_META_APP_MODE=launcher
ENV VITE_META_APP_MODE=${VITE_META_APP_MODE}

RUN pnpm install --frozen-lockfile --filter @aviation/meta-app...
RUN pnpm --filter @aviation/meta-app... run build
RUN pnpm --config.node-linker=hoisted --filter @aviation/meta-app deploy --legacy --prod /runtime/meta-app

FROM node:${NODE_VERSION}-alpine AS production

WORKDIR /app
COPY --from=build /runtime/meta-app ./

EXPOSE 8080
USER node
CMD ["node", "server.mjs"]
