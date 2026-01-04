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
COPY services/iam ./services/iam

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build packages and service
RUN pnpm build --filter=iam-service

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
COPY --from=base /app/services/iam ./services/iam

# Copy migrations directory (SQL files not included in TypeScript build)
COPY services/iam/src/db/migrations ./services/iam/dist/db/migrations

# Copy entrypoint script
COPY services/iam/docker-entrypoint.sh ./services/iam/docker-entrypoint.sh

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Make entrypoint executable
RUN chmod +x ./services/iam/docker-entrypoint.sh

# Expose port (not mapped in docker-compose)
EXPOSE 3001

WORKDIR /app/services/iam

ENTRYPOINT ["./docker-entrypoint.sh"]

