# Installation (für andere Gemeinden)

Diese Anleitung richtet sich an Gemeinden, die die App **selbst betreiben** möchten. Sie nutzt
das fertige Docker-Image – ein eigener Build ist nicht nötig.

## Voraussetzungen

- Ein Server, der **Docker** + **Docker Compose** ausführt (z. B. ein NAS mit Container-Funktion).
- Eine erreichbare **ChurchTools-Instanz** (eure eigene).
- Idealerweise eine **eigene (Sub-)Domain** + HTTPS für den externen Zugang (über einen Reverse
  Proxy). Im lokalen Netz geht es zur Not auch ohne.

## 1. Verteilpaket holen

Aus diesem Repository den Ordner **`deploy/`** verwenden. Er enthält:

- `docker-compose.yml` – verweist auf das fertige Image
- `.env.example` – Vorlage für eure Konfiguration

Beide Dateien in einen leeren Ordner auf eurem Server legen.

## 2. Konfiguration anlegen (`.env`)

`.env.example` nach `.env` kopieren und ausfüllen:

```bash
cp .env.example .env
```

| Variable | Pflicht | Bedeutung |
|---|---|---|
| `CHURCHTOOLS_BASE_URL` | ✅ | URL eurer ChurchTools-Instanz, **ohne** abschließenden Slash, z. B. `https://eure-gemeinde.church.tools` |
| `SESSION_SECRET` | ✅ | Langer Zufallsstring zum Signieren des Login-Cookies. Erzeugen mit: `openssl rand -hex 32` |
| `ADMIN_PERMISSION` | optional | ChurchTools-Recht (Form `modul:recht`), das als „Administrator" gilt (schaltet Gemeindename + Links frei). Standard: `churchcore:administer persons` |

> **Wichtig:** Ohne `CHURCHTOOLS_BASE_URL` startet die App bewusst **nicht** – das verhindert,
> dass eine fehlkonfigurierte Instanz versehentlich mit einem fremden ChurchTools redet.

## 3. Image laden & starten

```bash
docker compose pull
docker compose up -d
```

Die App lauscht im Container auf Port **3001** (im `docker-compose.yml` auf den Host gemappt).
Erreichbarkeit prüfen: `http://<server-ip>:3001`

> Falls beim `pull` ein Zugriffsfehler erscheint: Das Image liegt in der GitHub Container Registry
> (`ghcr.io/falwin/churchtools-musik-app`). Ist es öffentlich, braucht ihr keinen Login; andernfalls
> meldet euch einmal mit einem GitHub-Token (`read:packages`) an: `docker login ghcr.io`.

## 4. Externer Zugang (Reverse Proxy + HTTPS)

Für den Zugriff von außen bindet ihr die App hinter einen **Reverse Proxy** mit HTTPS
(z. B. Synology Reverse Proxy, Nginx, Traefik):

- Eure (Sub-)Domain → `localhost:3001` weiterleiten
- Ein gültiges TLS-Zertifikat (z. B. Let's Encrypt) zuweisen
- Der Proxy sollte die üblichen `X-Forwarded-*`-Header setzen (die App vertraut dem Proxy in Produktion)

HTTPS wird empfohlen – einige Funktionen (z. B. „Display aktiv halten") brauchen einen sicheren Kontext.

## 5. Erster Start in der App

1. Mit euren **ChurchTools-Zugangsdaten** anmelden (eine Person mit dem oben gesetzten Admin-Recht).
2. In den **„Mehr"-Tab** wechseln → **Gemeindename** setzen.
3. Optional unter **„Links verwalten"** eigene Links anlegen (Text + Adresse, je Link wählbar, ob er
   auch auf der Login-Seite erscheint).

Mitglieder sehen nur das, wozu ihre ChurchTools-Rechte passen – die App erzwingt keine eigenen Rollen.

## Typische Stolpersteine

- **„Nicht angemeldet" trotz Login:** Cookie-Problem. Über HTTPS (Reverse Proxy) lösen; im reinen
  HTTP-LAN kann der Browser das Cookie ablehnen.
- **Keine Lieder/Abläufe sichtbar:** Es fehlen ChurchTools-Rechte. Wer Inhalte sehen soll, braucht in
  ChurchTools die passenden Lese-Rechte (Veranstaltungen/Song-Kategorien).
- **Admin-Funktionen fehlen:** Das in `ADMIN_PERMISSION` gesetzte Recht passt nicht zu eurer Instanz –
  Wert anpassen.
- **Einstellungen nach Update weg:** Das Daten-Volume wurde gelöscht. Beim Update das Volume behalten
  (siehe [UPDATE.md](UPDATE.md)).
