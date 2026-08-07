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
   `Dockerfile`, eine Compose-Datei aus `deploy/` (für Produktion: `deploy/docker-compose.prod.yml`,
   im Container Manager als `docker-compose.yml` ablegen), `package.json`, `package-lock.json`,
   `client/`, `server/`, `shared/`. **Im Projektstamm liegt KEINE `docker-compose.yml`** – dort gibt es
   nur `docker-compose.dev.yml` (Entwicklung); die produktiven Vorlagen liegen in `deploy/`.

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
2. Projektname + Pfad = der hochgeladene Ordner; die dort als `docker-compose.yml` abgelegte
   Compose-Datei (Kopie aus `deploy/`) wird erkannt. **Projektname exakt `worship-charts`** – der
   Volume-Name ist `<projektname>_<volume-key>`, ein abweichender Name hängt ein neues, LEERES Volume ein.
3. **Erstellen/Starten**. Beim ersten Mal baut er das Image (dauert ein paar Minuten).
4. Logs prüfen: Der `app`-Container sollte „Server läuft …" zeigen.

## 5. Aufrufen & als App installieren

- **Lokal im WLAN:** `http://<NAS-IP>:3001` im Browser öffnen → Login erscheint.
- Auf iPad/iPhone: Teilen-Symbol → **„Zum Home-Bildschirm"** → läuft als PWA im Vollbild.
- Von außen: `https://musik.deine-gemeinde.de`.

---

## 6. Test-Instanz danebenstellen (optional)

Eine zweite Instanz aus `deploy/docker-compose.staging.yml`, um neue Versionen abzunehmen, bevor sie
in Produktion gehen. Sie läuft auf Port **3002** und hat ein eigenes Volume.

**Sie braucht denselben Weg wie die Live-App: eigene Adresse, eigenes Zertifikat, eigener Reverse
Proxy.** Das ist keine Kür (#196): Die Compose-Datei bindet den Port bewusst nur an `127.0.0.1` und
setzt `COOKIE_SECURE` standardmäßig auf `true`. Ohne HTTPS davor ist die Instanz weder erreichbar
noch anmeldbar. Der Grund: **Im Sitzungs-Cookie steckt die ChurchTools-Anmeldung.** Lauscht der Port
im ganzen WLAN und fehlt das Secure-Flag, läuft sie unverschlüsselt durchs Netz.

Die Schritte spiegeln Abschnitt 3, mit drei Unterschieden: anderer Name, anderes Zertifikat,
**Ziel-Port 3002 statt 3001**. Portweiterleitung im Router (80/443) ist schon da.

**6a) DNS:** In eurer Zone einen zweiten Eintrag anlegen – am einfachsten den vorhandenen für die
Live-App ansehen und einen identischen mit dem Namen `musik-test` erstellen (Typ **CNAME**, gleicher
Wert, gleicher abschließender Punkt, gleiche TTL). Danach prüfen:

```bash
nslookup musik-test.deine-gemeinde.de
```

**6b) Zertifikat:** NAS → Systemsteuerung → Sicherheit → Zertifikat → **Hinzufügen** → _Neues
Zertifikat_ → **Von Let's Encrypt**, Domäne `musik-test.deine-gemeinde.de`. Muss **nach** 6a
passieren – Let's Encrypt ruft das NAS über diesen Namen auf.

**6c) Reverse Proxy:** NAS → Anmeldeportal → Erweitert → **Reverse Proxy** → Erstellen.
Quelle: HTTPS, `musik-test.deine-gemeinde.de`, Port 443 → Ziel: HTTP, `localhost`, Port **3002**.

> ⚠️ Die **3002** ist der einzige Unterschied zur Live-App. Ein Zahlendreher führt auf die
> Live-App – und das fällt nicht auf, weil der Bildschirm gleich aussieht.

**6d) Zertifikat zuweisen:** Sicherheit → Zertifikat → **Einstellungen** → Zeile
`musik-test.deine-gemeinde.de` → das neue Zertifikat wählen → Speichern. **Der Schritt, der am
häufigsten vergessen wird** – ohne ihn liefert das NAS sein Standardzertifikat aus.

**6e) Projekt erstellen:** Container Manager → Projekt → Erstellen, Name exakt `worship-charts-test`
(der Volume-Name hängt daran), mit einer eigenen Test-`.env`.

### Nachprüfen, ob die Härtung wirklich greift

Vier Prüfungen, jede unabhängig – die Reihenfolge ist die der wahrscheinlichsten Fehler:

```bash
# 1. Port darf im LAN NICHT mehr antworten
nc -z <NAS-IP> 3002 && echo "offen – Härtung greift nicht" || echo "geschlossen"

# 2. Über HTTPS muss die App trotzdem kommen
curl -s -o /dev/null -w "%{http_code}\n" https://musik-test.deine-gemeinde.de/

# 3. Hängt dahinter die TEST-Instanz? (Version im ausgelieferten Bundle)
curl -s https://musik-test.deine-gemeinde.de/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js'
#    → diese Datei laden und nach 'staging-' suchen; die Live-App meldet stattdessen 'v2.x.y'

# 4. Ist COOKIE_SECURE aktiv? Antwort auf ein absichtlich kaputtes Cookie ansehen
curl -si -H 'Cookie: ct_session=kaputt' \
  https://musik-test.deine-gemeinde.de/api/auth/me | grep -i set-cookie
#    → muss 'Secure' enthalten
```

Prüfung 4 ist die belastbarste: Das `Secure` im Lösch-Cookie ist eine **Antwort des Servers**, die
unmittelbar an der Umgebungsvariablen hängt – das kann kein Zwischenspeicher vortäuschen.

Zum Schluss einmal **anmelden**. Mit `COOKIE_SECURE=true` klappt das nur noch über die HTTPS-Adresse,
nicht mehr über `http://` oder die NAS-IP – genau das ist der Zweck.

> **Wenn die Testseite aus dem WLAN nicht lädt, über Mobilfunk aber schon:** Dann schickt euer Router
> Anfragen aus dem eigenen Netz nicht an die eigene öffentliche Adresse zurück. Abhilfe ist ein
> **lokaler DNS-Eintrag** für `musik-test`, der direkt auf die NAS-IP zeigt. Bei der ECG war das
> nicht nötig – für die Live-Adresse existiert ein solcher Eintrag, für die Test-Adresse nicht, und
> sie ist trotzdem aus dem WLAN erreichbar.

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
  `http://<NAS-IP>:3001/api/auth/me` → `{"authenticated":true,…}` = ok. Das `secure`-Flag des Cookies
  steuert die Env **`COOKIE_SECURE`** (Default `false`): bei reinem HTTP-Betrieb im LAN aus lassen (sonst
  speichert der Browser das Cookie nicht), bei HTTPS-only auf `true` setzen. **ECG-Prod läuft seit
  13.07.2026 mit `COOKIE_SECURE: true`** (Zugang nur über den Synology-Reverse-Proxy).
- `.env` enthält das `SESSION_SECRET` – nicht teilen, nicht einchecken.
