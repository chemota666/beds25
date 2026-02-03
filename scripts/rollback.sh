#!/bin/bash
# RoomFlow PMS - Script de Rollback
# Uso: ./rollback.sh [tag_o_backup_sql]
BACKUP_DIR="/opt/backups/roomflow"
APP_DIR="/opt/apps/roomflow-app"
if [ -z "$1" ]; then
    echo "Backups disponibles:"
    echo "--- GIT TAGS ---"
    cd $APP_DIR && git tag | grep backup | tail -5
    echo "--- DB BACKUPS ---"
    ls -1 $BACKUP_DIR/*.sql 2>/dev/null | tail -5
    echo ""
    echo "Uso: ./rollback.sh <tag> [sql_file]"
    exit 1
fi
TAG=$1
SQL_FILE=$2
echo "=== RoomFlow Rollback ==="
if [ -n "$TAG" ]; then
    echo "[1/2] Restaurando codigo a: $TAG"
    cd $APP_DIR && git checkout $TAG
fi
if [ -n "$SQL_FILE" ] && [ -f "$SQL_FILE" ]; then
    echo "[2/2] Restaurando base de datos desde: $SQL_FILE"
    mysql -u roomflow -proomflow123 roomflow_pms < "$SQL_FILE" 2>/dev/null
fi
echo "[3/3] Reiniciando PM2..."
pm2 reload roomflow-api
echo "=== Rollback completado ==="
