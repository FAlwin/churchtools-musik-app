# Deployment – aus dem Quellcode (Synology NAS + Reverse Proxy)

> Diese Anleitung beschreibt das Bauen **aus dem Quellcode** auf einem Synology-NAS
> (mit Container Manager) als **Beispiel-Setup**. Wer lieber das fertige Image nutzt,
> nimmt **[INSTALL.md](../../INSTALL.md)** – das ist der empfohlene, einfachere Weg.
>
> Alle konkreten Werte unten (`deine-gemeinde.de`, `<NAS-IP>`, DNS-/Router-Anbieter)
> sind **Platzhalter** – durch eure eigenen ersetzen.

Ziel: Die App läuft als Docker-Container auf dem NAS und ist über eine sichere
HTTPS-Adresse erreichbar – intern im WLAN und **extern** unter z. B.
`https://musik.deine-gemeinde.de`.

Der externe Zugang läuft über den **Synology Reverse Proxy** (kein Cloudflare):
ein DDNS-Dienst hält die wechselnde Heim-IP, ein CNAME zeigt auf den DDNS-Host, der
Reverse Proxy reicht HTTPS an den Container auf `localhost:3001` weiter.

Ein Container (`app`) liefert sowohl die Web-App als auch die API aus.

---

## 0. Voraussetzungen
- Synology-NAS mit **Container Manager** (DSM 7) – läuft auf x86-Modellen (auf manchen
  ARM-Modellen nicht verfügbar; dann das fertige Image über INSTALL.md nutzen).
- Zuerst **lokal im WLAN** in Betrieb nehmen, dann optional den **externen Zugang**.

## 1. Projekt auf den NAS legen
1. In DSM die **File Station** öffnen.
2. Im freigegebenen Ordner `docker` einen Unterordner anlegen (z. B. `churchtools-musik-app`).
3. Den **Projektordner** dorthin kopieren (ohne `node_modules`/`.git`). Mindestens nötig:
   `Dockerfile`, `docker-compose.yml`, `package.json`, `package-lock.json`, `client/`, `server/`, `shared/`.

## 2. .env-Datei für die Produktion anlegen
Im Projektordner auf dem NAS eine `.env` erstellen (Vorlage: `.env.example`):
```
CHURCHTOOLS_BASE_URL=https://deine-gemeinde.church.tools
SESSION_SECRET=<langer-zufallsstring>
```
- `SESSION_SECRET`: langer Zufallsstring, z. B. `openssl rand -hex 32`.
- Ohne `CHURCHTOOLS_BASE_URL` startet die App bewusst nicht.

## 3. Externer Zugang über Reverse Proxy
So wird `https://musik.deine-gemeinde.de` erreichbar. Reihenfolge wichtig:

**3a) DDNS (hält die wechselnde Heim-IP):**
- NAS → Systemsteuerung → Externer Zugriff → **DDNS** → Hinzufügen.
- Anbieter z. B. **Synology**, Hostname z. B. `deine-gemeinde.synology.me`. Test muss „Normal" zeigen.

**3b) DNS (CNAME) bei eurem DNS-Anbieter:**
- In eurer DNS-Zone einen Eintrag: Typ **CNAME**, Name `musik`,
  Wert `deine-gemeinde.synology.me.` (**abschließender Punkt!** – sonst hängen manche Anbieter die Zone an).
- ⚠️ Bestehende Einträge (z. B. `@`, `www`, `MX`, `SPF`, `DKIM` für Website/Mail) **nicht** anfassen.

**3c) Portweiterleitung im Router:**
- WAN **443** → `<NAS-IP>:443` (TCP), WAN **80** → `:80` (für die Let's-Encrypt-Prüfung/Renewal).
- ⚠️ Die DSM-Admin-Ports (5000/5001) **nicht** ins Internet weiterleiten.

**3d) Let's-Encrypt-Zertifikat:**
- NAS → Sicherheit → Zertifikat → Hinzufügen → „Von Let's Encrypt", Domäne `musik.deine-gemeinde.de`.

**3e) Reverse Proxy:**
- NAS → Anmeldeportal → Erweitert → **Reverse Proxy** → Erstellen.
- Quelle: HTTPS, `musik.deine-gemeinde.de`, Port 443 → Ziel: HTTP, `localhost`, Port 3001.
- Danach unter **Zertifikat → Einstellungen** dem Dienst `musik.deine-gemeinde.de` das
  Let's-Encrypt-Zertifikat zuweisen (sonst liefert das NAS sein Standardzertifikat → „nicht sicher").

## 4. In Container Manager starten
1. Container Manager → **Projekt** → **Erstellen**.
2. Projektname + Pfad = der hochgeladene Ordner; die `docker-compose.yml` wird erkannt.
3. **Erstellen/Starten**. Beim ersten Mal baut er das Image (dauert ein paar Minuten).
4. Logs prüfen: Der `app`-Container sollte „Server läuft …" zeigen.

## 5. Aufrufen & als App installieren
- **Lokal im WLAN:** `http://<NAS-IP>:3001` im Browser öffnen → Login erscheint.
- Auf iPad/iPhone: Teilen-Symbol → **„Zum Home-Bildschirm"** → läuft als PWA im Vollbild.
- Von außen: `https://musik.deine-gemeinde.de`.

---

## Updates richtig einspielen (wichtig!)
Beim normalen „Erstellen" verwendet Docker manchmal einen alten Zwischenstand (Cache) –
besonders, wenn die Dateien über das Netzwerk kopiert wurden. Wenn ein Update **nicht greift**,
sicheren Weg gehen:
1. Container Manager → **Projekt** → **Aktion → Stoppen**
2. **Aktion → Löschen** (löscht nur Projekt/Container, **nicht** die Dateien; ein Daten-Volume bleibt erhalten).
3. **Projekt → Erstellen** (baut alles frisch, ohne Cache)

## Hinweise / Troubleshooting
- **„Nach Login: nicht angemeldet"** → Session-Cookie kam nicht an. Schnelltest:
  `http://<NAS-IP>:3001/api/auth/me` → `{"authenticated":true,…}` = ok. Das Cookie ist bewusst
  ohne `secure`-Flag gesetzt, damit es auch über HTTP (LAN) gespeichert wird; extern via HTTPS unkritisch.
- `.env` enthält das `SESSION_SECRET` – nicht teilen, nicht einchecken.
