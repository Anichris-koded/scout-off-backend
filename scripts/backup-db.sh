#!/usr/bin/env bash
# backup-db.sh — Copy the ScoutOff SQLite database to a timestamped backup location.
#
# Supports both local filesystem destinations and S3/GCS URIs:
#   Local:  BACKUP_DEST=/var/backups/scout-off
#   AWS S3: BACKUP_DEST=s3://my-bucket/scout-off-backups
#   GCS:    BACKUP_DEST=gs://my-bucket/scout-off-backups
#
# Environment variables:
#   DB_PATH      Path to the SQLite database file (default: scout-off.db)
#   BACKUP_DEST  Destination directory or bucket URI (required)
#
# Usage:
#   DB_PATH=/data/scout-off.db BACKUP_DEST=/var/backups/scout-off ./scripts/backup-db.sh
#
# Exit codes:
#   0  Success
#   1  DB file not found, destination not set, or copy failed

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

DB_PATH="${DB_PATH:-scout-off.db}"
BACKUP_DEST="${BACKUP_DEST:-}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DB_BASENAME="$(basename "${DB_PATH}" .db)"
BACKUP_FILENAME="${DB_BASENAME}-${TIMESTAMP}.db"

# ─── Validation ───────────────────────────────────────────────────────────────

if [[ -z "${BACKUP_DEST}" ]]; then
  echo "[backup-db] ERROR: BACKUP_DEST is not set. Provide a local path or an S3/GCS URI." >&2
  exit 1
fi

if [[ ! -f "${DB_PATH}" ]]; then
  echo "[backup-db] ERROR: Database file not found: ${DB_PATH}" >&2
  exit 1
fi

echo "[backup-db] Starting backup of '${DB_PATH}' → '${BACKUP_DEST}/${BACKUP_FILENAME}'"

# ─── Copy ─────────────────────────────────────────────────────────────────────

if [[ "${BACKUP_DEST}" == s3://* ]]; then
  # AWS S3
  if ! command -v aws &>/dev/null; then
    echo "[backup-db] ERROR: 'aws' CLI not found. Install it to use S3 backups." >&2
    exit 1
  fi
  aws s3 cp "${DB_PATH}" "${BACKUP_DEST}/${BACKUP_FILENAME}" || {
    echo "[backup-db] ERROR: aws s3 cp failed." >&2
    exit 1
  }

elif [[ "${BACKUP_DEST}" == gs://* ]]; then
  # Google Cloud Storage
  if ! command -v gsutil &>/dev/null; then
    echo "[backup-db] ERROR: 'gsutil' not found. Install the Google Cloud SDK to use GCS backups." >&2
    exit 1
  fi
  gsutil cp "${DB_PATH}" "${BACKUP_DEST}/${BACKUP_FILENAME}" || {
    echo "[backup-db] ERROR: gsutil cp failed." >&2
    exit 1
  }

else
  # Local filesystem
  mkdir -p "${BACKUP_DEST}" || {
    echo "[backup-db] ERROR: Could not create backup directory '${BACKUP_DEST}'." >&2
    exit 1
  }
  cp "${DB_PATH}" "${BACKUP_DEST}/${BACKUP_FILENAME}" || {
    echo "[backup-db] ERROR: cp failed." >&2
    exit 1
  }
fi

echo "[backup-db] Backup complete: ${BACKUP_DEST}/${BACKUP_FILENAME}"
