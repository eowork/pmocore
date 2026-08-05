#!/usr/bin/env bash
# PMO CORE — Coordinated restore script (DB + uploads from one backup set)
# Usage: bash /mnt/d/Programming/pmo-dash/restore.sh <backup-timestamp>
# Example: bash restore.sh 20260630_143000
#
# SAFETY: NEVER runs "docker compose down -v". Restores into the running
# postgres container via pg_restore and uploads via docker cp.
# The stack must be running before restore.
#
# WARNING: This REPLACES all current database data and upload files.
# It is intended for disaster recovery, not incremental updates.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_ROOT="$PROJECT_DIR/backups"

DB_CONTAINER="pmo-dash-postgres-1"
BACKEND_CONTAINER="pmo-dash-backend-1"
DB_USER="postgres"
DB_NAME="pmo_dashboard"

# --- Argument ---
if [[ $# -lt 1 ]]; then
  echo "Usage: bash restore.sh <timestamp>"
  echo ""
  echo "Available backups:"
  ls -1 "$BACKUP_ROOT" 2>/dev/null | grep -E '^[0-9]{8}_[0-9]{6}$' || echo "  (none found in $BACKUP_ROOT)"
  exit 1
fi

TIMESTAMP="$1"
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "[ERROR] Backup not found: $BACKUP_DIR"
  exit 1
fi

if [[ ! -f "$BACKUP_DIR/db.dump" || ! -f "$BACKUP_DIR/uploads.tar.gz" ]]; then
  echo "[ERROR] Backup set is incomplete (missing db.dump or uploads.tar.gz)."
  exit 1
fi

echo "======================================"
echo " PMO CORE Restore — from $TIMESTAMP"
echo "======================================"
echo ""
echo "MANIFEST:"
cat "$BACKUP_DIR/MANIFEST.txt"
echo ""
echo "WARNING: This will REPLACE all current data. The stack must be running."
read -r -p "Type YES to continue: " CONFIRM
if [[ "$CONFIRM" != "YES" ]]; then
  echo "Aborted."
  exit 0
fi

# --- Pre-flight ---
if ! docker compose -f "$PROJECT_DIR/docker-compose.yml" ps --services --filter "status=running" 2>/dev/null | grep -q postgres; then
  echo "[ERROR] postgres container is not running. Start the stack first."
  exit 1
fi

# --- Stop backend to prevent writes during restore ---
echo "[1/4] Stopping backend container..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" stop backend
echo "      Backend stopped."

# --- Database restore ---
echo "[2/4] Restoring database '$DB_NAME'..."
# Drop all connections first
docker exec "$DB_CONTAINER" \
  psql -U "$DB_USER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid();" \
  > /dev/null 2>&1 || true

# Drop and recreate the database
docker exec "$DB_CONTAINER" \
  psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" > /dev/null
docker exec "$DB_CONTAINER" \
  psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" > /dev/null

# Restore from custom-format dump
docker exec -i "$DB_CONTAINER" \
  pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl \
  < "$BACKUP_DIR/db.dump"

echo "      Database restored."

# --- Restart backend before uploads restore (docker cp requires running container) ---
echo "[3/4] Restoring uploaded files..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" start backend
echo "      Waiting for backend to start..."
sleep 8
docker cp "$BACKUP_DIR/uploads.tar.gz" "$BACKEND_CONTAINER:/tmp/uploads.tar.gz"
docker exec "$BACKEND_CONTAINER" sh -c "rm -rf /app/uploads/* /app/uploads/.[!.]* 2>/dev/null; tar -xzf /tmp/uploads.tar.gz -C /app && rm /tmp/uploads.tar.gz"
echo "      Uploads restored."

# --- Wait for health ---
echo "[4/4] Waiting for backend health..."
for i in $(seq 1 12); do
  if docker compose -f "$PROJECT_DIR/docker-compose.yml" ps | grep backend | grep -q "healthy"; then
    break
  fi
  sleep 5
done

echo ""
echo "======================================"
echo " Restore complete from $TIMESTAMP"
echo " Verify: http://localhost:3001"
echo "======================================"
