#!/bin/bash
# Musik App – Update für macOS / Linux
# Doppelklick (macOS) ODER im Terminal: bash update.command

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
export PATH="/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

fail() {
    echo ""
    echo "[FEHLER] $1"
    echo ""
    read -r -p "Zum Schließen Enter drücken ..."
    exit 1
}

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║              Musik App – Update                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

[ -f "$DIR/.env" ] || fail "Keine .env gefunden.
  Bitte zuerst die Einrichtung ausführen (setup.command)."
docker info > /dev/null 2>&1 || fail "Docker ist nicht gestartet. Bitte Docker Desktop starten."

echo "Neue Version wird geladen ..."
echo ""
docker compose pull || fail "Konnte die neue Version nicht laden. Internetverbindung?"
docker compose up -d || fail "Konnte die App nicht neu starten. Mehr Infos: docker compose logs"
docker image prune -f > /dev/null 2>&1 || true

echo ""
echo "✓ Update fertig. Die App läuft weiter unter http://localhost:3001"
echo "  Eure Daten, Einstellungen und Anmerkungen bleiben erhalten."
echo ""
read -r -p "Zum Schließen Enter drücken ..."
