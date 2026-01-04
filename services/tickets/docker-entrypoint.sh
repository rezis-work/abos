#!/bin/sh
set -e

echo "Running database migrations..."
node dist/db/migrate.js

echo "Starting Tickets service..."
exec node dist/index.js

