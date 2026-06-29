@echo off
chcp 65001 > nul
title Musik App – Einrichtung

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║         Musik App – Einrichtung                  ║
echo  ╚══════════════════════════════════════════════════╝
echo.
echo  Dieses Skript richtet die App automatisch ein.
echo  Stelle sicher, dass Docker Desktop gestartet ist.
echo.
pause

:: Docker prüfen
docker info > nul 2>&1
if errorlevel 1 (
    echo.
    echo  [FEHLER] Docker Desktop ist nicht gestartet!
    echo  Bitte starte Docker Desktop und fuhre das Skript erneut aus.
    echo.
    pause
    exit /b 1
)

:: ChurchTools-URL abfragen
echo.
echo  Bitte gib die ChurchTools-Adresse eurer Gemeinde ein.
echo  Beispiel: https://eure-gemeinde.church.tools
echo.
set /p CT_URL=" ChurchTools-URL: "

if "%CT_URL%"=="" (
    echo.
    echo  [FEHLER] Keine URL eingegeben. Einrichtung abgebrochen.
    pause
    exit /b 1
)

:: SESSION_SECRET generieren
for /f "tokens=*" %%a in ('powershell -Command "[System.BitConverter]::ToString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).Replace(\"-\",\"\").ToLower()"') do set SESSION_SECRET=%%a

:: .env schreiben
(
    echo CHURCHTOOLS_BASE_URL=%CT_URL%
    echo SESSION_SECRET=%SESSION_SECRET%
) > "%~dp0.env"

echo.
echo  Konfiguration gespeichert.
echo.
echo  Die App wird jetzt heruntergeladen und gestartet.
echo  Das kann beim ersten Mal einige Minuten dauern...
echo.

cd /d "%~dp0"
docker compose pull
docker compose up -d

if errorlevel 1 (
    echo.
    echo  [FEHLER] Beim Starten der App ist ein Fehler aufgetreten.
    echo  Prüfe ob Docker Desktop läuft und versuche es erneut.
    pause
    exit /b 1
)

echo.
echo  ✓ Die App läuft! Im Browser öffnen unter:
echo    http://localhost:3001
echo.
echo  Melde dich mit deinen ChurchTools-Zugangsdaten an.
echo.
pause
