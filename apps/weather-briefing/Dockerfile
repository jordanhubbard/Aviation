# syntax=docker/dockerfile:1.4

# Build arguments
ARG NODE_VERSION=20
ARG BUILDKIT_INLINE_CACHE=1

# Base stage with Node.js
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set environment variables
ENV NODE_ENV=development \
    PYTHONUNBUFFERED=1

# Copy package files for dependency installation
COPY apps/weather-briefing/package*.json ./
COPY package-lock.json ./

# Install shared SDK dependencies (from monorepo workspace)
COPY packages/shared-sdk ./packages/shared-sdk
COPY packages/keystore ./packages/keystore
COPY packages/ui-framework ./packages/ui-framework

# Development stage
FROM base AS development

# Install all dependencies (including dev dependencies)
RUN npm ci

# Build shared packages first (they're needed for the app build)
RUN cd packages/shared-sdk && npm run build && cd ../..
RUN cd packages/keystore && npm run build && cd ../..
RUN cd packages/ui-framework && npm run build && cd ../..

# Copy source code
COPY apps/weather-briefing/src ./src
COPY apps/weather-briefing/tsconfig.json ./

# Build TypeScript
RUN npm run build

# Create necessary directories
RUN mkdir -p logs

# Expose port (if needed for API in future)
EXPOSE 3003

# Set healthcheck (basic process check)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD pgrep -f "node.*weather-briefing" || exit 1

# Start the service
CMD ["npm", "start"]

# Testing stage for running tests
FROM development AS testing

# Set testing environment variables
ENV NODE_ENV=test

# Default command for testing
CMD ["npm", "test"]

# Production stage - optimized for smaller size
FROM base AS production

# Install only production dependencies
ENV NODE_ENV=production
RUN npm ci --omit=dev

# Copy built code from development stage
COPY --from=development /app/dist ./dist
COPY apps/weather-briefing/package*.json ./

# Create necessary directories
RUN mkdir -p logs

# Expose port
EXPOSE 3003

# Set healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD pgrep -f "node.*weather-briefing" || exit 1

# Start the service
CMD ["npm", "start"]
