@echo off
TITLE Planka Restore Database
echo ==========================================
echo Restoring Planka Database from Backup...
echo ==========================================

if not exist data\backups\portable_backup.sql (
    echo [ERROR] Backup file data\backups\portable_backup.sql not found!
    pause
    exit /b
)

echo [WARNING] This will overwrite the current database!
set /p confirm="Are you sure? (y/n): "
if /i not "%confirm%"=="y" goto :eof

echo Restoring...
type data\backups\portable_backup.sql | docker exec -i planka-db psql -U postgres -d planka

echo ==========================================
echo Restore complete!
echo ==========================================
pause
