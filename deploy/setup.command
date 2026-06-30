#!/bin/bash
# Musik App – Einrichtung für macOS / Linux
# Doppelklick (macOS) ODER im Terminal: bash setup.command

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
export PATH="/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

# Bei Fehler das Fenster offen halten, damit die Meldung lesbar bleibt
fail() {
    echo ""
    echo "[FEHLER] $1"
    echo ""
    read -r -p "Zum Schließen Enter drücken ..."
    exit 1
}

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║           Musik App – Einrichtung                ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Quarantäne-Markierung von mitgelieferten Dateien lösen (Browser-Downloads)
xattr -dr com.apple.quarantine "$DIR" 2>/dev/null || true

# 1. Ist Docker installiert?
if ! command -v docker > /dev/null 2>&1; then
    fail "Docker wurde nicht gefunden. Bitte zuerst Docker Desktop installieren und starten:
  https://www.docker.com/products/docker-desktop/"
fi

# 2. Läuft der Docker-Dienst?
if ! docker info > /dev/null 2>&1; then
    fail "Docker ist installiert, aber nicht gestartet.
  Starte Docker Desktop, warte bis das Wal-Symbol oben ruhig ist,
  und führe dieses Skript erneut aus."
fi

# 3. Ist 'docker compose' (v2) verfügbar?
if ! docker compose version > /dev/null 2>&1; then
    fail "Die Docker-Version ist zu alt – der Befehl 'docker compose' fehlt.
  Bitte Docker Desktop aktualisieren (benötigt Compose v2)."
fi

# 4. ChurchTools-URL abfragen
echo "Bitte gib die ChurchTools-Adresse eurer Gemeinde ein."
echo "Beispiel: https://eure-gemeinde.church.tools"
echo ""
read -r -p "ChurchTools-URL: " CT_URL
[ -z "$CT_URL" ] && fail "Keine URL eingegeben. Einrichtung abgebrochen."

# 5. .env schreiben – vorhandenes Session-Secret behalten (sonst werden alle Logins ungültig)
if [ -f "$DIR/.env" ] && grep -q '^SESSION_SECRET=..*' "$DIR/.env"; then
    SESSION_SECRET="$(grep '^SESSION_SECRET=' "$DIR/.env" | head -1 | cut -d= -f2-)"
    echo "(Bestehendes Session-Secret wird beibehalten.)"
else
    SESSION_SECRET="$(openssl rand -hex 32)"
fi
cat > "$DIR/.env" <<EOF
CHURCHTOOLS_BASE_URL=$CT_URL
SESSION_SECRET=$SESSION_SECRET
EOF
echo ""
echo "Konfiguration gespeichert (.env)."
echo ""

# 6. Image holen und starten
echo "Die App wird heruntergeladen und gestartet."
echo "Beim ersten Mal kann das einige Minuten dauern ..."
echo ""
docker compose pull || fail "Konnte das App-Image nicht herunterladen.
  Ist eine Internetverbindung vorhanden und läuft Docker?"
docker compose up -d || fail "Konnte die App nicht starten.
  Mehr Infos zeigt: docker compose logs"

echo ""
echo "✓ Die App läuft! Im Browser öffnen:"
echo "      http://localhost:3001"
echo ""
echo "  Mit den ChurchTools-Zugangsdaten anmelden,"
echo "  dann im 'Mehr'-Tab den Gemeindenamen setzen."
echo ""
read -r -p "Zum Schließen Enter drücken ..."
