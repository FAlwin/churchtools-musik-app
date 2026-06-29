#!/bin/bash
# Musik App – Einrichtungs-Skript für macOS
# Doppelklick startet dieses Skript im Terminal.

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
DOCKER="/Applications/Docker.app/Contents/Resources/bin/docker"
export PATH="/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

# Willkommen
osascript -e 'display dialog "Willkommen bei der Einrichtung der Musik App!\n\nBitte stelle sicher, dass Docker Desktop gestartet ist, bevor du fortfährst." buttons {"Weiter"} default button "Weiter" with title "Musik App – Einrichtung"' > /dev/null

# Docker prüfen
if ! docker info > /dev/null 2>&1; then
    osascript -e 'display dialog "Docker Desktop ist nicht gestartet!\n\nBitte starte Docker Desktop und führe das Skript erneut aus." buttons {"OK"} default button "OK" with title "Musik App – Einrichtung" with icon stop' > /dev/null
    exit 1
fi

# ChurchTools-URL abfragen
CT_URL=$(osascript -e 'text returned of (display dialog "Bitte gib die ChurchTools-Adresse eurer Gemeinde ein:\n\nBeispiel: https://eure-gemeinde.church.tools" default answer "https://" buttons {"Abbrechen", "Weiter"} default button "Weiter" with title "Musik App – Einrichtung")' 2>/dev/null) || {
    osascript -e 'display dialog "Einrichtung abgebrochen." buttons {"OK"} with title "Musik App – Einrichtung"' > /dev/null
    exit 0
}

if [ -z "$CT_URL" ] || [ "$CT_URL" = "https://" ]; then
    osascript -e 'display dialog "Bitte gib eine gültige ChurchTools-Adresse ein." buttons {"OK"} with title "Musik App – Einrichtung" with icon stop' > /dev/null
    exit 1
fi

# SESSION_SECRET generieren und .env schreiben
SESSION_SECRET=$(openssl rand -hex 32)
cat > "$DIR/.env" <<EOF
CHURCHTOOLS_BASE_URL=$CT_URL
SESSION_SECRET=$SESSION_SECRET
EOF

# Image laden und starten
osascript -e 'display dialog "Die App wird jetzt heruntergeladen und gestartet.\n\nDas kann beim ersten Mal einige Minuten dauern – bitte warten." buttons {"OK"} default button "OK" with title "Musik App – Einrichtung"' > /dev/null

cd "$DIR"
docker compose pull
docker compose up -d

# Ergebnis
BUTTON=$(osascript -e 'button returned of (display dialog "Die App läuft!\n\nIm Browser öffnen unter:\nhttp://localhost:3001\n\nMelde dich mit deinen ChurchTools-Zugangsdaten an." buttons {"Schließen", "Im Browser öffnen"} default button "Im Browser öffnen" with title "Musik App – Einrichtung")')

if [ "$BUTTON" = "Im Browser öffnen" ]; then
    open "http://localhost:3001"
fi
