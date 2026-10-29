#!/usr/bin/env bash
#
# Nightly MongoDB backup.
#
#   ./scripts/backup.sh
#   MONGODB_URI="mongodb://host:27017/gymflow" BACKUP_DIR=/var/backups/bgms RETENTION_DAYS=30 ./scripts/backup.sh
#
# Requires mongodump (MongoDB Database Tools). Each run writes a compressed
# dump into a timestamped folder and removes folders older than the retention
# window. Run it from cron, for example:
#
#   0 2 * * * cd /srv/bgms/backend && ./scripts/backup.sh >> /var/log/bgms-backup.log 2>&1

set -euo pipefail

MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/gymflow?replicaSet=rs0}"
BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
DESTINATION="${BACKUP_DIR}/bgms-${TIMESTAMP}"

if ! command -v mongodump >/dev/null 2>&1; then
  echo "mongodump was not found. Install the MongoDB Database Tools." >&2
  exit 1
fi

if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || [ "$RETENTION_DAYS" -lt 1 ]; then
  echo "RETENTION_DAYS must be a positive integer." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
echo "Backing up ${MONGODB_URI} to ${DESTINATION}"

mongodump --uri="$MONGODB_URI" --out="$DESTINATION" --gzip

# Keep a manifest so a restore is self-describing.
{
  echo "created_at=${TIMESTAMP}"
  echo "source=${MONGODB_URI}"
  echo "retention_days=${RETENTION_DAYS}"
} > "${DESTINATION}/BACKUP_INFO.txt"

echo "Backup complete: ${DESTINATION}"

# Retention: remove old backup folders.
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'bgms-*' -mtime "+${RETENTION_DAYS}" -print -exec rm -rf {} +

echo "Restore with: mongorestore --uri=\"\$MONGODB_URI\" --gzip --drop \"${DESTINATION}\""
