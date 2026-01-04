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
COPY services/tickets ./services/tickets

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build packages and service
RUN pnpm build --filter=tickets-service

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
COPY --from=base /app/services/tickets ./services/tickets

# Copy migrations directory (SQL files not included in TypeScript build)
COPY services/tickets/src/db/migrations ./services/tickets/dist/db/migrations

# Copy entrypoint script
COPY services/tickets/docker-entrypoint.sh ./services/tickets/docker-entrypoint.sh

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Make entrypoint executable
RUN chmod +x ./services/tickets/docker-entrypoint.sh

# Expose port (not mapped in docker-compose)
EXPOSE 3004

WORKDIR /app/services/tickets

ENTRYPOINT ["./docker-entrypoint.sh"]

