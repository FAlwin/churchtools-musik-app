# Hilfe bei Problemen (Troubleshooting)

Für Gemeinden, die die App selbst betreiben. Die häufigsten Stolpersteine mit Schritt-für-Schritt-Lösung.
Kurzübersicht: [INSTALL.md](../../INSTALL.md) → „Typische Probleme".

---

## Einrichtung / Start

### macOS: „setup.command kann nicht geöffnet werden" (nicht verifizierter Entwickler)
macOS blockiert frisch heruntergeladene Skripte beim ersten Doppelklick. Das ist normal.
1. **Rechtsklick** (oder Ctrl-Klick) auf `setup.command` → **„Öffnen"**.
2. Im Dialog noch einmal **„Öffnen"** klicken.
3. Ab dann startet das Skript bei jedem Doppelklick normal.

### Windows: „Der Computer wurde durch Windows geschützt" (SmartScreen)
Auch das ist normal bei neuen Skripten.
1. Im blauen Fenster auf **„Weitere Informationen"** klicken.
2. Dann **„Trotzdem ausführen"**.

### „Docker wurde nicht gefunden"
Docker Desktop ist nicht installiert.
→ [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) installieren,
starten und das Setup-Skript erneut ausführen.

### „Docker ist installiert, aber nicht gestartet"
Docker Desktop läuft nicht.
→ Docker Desktop öffnen und warten, bis das Wal-Symbol oben „ruhig" ist (nicht mehr animiert),
dann das Skript erneut ausführen.

### „Die Docker-Version ist zu alt (docker compose fehlt)"
Es wird Docker Compose v2 benötigt.
→ Docker Desktop auf die aktuelle Version aktualisieren.

### Der Download des Images dauert ewig / bricht ab
- Internetverbindung prüfen.
- Erneut versuchen – ein angefangener Download wird fortgesetzt.

---

## Anmeldung & Anzeige

### „Nicht angemeldet" direkt nach dem Login
Der Browser speichert das Anmelde-Cookie nicht. Das passiert vor allem, wenn die App **nur über HTTP**
(ohne `https://`) aufgerufen wird und nicht über `localhost` läuft.
- Lokal: immer **http://localhost:3001** verwenden (nicht die IP).
- Im Netz/extern: über **HTTPS** erreichbar machen (Reverse Proxy oder Cloudflare Tunnel,
  siehe [INSTALL.md](../../INSTALL.md) → „Externer Zugriff").

### Keine Lieder oder Abläufe sichtbar
Die angemeldete Person hat in ChurchTools nicht die nötigen Rechte.
→ In ChurchTools die Rechte prüfen: „Veranstaltungen sehen" + „Song-Kategorien sehen".

### Admin-Funktionen (Gemeindename, Links) fehlen
Das in `.env` hinterlegte Admin-Recht passt nicht zur ChurchTools-Instanz.
→ `ADMIN_PERMISSION` in der `.env` anpassen (Standard: `churchcore:administer persons`) und
die App neu starten (`update.command`/`update.bat` oder `docker compose up -d`).

---

## Updates & Daten

### Nach einem Update sind Einstellungen/Anmerkungen weg
Das Daten-Volume wurde beim Update gelöscht oder umbenannt.
→ Beim Aktualisieren das Volume **behalten** (nicht „mit Volumes löschen" wählen).
Die mitgelieferten Update-Skripte (`update.command`/`update.bat`) machen das automatisch richtig.
Details: [UPDATE.md](../../UPDATE.md).

### Wie sehe ich, welche Version läuft?
In der App: Tab **„Mehr"** ganz unten – dort steht die Versionsnummer.

---

## Weiterkommen
- Logs ansehen: im `deploy/`-Ordner `docker compose logs` ausführen.
- App neu starten: `docker compose up -d` (oder Update-Skript doppelklicken).
- Bleibt etwas unklar: ein Issue im GitHub-Repo eröffnen.
