#!/bin/sh
set -e

# Small delay to stagger DNS lookups when multiple services start simultaneously
sleep 4

echo "Running database migrations..."
node dist/db/migrate.js

echo "Starting Access service..."
exec node dist/index.js

