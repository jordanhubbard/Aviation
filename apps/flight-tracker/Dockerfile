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
COPY package*.json ./

# Install shared SDK dependencies (from monorepo workspace)
COPY ../../packages/shared-sdk ./packages/shared-sdk
COPY ../../packages/keystore ./packages/keystore
COPY ../../packages/ui-framework ./packages/ui-framework

# Development stage
FROM base AS development

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Create necessary directories
RUN mkdir -p logs

# Expose port (if needed for API in future)
EXPOSE 3001

# Set healthcheck (basic process check)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD pgrep -f "node.*flight-tracker" || exit 1

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
COPY package*.json ./

# Create necessary directories
RUN mkdir -p logs

# Expose port
EXPOSE 3001

# Set healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD pgrep -f "node.*flight-tracker" || exit 1

# Start the service
CMD ["npm", "start"]
