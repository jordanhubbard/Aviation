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
COPY package-lock.json ./

# Copy shared packages source code (needed for workspace resolution)
COPY packages/shared-sdk ./packages/shared-sdk
COPY packages/keystore ./packages/keystore
COPY packages/ui-framework ./packages/ui-framework

# Development stage
FROM base AS development

# Install ALL dependencies at once (this creates workspace symlinks correctly)
RUN npm ci

# Now build shared packages (the symlinks already point to the right place)
# TypeScript in each package can now find dependencies via workspace links
RUN cd packages/shared-sdk && npm run build && cd ../..
RUN cd packages/keystore && npm run build && cd ../..
RUN cd packages/ui-framework && npm run build && cd ../..

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript (now shared-sdk dist folder exists and workspace links work)
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

# Copy pre-built shared packages from development stage (includes dist/ folders)
COPY --from=development /app/packages/shared-sdk ./packages/shared-sdk
COPY --from=development /app/packages/keystore ./packages/keystore
COPY --from=development /app/packages/ui-framework ./packages/ui-framework

# Install only production dependencies (workspace links to already-built packages)
ENV NODE_ENV=production
RUN npm ci --omit=dev

# Copy built app code from development stage
COPY --from=development /app/dist ./dist
COPY package*.json ./

# Create necessary directories
RUN mkdir -p logs

# Expose port
EXPOSE 3003

# Set healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD pgrep -f "node.*weather-briefing" || exit 1

# Start the service in production mode
CMD ["node", "dist/index.js"]
