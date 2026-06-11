# Deployment – Churchtools Musik App (Synology NAS + Cloudflare Tunnel)

Ziel: Die App läuft als Docker-Container auf dem NAS und ist über eine sichere
HTTPS-Adresse (Cloudflare Tunnel) erreichbar – auch von unterwegs.

Ein Container (`app`) liefert sowohl die Web-App als auch die API aus.
Ein zweiter Container (`cloudflared`) stellt die Verbindung nach außen her.

---

## 0. Voraussetzungen
- Synology-NAS mit **Container Manager** (DSM 7) – siehe Schritt 1.
- Ein **Cloudflare-Konto** (kostenlos) und eine Domain bei Cloudflare
  (z.B. `ecg-donrath.de`). Die App bekommt dann z.B. `musik.ecg-donrath.de`.

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
TUNNEL_TOKEN=<kommt-aus-schritt-4>
```
- `SESSION_SECRET`: ein langer Zufallsstring (z.B. am Mac im Terminal:
  `openssl rand -hex 32` – die Ausgabe einsetzen).
- `CHURCHTOOLS_LOGIN_TOKEN` wird **nicht** gebraucht (war nur für die Entwicklung).

## 4. Cloudflare-Tunnel erstellen
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
4. Logs prüfen: Der `app`-Container sollte „Server läuft …" zeigen,
   `cloudflared` „Registered tunnel connection".

## 6. Aufrufen & als App installieren
- Im Browser `https://musik.ecg-donrath.de` öffnen → Login-Seite erscheint.
- Auf iPad/iPhone: Teilen-Symbol → **„Zum Home-Bildschirm"** → läuft als PWA im Vollbild.
- Lokal im WLAN alternativ: `http://<NAS-IP>:3001` (ohne HTTPS).

---

## Updates einspielen (später)
Neuen Stand auf den NAS kopieren (Schritt 2) und im Container Manager das
Projekt **neu erstellen/„Build"** auslösen. Die Daten liegen alle in ChurchTools –
der Container selbst hält keine Daten.

## Hinweise
- Der App-Container speichert nichts dauerhaft (Notizen/Markierungen liegen im
  Browser des jeweiligen Geräts; Lieder/Setlisten in ChurchTools).
- Sicherheit: `.env` enthält Geheimnisse (SESSION_SECRET, TUNNEL_TOKEN) – nicht teilen.
