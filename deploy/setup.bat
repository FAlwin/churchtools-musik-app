@echo off
chcp 65001 > nul
title Musik App – Einrichtung
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║           Musik App – Einrichtung                ║
echo  ╚══════════════════════════════════════════════════╝
echo.

:: 1. Ist Docker installiert?
where docker > nul 2>&1
if errorlevel 1 (
    echo  [FEHLER] Docker wurde nicht gefunden.
    echo  Bitte zuerst Docker Desktop installieren und starten:
    echo    https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)

:: 2. Laeuft der Docker-Dienst?
docker info > nul 2>&1
if errorlevel 1 (
    echo  [FEHLER] Docker ist installiert, aber nicht gestartet.
    echo  Starte Docker Desktop, warte bis es bereit ist, und starte das Skript erneut.
    echo.
    pause
    exit /b 1
)

:: 3. Ist "docker compose" (v2) verfuegbar?
docker compose version > nul 2>&1
if errorlevel 1 (
    echo  [FEHLER] Die Docker-Version ist zu alt - der Befehl "docker compose" fehlt.
    echo  Bitte Docker Desktop aktualisieren ^(benoetigt Compose v2^).
    echo.
    pause
    exit /b 1
)

:: 4. ChurchTools-URL abfragen
echo  Bitte gib die ChurchTools-Adresse eurer Gemeinde ein.
echo  Beispiel: https://eure-gemeinde.church.tools
echo.
set /p CT_URL=" ChurchTools-URL: "
if "%CT_URL%"=="" (
    echo  [FEHLER] Keine URL eingegeben. Einrichtung abgebrochen.
    pause
    exit /b 1
)

:: 5. Bestehendes Session-Secret beibehalten, sonst neu erzeugen
set SESSION_SECRET=
if exist "%~dp0.env" (
    for /f "tokens=2 delims==" %%a in ('findstr /b "SESSION_SECRET=" "%~dp0.env"') do set SESSION_SECRET=%%a
)
if "%SESSION_SECRET%"=="" (
    for /f "tokens=*" %%a in ('powershell -NoProfile -Command "[System.BitConverter]::ToString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).Replace('-','').ToLower()"') do set SESSION_SECRET=%%a
)

:: .env schreiben
(
    echo CHURCHTOOLS_BASE_URL=%CT_URL%
    echo SESSION_SECRET=%SESSION_SECRET%
) > "%~dp0.env"

echo.
echo  Konfiguration gespeichert (.env).
echo.
echo  Die App wird heruntergeladen und gestartet.
echo  Beim ersten Mal kann das einige Minuten dauern ...
echo.

docker compose pull
if errorlevel 1 (
    echo  [FEHLER] Konnte das App-Image nicht herunterladen. Internetverbindung? Docker?
    pause
    exit /b 1
)
docker compose up -d
if errorlevel 1 (
    echo  [FEHLER] Konnte die App nicht starten. Mehr Infos: docker compose logs
    pause
    exit /b 1
)

echo.
echo  ✓ Die App laeuft! Im Browser oeffnen:
echo      http://localhost:3001
echo.
echo  Mit den ChurchTools-Zugangsdaten anmelden, dann im "Mehr"-Tab den Gemeindenamen setzen.
echo.
pause
