#!/bin/sh
set -e

# Small delay to stagger DNS lookups when multiple services start simultaneously
sleep 6

echo "Running database migrations..."
node dist/db/migrate.js

echo "Starting Notifications service..."
exec node dist/index.js

