@echo off
TITLE Planka + WhatsApp Monorepo Starter
echo ==========================================
echo Starting Planka Monorepo System...
echo ==========================================

:: 1. Check for .env file
if not exist .env (
    echo [ERROR] .env file not found!
    echo Creating .env from .env.example...
    copy .env.example .env
    echo [WARNING] Please edit the .env file with your credentials before running this script again.
    pause
    exit /b
)

:: 2. Create Data Folders
echo Creating data directories...
if not exist data\postgres mkdir data\postgres
if not exist data\planka mkdir data\planka
if not exist data\evolution mkdir data\evolution

:: 3. Start Docker Containers
echo Starting Docker containers...
docker-compose up -d --build

echo ==========================================
echo System is starting up!
echo Bridge API: http://localhost:3000
echo Planka: http://localhost:3001
echo Evolution API: http://localhost:8080
echo ==========================================
echo To see logs: npm run logs
echo ==========================================
pause
