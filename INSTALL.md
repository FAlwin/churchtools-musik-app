# Installation

Diese Anleitung richtet sich an Gemeinden, die die App **selbst betreiben** möchten.
Sie nutzt das fertige Docker-Image – ein eigener Build ist nicht nötig.

---

## Voraussetzungen

- Eine erreichbare **ChurchTools-Instanz** (eure eigene URL)
- **Docker** auf dem Server oder Computer (Details je nach Option unten)
- Für externen Zugriff: eine eigene (Sub-)Domain

---

## Option A: Lokal auf dem Computer (Mac / Windows / Linux)

Zum Ausprobieren oder für den Zugriff nur im Heimnetz.

### 1. Docker Desktop installieren

→ [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)  
Installieren und starten.

### 2. Dateien herunterladen

Aus dem GitHub-Repo den Ordner [`deploy/`](https://github.com/FAlwin/churchtools-musik-app/tree/main/deploy) öffnen und diese zwei Dateien herunterladen:
- `docker-compose.yml`
- `.env.example`

Beide in einen leeren Ordner legen (z. B. `musik-app/`).

### 3. Konfiguration anlegen

`.env.example` in `.env` umbenennen und öffnen. Zwei Werte eintragen:

```
CHURCHTOOLS_BASE_URL=https://eure-gemeinde.church.tools
SESSION_SECRET=<zufälliger langer String>
```

Den SESSION_SECRET einmalig erzeugen – Terminal öffnen und eingeben:

```bash
openssl rand -hex 32
```

Das Ergebnis kopieren und eintragen.

### 4. App starten

Terminal öffnen, in den Ordner navigieren:

```bash
docker compose pull
docker compose up -d
```

### 5. App öffnen

Browser: **http://localhost:3001**  
Mit ChurchTools-Zugangsdaten anmelden → im „Mehr"-Tab den Gemeindenamen setzen.

---

## Option B: Synology NAS

Für einen dauerhaft laufenden Server im Heimnetz (auch für externen Zugriff geeignet).

### Voraussetzung: Container Manager installieren

Im Synology **Package Center** → „Container Manager" installieren (kostenlos).

### 1. Dateien auf das NAS übertragen

Im Synology **File Station** einen neuen Ordner anlegen, z. B. `docker/musik-app/`.  
Die zwei Dateien (`docker-compose.yml` + `.env.example`) dort hinein kopieren.

### 2. Konfiguration anlegen

`.env.example` in `.env` umbenennen und bearbeiten (File Station → Rechtsklick → Öffnen mit Texteditor).  
Werte eintragen (wie in Option A, Schritt 3).

### 3. App starten – zwei Möglichkeiten

**a) Über SSH (empfohlen):**

SSH im Synology DSM aktivieren (Systemsteuerung → Terminal & SNMP → SSH aktivieren).  
Dann im Terminal verbinden:

```bash
ssh dein-nas-benutzer@192.168.x.x
cd /volume1/docker/musik-app
sudo docker compose pull
sudo docker compose up -d
```

**b) Über die Container Manager GUI:**

Container Manager → Projekt → „Erstellen" → Ordner `musik-app/` auswählen → Starten.

### 4. App öffnen

Browser: **http://nas-ip-adresse:3001** (nur im lokalen Netz).

---

## Externer Zugriff (eigene Domain)

Damit die App sicher aus dem Internet erreichbar ist, braucht ihr eine eigene (Sub-)Domain
und HTTPS. Zwei Wege:

---

### Weg 1: Cloudflare Tunnel (empfohlen)

Kein Port muss im Router geöffnet werden. Funktioniert auch hinter einer Fritzbox.

**Voraussetzung:** Domain bei Cloudflare verwaltet (kostenloser Account genügt).

#### Schritte

1. **Cloudflare-Dashboard** öffnen → Zero Trust → Netzwerk → Tunnel → „Tunnel erstellen"
2. Tunneltyp: **Cloudflared** wählen → Namen vergeben (z. B. `musik-app`)
3. Den angezeigten Installationsbefehl auf dem NAS ausführen (einmalig, installiert `cloudflared`)
4. Im Tunnel eine **Public Hostname** eintragen:
   - Subdomain: z. B. `musik`
   - Domain: eure Domain
   - Service: `http://localhost:3001`
5. Speichern – die App ist jetzt unter `https://musik.eure-domain.de` erreichbar

HTTPS und Zertifikat übernimmt Cloudflare automatisch.

---

### Weg 2: Synology Reverse Proxy + Portfreigabe

Klassischer Weg ohne Cloudflare. Erfordert eine öffentliche IP-Adresse und Zugriff auf den Router.

#### Schritt 1: Port im Router freigeben

Im Router (z. B. Fritzbox) eine Portweiterleitung einrichten:
- Externer Port: **443** (HTTPS)
- Internes Ziel: NAS-IP-Adresse, Port **443**

#### Schritt 2: HTTPS-Zertifikat auf dem NAS

DSM → Systemsteuerung → Sicherheit → Zertifikat → „Hinzufügen"  
→ „Neues Zertifikat von Let's Encrypt" → eure Domain eintragen.

#### Schritt 3: Reverse Proxy einrichten

DSM → Systemsteuerung → Anmeldeportal → Erweitert → Reverse Proxy → „Erstellen":

| Feld | Wert |
|---|---|
| Quellprotokoll | HTTPS |
| Quell-Hostname | `musik.eure-domain.de` |
| Quellport | 443 |
| Zielprotokoll | HTTP |
| Ziel-Hostname | localhost |
| Zielport | 3001 |

Zertifikat dem Reverse Proxy zuweisen → Speichern.

Die App ist nun unter `https://musik.eure-domain.de` erreichbar.

---

## Erster Start in der App

1. Mit euren **ChurchTools-Zugangsdaten** anmelden (Person mit Admin-Recht in ChurchTools)
2. „Mehr"-Tab → **Gemeindename** eintragen
3. Optional: unter „Links verwalten" eigene Links anlegen

---

## Typische Probleme

| Problem | Ursache & Lösung |
|---|---|
| „Nicht angemeldet" trotz Login | Cookie-Problem – nur über HTTPS (Reverse Proxy/Cloudflare) lösen |
| Keine Lieder/Abläufe sichtbar | Fehlende ChurchTools-Rechte für diese Person |
| Admin-Funktionen fehlen | `ADMIN_PERMISSION` in `.env` passt nicht – Wert anpassen |
| Einstellungen nach Update weg | Daten-Volume wurde gelöscht – beim Update Volume behalten (→ [UPDATE.md](UPDATE.md)) |

---

## Updates

Neues Image laden und Container neu starten – Details in [UPDATE.md](UPDATE.md).
