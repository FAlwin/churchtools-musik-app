#!/bin/bash
# Musik App – Einrichtungs-Skript für macOS / Linux
# Ausführen mit: bash setup.command

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║         Musik App – Einrichtung                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "Stelle sicher, dass Docker Desktop gestartet ist."
echo ""
read -p "Weiter mit Enter ..."

# Docker prüfen
if ! docker info > /dev/null 2>&1; then
    echo ""
    echo "[FEHLER] Docker Desktop ist nicht gestartet!"
    echo "Bitte starte Docker Desktop und führe das Skript erneut aus."
    exit 1
fi

# ChurchTools-URL abfragen
echo ""
echo "Bitte gib die ChurchTools-Adresse eurer Gemeinde ein."
echo "Beispiel: https://eure-gemeinde.church.tools"
echo ""
read -p "ChurchTools-URL: " CT_URL

if [ -z "$CT_URL" ]; then
    echo ""
    echo "[FEHLER] Keine URL eingegeben. Einrichtung abgebrochen."
    exit 1
fi

# SESSION_SECRET generieren und .env schreiben
SESSION_SECRET=$(openssl rand -hex 32)
cat > "$DIR/.env" <<EOF
CHURCHTOOLS_BASE_URL=$CT_URL
SESSION_SECRET=$SESSION_SECRET
EOF

echo ""
echo "Konfiguration gespeichert."
echo ""
echo "Die App wird jetzt heruntergeladen und gestartet."
echo "Das kann beim ersten Mal einige Minuten dauern..."
echo ""

cd "$DIR"
docker compose pull
docker compose up -d

echo ""
echo "✓ Die App läuft! Im Browser öffnen unter:"
echo "  http://localhost:3001"
echo ""
echo "Melde dich mit deinen ChurchTools-Zugangsdaten an."
echo ""
