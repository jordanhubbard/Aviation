# syntax=docker/dockerfile:1.4

# Build arguments
ARG NODE_VERSION=20
ARG BUILDKIT_INLINE_CACHE=1

# Base stage with Node.js
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ sqlite

# Set environment variables
ENV NODE_ENV=development \
    PYTHONUNBUFFERED=1

# Copy package files for dependency installation
COPY package.json ./
COPY package-lock.json ./
COPY apps/aviation-accident-tracker/backend/package*.json ./backend/
COPY apps/aviation-accident-tracker/frontend/package*.json ./frontend/

# Ensure workspace paths exist for npm workspaces
RUN mkdir -p apps/aviation-accident-tracker \
    && ln -sf /app/backend /app/apps/aviation-accident-tracker/backend \
    && ln -sf /app/frontend /app/apps/aviation-accident-tracker/frontend

# Install shared SDK dependencies (from monorepo workspace)
COPY packages/shared-sdk ./packages/shared-sdk
COPY packages/keystore ./packages/keystore
COPY packages/ui-framework ./packages/ui-framework

# Development stage
FROM base AS development

# Install workspace dependencies (including dev dependencies)
RUN npm ci \
    --workspace @aviation/accident-tracker-backend \
    --workspace @aviation/accident-tracker-frontend \
    --workspace @aviation/shared-sdk \
    --workspace @aviation/keystore \
    --workspace @aviation/ui-framework

# Build shared packages in order (dependencies first)
WORKDIR /app/packages/shared-sdk
RUN npm run build

WORKDIR /app/packages/keystore
RUN npm run build

WORKDIR /app/packages/ui-framework
RUN npm run build

# Return to app directory
WORKDIR /app

# Copy source code
COPY apps/aviation-accident-tracker/backend ./backend
COPY apps/aviation-accident-tracker/frontend ./frontend

# Build backend TypeScript (now shared-sdk dist folder exists)
WORKDIR /app/backend
RUN npm run build

# Build frontend assets for production
WORKDIR /app
RUN npm install --no-save --no-package-lock @rollup/rollup-linux-x64-musl
WORKDIR /app/frontend
RUN npm run build

# Return to app directory
WORKDIR /app

# Copy entrypoint script
COPY apps/aviation-accident-tracker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create necessary directories
RUN mkdir -p data logs

# Expose ports
# 3002 = Backend API (Express)
# 5173 = Frontend dev server (Vite)
EXPOSE 3002 5173

# Set healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use the entrypoint script
ENTRYPOINT ["/docker-entrypoint.sh"]

# Testing stage for running tests
FROM development AS testing

# Set testing environment variables
ENV NODE_ENV=test

# Default command for testing
CMD ["npm", "test"]

# Production stage - optimized for smaller size
FROM base AS production

# Copy pre-built shared packages from development stage (includes dist/ folders)
COPY --from=development /app/packages/shared-sdk ./packages/shared-sdk
COPY --from=development /app/packages/keystore ./packages/keystore
COPY --from=development /app/packages/ui-framework ./packages/ui-framework

# Install only production dependencies (backend only)
ENV NODE_ENV=production
RUN npm ci --omit=dev \
    --workspace @aviation/accident-tracker-backend \
    --workspace @aviation/shared-sdk \
    --workspace @aviation/keystore

# Copy built backend from development stage
COPY --from=development /app/backend/dist ./backend/dist
COPY apps/aviation-accident-tracker/backend/package*.json ./backend/
COPY apps/aviation-accident-tracker/backend/src/db/schema.sql ./backend/src/db/schema.sql

# Copy pre-built frontend assets from development stage
COPY --from=development /app/frontend/dist ./frontend/dist

# Copy entrypoint script
COPY apps/aviation-accident-tracker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create necessary directories
RUN mkdir -p data logs

# Expose backend port only (frontend is served as static files)
EXPOSE 3002

# Set healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use the entrypoint script
ENTRYPOINT ["/docker-entrypoint.sh"]
