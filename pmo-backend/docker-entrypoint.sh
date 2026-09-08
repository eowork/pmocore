#!/bin/sh
set -e

# Dev only: docker-compose.dev.yml bind-mounts the full source tree (including src/
# and tsconfig.json) over the image's /app, so /app/src existing means we're in dev.
# migrate.js reads migrations from the COMPILED dist/database/mikro-migrations (see
# mikro-orm.config.ts) — never from src/ — and the anonymous /app/dist volume is
# reused across restarts/builds by default, so a migration added only in src/ can go
# unseen until dist/ is rebuilt. Rebuilding here guarantees dist/ is current before
# migrate.js runs. Prod's runtime image has no src/, so this is a no-op there.
if [ -d /app/src ]; then
  echo "Dev environment detected — rebuilding before migrating..."
  npm run build
fi

echo "Running database migrations..."
node /app/migrate.js

echo "Starting backend..."
exec "$@"
