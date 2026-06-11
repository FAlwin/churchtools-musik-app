# Deployment – Churchtools Musik App (Synology NAS + Cloudflare Tunnel)

Ziel: Die App läuft als Docker-Container auf dem NAS und ist über eine sichere
HTTPS-Adresse (Cloudflare Tunnel) erreichbar – auch von unterwegs.

Ein Container (`app`) liefert sowohl die Web-App als auch die API aus.
Ein zweiter Container (`cloudflared`) stellt die Verbindung nach außen her.

---

## 0. Voraussetzungen
- Synology-NAS mit **Container Manager** (DSM 7) – siehe Schritt 1.
- **Empfohlenes Vorgehen:** zuerst **lokal im WLAN** in Betrieb nehmen
  (Schritte 1–3, 5, 6). Der externe Zugang per **Cloudflare-Tunnel** (Schritt 4)
  ist **optional** und braucht eine bei Cloudflare verwaltete Domain – das kann
  später kommen.

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
- `TUNNEL_TOKEN` nur nötig, wenn du den externen Zugang (Schritt 4) einrichtest.

## 4. Cloudflare-Tunnel erstellen *(OPTIONAL – externer Zugang, später)*
Nur nötig, wenn die App auch von außerhalb des WLANs erreichbar sein soll. Setzt
voraus, dass eine Domain bei **Cloudflare** verwaltet wird. Zum Aktivieren danach
in der `docker-compose.yml` beim Dienst `cloudflared` die Zeile `profiles: ['tunnel']`
entfernen und das Projekt neu erstellen.
1. Auf **https://one.dash.cloudflare.com** anmelden → **Networks → Tunnels**.
2. **Create a tunnel** → Typ **Cloudflared** → Namen vergeben (z.B. `worship`).
3. Cloudflare zeigt einen **Token** (langer Text nach `--token `). Diesen Token
   in die `.env` als `TUNNEL_TOKEN=...` eintragen.
4. Unter **Public Hostnames** einen Eintrag anlegen:
   - **Subdomain/Domain:** z.B. `musik` + `ecg-donrath.de`
   - **Service:** `HTTP` → `app:3001`
     (im Docker-Netz erreicht der Tunnel den App-Container unter dem Namen `app`).
5. Speichern.

## 5. In Container Manager starten
1. Container Manager → **Projekt** → **Erstellen**.
2. Projektname `worship-charts`, Pfad = der hochgeladene Ordner; er erkennt die
   `docker-compose.yml` automatisch.
3. **Erstellen/Starten**. Beim ersten Mal baut er das Image (dauert ein paar Minuten).
   Standardmäßig startet nur der `app`-Container (lokal); `cloudflared` nur, wenn
   du den Tunnel aktiviert hast (Schritt 4).
4. Logs prüfen: Der `app`-Container sollte „Server läuft …" zeigen.

## 6. Aufrufen & als App installieren
- **Lokal im WLAN:** `http://<NAS-IP>:3001` im Browser öffnen → Login erscheint.
- Auf iPad/iPhone: Teilen-Symbol → **„Zum Home-Bildschirm"** → läuft als PWA im Vollbild.
- Mit Cloudflare-Tunnel (Schritt 4) zusätzlich von außen: `https://musik.<deine-domain>`.

---

## Updates einspielen (später)
Neuen Stand auf den NAS kopieren (Schritt 2) und im Container Manager das
Projekt **neu erstellen/„Build"** auslösen. Die Daten liegen alle in ChurchTools –
der Container selbst hält keine Daten.

## Hinweise
- Der App-Container speichert nichts dauerhaft (Notizen/Markierungen liegen im
  Browser des jeweiligen Geräts; Lieder/Setlisten in ChurchTools).
- Sicherheit: `.env` enthält Geheimnisse (SESSION_SECRET, TUNNEL_TOKEN) – nicht teilen.
