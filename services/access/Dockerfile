FROM node:22-alpine AS base

# Install pnpm
RUN npm install -g pnpm@8.15.0

WORKDIR /app

# Copy workspace configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json tsconfig.json ./

# Copy all packages (needed for workspace dependencies)
COPY packages ./packages

# Copy service files
COPY services/access ./services/access

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build packages and service
RUN pnpm build --filter=access-service

# Production stage
FROM node:22-alpine AS production

# Install curl for healthchecks
RUN apk add --no-cache curl

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json tsconfig.json ./

# Copy built packages
COPY --from=base /app/packages ./packages

# Copy built service
COPY --from=base /app/services/access ./services/access

# Copy migrations directory (SQL files not included in TypeScript build)
COPY services/access/src/db/migrations ./services/access/dist/db/migrations

# Copy entrypoint script
COPY services/access/docker-entrypoint.sh ./services/access/docker-entrypoint.sh

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Make entrypoint executable
RUN chmod +x ./services/access/docker-entrypoint.sh

# Expose port (not mapped in docker-compose)
EXPOSE 3006

WORKDIR /app/services/access

ENTRYPOINT ["./docker-entrypoint.sh"]

