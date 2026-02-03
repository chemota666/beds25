#!/bin/bash
# RoomFlow PMS - Script de Backup
BACKUP_DIR="/opt/backups/roomflow"
APP_DIR="/opt/apps/roomflow-app"
DATE=$(date +%Y%m%d_%H%M%S)
MESSAGE="${1:-Backup manual}"
mkdir -p $BACKUP_DIR
echo "=== RoomFlow Backup - $DATE ==="
echo "[1/3] Creando backup de MySQL..."
mysqldump -u roomflow -proomflow123 roomflow_pms > "$BACKUP_DIR/db_backup_$DATE.sql" 2>/dev/null
echo "[2/3] Guardando estado del codigo..."
cd $APP_DIR && git add -A && git commit -m "backup: $MESSAGE - $DATE" 2>/dev/null
echo "[3/3] Creando tag..."
git tag -a "backup-$DATE" -m "$MESSAGE" 2>/dev/null
echo "=== Backup completado ==="
