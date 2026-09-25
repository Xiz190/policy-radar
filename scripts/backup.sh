#!/bin/bash

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"
DB_NAME="public_info_sync"
DB_USER="postgres"

mkdir -p $BACKUP_DIR

docker exec public-info-sync-db pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "备份完成: $BACKUP_DIR/backup_$DATE.sql.gz"