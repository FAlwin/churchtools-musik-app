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

### „ChurchTools bremst uns gerade aus (zu viele Anfragen)"

ChurchTools begrenzt, wie viele Anfragen es in kurzer Zeit annimmt. Die App zeigt diese Meldung, statt
einen Fehler vorzutäuschen – **es ist kein Defekt**: Nach ein bis zwei Minuten geht es weiter.

Auslöser sind die Vorgänge, die viele Daten auf einmal holen: die Lied-Statistik (Häufigkeit / zuletzt
gespielt) und der erste Aufbau der **Suche im Liedtext**. Beide laufen höchstens **einmal** gleichzeitig,
auch wenn mehrere Geräte sie gleichzeitig auslösen, und legen nach einer Drosselung selbst eine Pause
ein. Wer die Meldung häufiger sieht, sollte prüfen, ob mehrere Instanzen der App auf dieselbe
ChurchTools-Instanz zugreifen – dann baut jede ihre eigenen Zwischenspeicher.

### Die Suche im Liedtext dauert beim ersten Mal

Beim ersten Aufruf holt die App **jeden Liedtext einmal** von ChurchTools (bei 50 Liedern also 50
Dateien). Danach antwortet sie eine Stunde lang aus dem Zwischenspeicher. Das ist so gebaut, weil weder
ChurchTools noch CCLI im Liedtext suchen können; die Texte liegen dort als Datei am Arrangement.

### Keine Lieder oder Abläufe sichtbar

**Zwei Ursachen – die zweite sieht wie die erste aus.**

**1. Es fehlen wirklich Rechte.** → In ChurchTools die Rechte prüfen: „Veranstaltungen sehen" +
„Song-Kategorien sehen".

**2. Die ChurchTools-Sitzung ist abgelaufen, die App merkt es aber nicht** (behoben mit #381; älterer
Stand betroffen). ChurchTools antwortet auf „wer ist angemeldet?" bei toter Sitzung nicht mit
„niemand", sondern mit einem Platzhalter-Nutzer namens „Anonymous" – die App hält einen dann für
angemeldet, hat aber keine Rechte. Erkennbar an dieser Zeile im Container-Protokoll:

```
[capabilities] keine Lieder/Abläufe-Rechte geliefert (evtl. ChurchTools-Aussetzer); nicht überbrückt: …
```

→ **Sofort-Abhilfe:** die Website-Daten für die App-Adresse im Browser löschen (oder ein privates
Fenster nutzen) und neu anmelden.
→ **Dauerhaft:** App auf einen Stand mit #381 aktualisieren.

Ob die eigene ChurchTools-Instanz betroffen ist, zeigt ein Aufruf ohne Anmeldung:

```
curl -s https://<instanz>.church.tools/api/whoami
```

Kommt `"id":-1` und `"lastName":"Anonymous"` statt einer 401-Antwort, ist es dieses Verhalten.

### Admin-Funktionen (Gemeindename, Links) fehlen

Das in `.env` hinterlegte Admin-Recht passt nicht zur ChurchTools-Instanz.
→ `ADMIN_PERMISSION` in der `.env` anpassen (Standard: `churchcore:administer persons`) und
die App neu starten (`update.command`/`update.bat` oder `docker compose up -d`).

### Plötzlich wieder auf dem Anmeldebildschirm („Sitzung abgelaufen")

**Das ist normal und gewollt** (seit v2.13.6, #186) – kein Fehler. ChurchTools beendet die Sitzung
nach einer Weile selbst. Früher lud die App dann nichts mehr und „Erneut versuchen" half nicht; nur
Abmelden und neu Anmelden brachte alles zurück. Jetzt erkennt die App das an jeder Stelle und führt
direkt zur Anmeldung.
→ Einfach neu anmelden. Anmerkungen und Einstellungen sind sicher (sie liegen pro Konto auf dem
Server) und sind nach dem Anmelden wieder da.

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
