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
  # /app/dist is itself a volume mount point (docker-compose.dev.yml), so it can't
  # be rmdir'd as a whole (nest-cli.json's deleteOutDir must stay false here) — only
  # its contents can be cleared. Without this, a source file removed from src/ (e.g.
  # a deleted migration) leaves its stale compiled .js behind in dist/ forever, since
  # tsc/nest build never deletes output for files that no longer exist in source.
  rm -rf /app/dist/*
  npm run build
fi

echo "Running database migrations..."
node /app/migrate.js

echo "Starting backend..."
exec "$@"
