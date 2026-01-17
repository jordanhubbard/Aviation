# syntax=docker/dockerfile:1.4

ARG NODE_VERSION=20
ARG BUILDKIT_INLINE_CACHE=1

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app

RUN apk add --no-cache python3 make g++

ENV NODE_ENV=development

COPY apps/meta-app/package*.json ./
COPY package-lock.json ./

COPY packages/shared-sdk ./packages/shared-sdk
COPY packages/keystore ./packages/keystore
COPY packages/ui-framework ./packages/ui-framework

FROM base AS build

ARG VITE_META_APP_MODE=launcher
ENV VITE_META_APP_MODE=${VITE_META_APP_MODE}

RUN npm ci

RUN cd packages/shared-sdk && npm run build && cd ../..
RUN cd packages/keystore && npm run build && cd ../..
RUN cd packages/ui-framework && npm run build && cd ../..

COPY apps/meta-app/index.html ./
COPY apps/meta-app/vite.config.ts ./
COPY apps/meta-app/tsconfig.json ./
COPY apps/meta-app/tsconfig.node.json ./
COPY apps/meta-app/src ./src

RUN npm run build

FROM nginxinc/nginx-unprivileged:1.25-alpine AS production

COPY apps/meta-app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
