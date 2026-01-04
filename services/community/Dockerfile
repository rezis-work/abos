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
COPY services/community ./services/community

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build packages and service
RUN pnpm build --filter=community-service

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json tsconfig.json ./

# Copy built packages
COPY --from=base /app/packages ./packages

# Copy built service
COPY --from=base /app/services/community ./services/community

# Copy migrations directory (SQL files not included in TypeScript build)
COPY services/community/src/db/migrations ./services/community/dist/db/migrations

# Copy entrypoint script
COPY services/community/docker-entrypoint.sh ./services/community/docker-entrypoint.sh

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Make entrypoint executable
RUN chmod +x ./services/community/docker-entrypoint.sh

# Expose port (not mapped in docker-compose)
EXPOSE 3005

WORKDIR /app/services/community

ENTRYPOINT ["./docker-entrypoint.sh"]

