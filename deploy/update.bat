@echo off
chcp 65001 > nul
title Musik App – Update
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║              Musik App – Update                  ║
echo  ╚══════════════════════════════════════════════════╝
echo.

if not exist "%~dp0.env" (
    echo  [FEHLER] Keine .env gefunden.
    echo  Bitte zuerst die Einrichtung ausfuehren ^(setup.bat^).
    echo.
    pause
    exit /b 1
)

docker info > nul 2>&1
if errorlevel 1 (
    echo  [FEHLER] Docker ist nicht gestartet. Bitte Docker Desktop starten.
    echo.
    pause
    exit /b 1
)

echo  Neue Version wird geladen ...
echo.
docker compose pull
if errorlevel 1 (
    echo  [FEHLER] Konnte die neue Version nicht laden. Internetverbindung?
    pause
    exit /b 1
)
docker compose up -d
if errorlevel 1 (
    echo  [FEHLER] Konnte die App nicht neu starten. Mehr Infos: docker compose logs
    pause
    exit /b 1
)
docker image prune -f > nul 2>&1

echo.
echo  ✓ Update fertig. Die App laeuft weiter unter http://localhost:3001
echo  Eure Daten, Einstellungen und Anmerkungen bleiben erhalten.
echo.
pause
