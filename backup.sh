#!/usr/bin/env bash
# PMO CORE — Coordinated backup script (DB + uploads in one timestamped window)
# Run from WSL: bash /mnt/d/Programming/pmo-dash/backup.sh
# Backups land in: /mnt/d/Programming/pmo-dash/backups/YYYYMMDD_HHMMSS/
#
# SAFETY: Never uses "docker compose down -v". Reads live data via pg_dump
# and docker cp while the stack is running. Safe for production use.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_ROOT="$PROJECT_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"

DB_CONTAINER="pmo-dash-postgres-1"
BACKEND_CONTAINER="pmo-dash-backend-1"
DB_USER="postgres"
DB_NAME="pmo_dashboard"

echo "======================================"
echo " PMO CORE Backup — $TIMESTAMP"
echo "======================================"

# --- Pre-flight checks ---
if ! docker compose -f "$PROJECT_DIR/docker-compose.yml" ps --services --filter "status=running" 2>/dev/null | grep -q postgres; then
  echo "[ERROR] postgres container is not running. Start the stack first."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
echo "[1/3] Backup directory: $BACKUP_DIR"

# --- Database dump ---
echo "[2/3] Dumping database '$DB_NAME'..."
docker exec "$DB_CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl -Fc \
  > "$BACKUP_DIR/db.dump"

DB_SIZE=$(du -sh "$BACKUP_DIR/db.dump" | cut -f1)
echo "      Done — $DB_SIZE"

# --- Uploads archive ---
echo "[3/3] Archiving uploaded files..."
docker exec "$BACKEND_CONTAINER" \
  tar -czf - -C /app uploads \
  > "$BACKUP_DIR/uploads.tar.gz"

UP_SIZE=$(du -sh "$BACKUP_DIR/uploads.tar.gz" | cut -f1)
echo "      Done — $UP_SIZE"

# --- Manifest ---
cat > "$BACKUP_DIR/MANIFEST.txt" <<EOF
PMO CORE Backup
Timestamp : $TIMESTAMP
Database  : $DB_NAME (pg_dump custom format)
Uploads   : /app/uploads (tar.gz)
DB size   : $DB_SIZE
Files size: $UP_SIZE
Created by: $(whoami)@$(hostname)
Stack     : $(docker compose -f "$PROJECT_DIR/docker-compose.yml" ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || echo "unknown")
EOF

echo ""
echo "======================================"
echo " Backup complete: $BACKUP_DIR"
echo " DB : $DB_SIZE   Uploads: $UP_SIZE"
echo "======================================"
