# Deployment – Churchtools Musik App (Synology NAS + Reverse Proxy)

Ziel: Die App läuft als Docker-Container auf dem NAS und ist über eine sichere
HTTPS-Adresse erreichbar – intern im WLAN und **extern** unter
`https://musik.ecg-donrath.de`.

Der externe Zugang läuft über den **Synology Reverse Proxy** (KEIN Cloudflare):
DDNS hält die wechselnde Heim-IP, ein Hetzner-CNAME zeigt auf den DDNS-Host, der
Reverse Proxy reicht HTTPS an den Container auf `localhost:3001` weiter.

Ein Container (`app`) liefert sowohl die Web-App als auch die API aus.

---

## 0. Voraussetzungen
- Synology-NAS mit **Container Manager** (DSM 7) – siehe Schritt 1.
- **Vorgehen:** zuerst **lokal im WLAN** in Betrieb nehmen (Schritte 1–3, 5, 6),
  dann optional den **externen Zugang** (Schritt 4) einrichten.

---

## 1. Container Manager auf dem NAS prüfen/installieren
1. Im NAS-Browser-Menü (DSM) das **Paket-Zentrum** öffnen.
2. Nach **„Container Manager"** suchen.
   - Ist er installiert → weiter zu Schritt 2.
   - Sonst **Installieren** klicken (braucht etwas Speicher; läuft nur auf
     x86-NAS-Modellen, nicht auf manchen ARM-Modellen – falls nicht verfügbar,
     bitte melden, dann finden wir einen anderen Weg).

## 2. Projekt auf den NAS legen
1. In DSM die **File Station** öffnen.
2. Im freigegebenen Ordner `docker` einen Unterordner `worship-charts` anlegen.
3. Den **gesamten Projektordner** dorthin kopieren (am einfachsten: diesen
   Ordner `~/ecg-donrath/churchtools-musik-app` ohne `node_modules` und ohne
   `.git` als ZIP packen und in der File Station entpacken). Mindestens nötig:
   `Dockerfile`, `docker-compose.yml`, `package.json`, `package-lock.json`,
   `client/`, `server/`, `shared/`.

## 3. .env-Datei für die Produktion anlegen
Im Projektordner auf dem NAS eine Datei `.env` mit diesem Inhalt erstellen
(Vorlage: `.env.example`):
```
CHURCHTOOLS_BASE_URL=https://ecg-donrath.church.tools
SESSION_SECRET=<langer-zufallsstring>
```
- `SESSION_SECRET`: ein langer Zufallsstring (z.B. am Mac im Terminal:
  `openssl rand -hex 32` – die Ausgabe einsetzen).
- `CHURCHTOOLS_LOGIN_TOKEN` wird **nicht** gebraucht (war nur für die Entwicklung).

## 4. Externer Zugang über Synology Reverse Proxy *(umgesetzt 13.06.2026)*
So ist `https://musik.ecg-donrath.de` erreichbar – ohne Cloudflare. Reihenfolge wichtig:

**4a) DDNS (hält die wechselnde Heim-IP):**
- NAS → Systemsteuerung → Externer Zugriff → **DDNS** → Hinzufügen.
- Anbieter **Synology**, Hostname z.B. `ecgdonrath.synology.me`. Test muss „Normal" zeigen.

**4b) DNS bei Hetzner (CNAME):**
- In der DNS-Zone `ecg-donrath.de` einen Eintrag: Typ **CNAME**, Name `musik`,
  Wert `ecgdonrath.synology.me.` (**abschließender Punkt!** sonst hängt Hetzner die Zone an).
- ⚠️ `@`, `www`, `MX`, `SPF`, `DKIM`, `autodiscover` NICHT anfassen (Website + M365-Mail).

**4c) Portweiterleitung im Router (UniFi):**
- WAN **443** → `192.168.10.188:443` (TCP), WAN **80** → `:80` (für Let's-Encrypt-Prüfung/Renewal).
- ⚠️ DSM-Ports **5000/5001 NICHT** weiterleiten (bleiben intern/VPN).

**4d) Let's-Encrypt-Zertifikat:**
- NAS → Sicherheit → Zertifikat → Hinzufügen → „Von Let's Encrypt", Domäne `musik.ecg-donrath.de`.

**4e) Reverse Proxy:**
- NAS → Anmeldeportal → Erweitert → **Reverse Proxy** → Erstellen.
- Quelle: HTTPS, `musik.ecg-donrath.de`, Port 443 → Ziel: HTTP, `localhost`, Port 3001.
- Danach unter **Zertifikat → Einstellungen** dem Dienst `musik.ecg-donrath.de` das
  Let's-Encrypt-Zertifikat zuweisen (sonst liefert das NAS sein Standardzertifikat → „nicht sicher").

## 5. In Container Manager starten
1. Container Manager → **Projekt** → **Erstellen**.
2. Projektname `worship-charts`, Pfad = der hochgeladene Ordner; er erkennt die
   `docker-compose.yml` automatisch.
3. **Erstellen/Starten**. Beim ersten Mal baut er das Image (dauert ein paar Minuten).
4. Logs prüfen: Der `app`-Container sollte „Server läuft …" zeigen.

## 6. Aufrufen & als App installieren
- **Lokal im WLAN:** `http://<NAS-IP>:3001` im Browser öffnen → Login erscheint.
- Auf iPad/iPhone: Teilen-Symbol → **„Zum Home-Bildschirm"** → läuft als PWA im Vollbild.
- Von außen (Schritt 4, Reverse Proxy): `https://musik.ecg-donrath.de`.

---

## Updates einspielen (später)
Neuen Stand auf den NAS kopieren (Schritt 2) und im Container Manager das
Projekt **neu erstellen/„Build"** auslösen. Die Daten liegen alle in ChurchTools –
der Container selbst hält keine Daten.

## Updates richtig einspielen (wichtig!)
Beim normalen „Erstellen" verwendet Docker manchmal einen alten Zwischenstand
(Cache) – besonders, wenn die Dateien über das Netzwerk kopiert wurden. Wenn ein
Update **nicht greift**, sicheren Weg gehen:
1. Container Manager → **Projekt** → `worship-charts` → **Aktion → Stoppen**
2. **Aktion → Löschen** (löscht nur Projekt/Container, **nicht** die Dateien).
   Auf unserem NAS wird dabei das Image `worship-charts-app:latest` **automatisch
   mitgelöscht** – ein separater Image-Löschschritt ist also nicht nötig.
3. **Projekt → Erstellen** (baut alles frisch, ohne Cache)

## Hinweise / Troubleshooting
- Der App-Container speichert nichts dauerhaft (Notizen/Markierungen liegen im
  Browser des jeweiligen Geräts; Lieder/Setlisten in ChurchTools).
- Sicherheit: `.env` enthält Geheimnisse (SESSION_SECRET) – nicht teilen.
- **„Nach Login: Gottesdienste konnten nicht geladen werden"** → Session-Cookie kam
  nicht an. Schnelltest im Browser: `http://<NAS-IP>:3001/api/auth/me`
  → `{"authenticated":true,...}` = ok; `false` = Cookie-Problem. Das Cookie ist
  bewusst ohne `secure`-Flag gesetzt, damit es auch über HTTP (LAN) gespeichert wird.
