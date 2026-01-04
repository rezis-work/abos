#!/bin/sh
set -e

echo "Running database migrations..."
node dist/db/migrate.js

echo "Starting Buildings service..."
exec node dist/index.js

