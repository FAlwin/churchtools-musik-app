# Musik App – Installation für eine Gemeinde

> Diese App zeigt die Lieder/Akkorde eurer ChurchTools-Setlist im Gottesdienst an.
> Jede Gemeinde betreibt eine **eigene Instanz** auf dem eigenen Server/NAS und bindet
> ihre eigene ChurchTools-Adresse ein. **Nutzung nur nach Absprache** (siehe `LIZENZ.md`).

Ihr braucht: einen Server oder ein NAS mit **Docker** bzw. **Synology Container Manager**,
eure **ChurchTools-Adresse**, und – für den Zugriff von außen – eine Domain (optional).

---

## Schritt 1 – Zugang zum Programm-Image

Das Image ist **privat**. Ihr bekommt von uns einen persönlichen **GitHub-Zugangstoken**
(„read:packages"). Damit einmalig am Server anmelden:

```bash
docker login ghcr.io -u <euer-github-name> -p <token>
```

(Im Synology Container Manager: Registrierung → GitHub Container Registry `ghcr.io`
mit denselben Zugangsdaten hinzufügen.)

## Schritt 2 – Dateien anlegen

Legt einen Ordner an (z. B. `musik-app`) mit zwei Dateien:

1. `docker-compose.yml` – aus diesem Ordner übernehmen.
2. `.env` – Kopie von `.env.example`, dann ausfüllen:
   - `CHURCHTOOLS_BASE_URL` = eure ChurchTools-Adresse (ohne `/` am Ende).
   - `SESSION_SECRET` = langer Zufallsstring, z. B. `openssl rand -hex 32`.

## Schritt 3 – Starten

```bash
docker compose pull
docker compose up -d
```

(Synology Container Manager: „Projekt" aus dem Ordner anlegen und starten.)

Die App läuft jetzt im Heim-/Gemeindenetz unter `http://<server-ip>:3001`.

## Schritt 4 – Erste Anmeldung & Branding einstellen

1. Im Browser `http://<server-ip>:3001` öffnen und mit einem **ChurchTools-Konto** anmelden.
2. Als **ChurchTools-Administrator**: oben über das Zahnrad **⚙︎ → „Branding (Admin)"**.
3. Name, Kurzname, Logo, Farben und CCLI-Nummer eurer Gemeinde eintragen → **Speichern**.

Das Erscheinungsbild gilt sofort für alle und bleibt auch nach Updates erhalten
(es liegt im Daten-Volume `musik-data`).

## Schritt 5 – Erreichbarkeit von außen (HTTPS) — der anspruchsvollste Schritt

Damit Musiker die App auch unterwegs/zuhause und als App auf dem Handy nutzen können,
braucht ihr eine **verschlüsselte Adresse** (HTTPS). Übliche Wege:

- **Synology Reverse Proxy** (empfohlen am NAS): eigene Subdomain (z. B. `musik.eure-domain.de`)
  → `localhost:3001`, mit Let's-Encrypt-Zertifikat. Ports 80/443 im Router weiterleiten.
- Alternativ ein vorhandener Reverse Proxy (nginx/Traefik) vor dem Container.

Eine ausführliche, an einem echten Synology-NAS erprobte Variante steht in `../DEPLOYMENT.md`.
Dieser Schritt erfordert etwas Netzwerk-Wissen – im Zweifel jemanden mit NAS-Erfahrung dazuholen.

---

## Updates einspielen

```bash
docker compose pull
docker compose up -d
```

Der alte Container wird ersetzt, euer Branding bleibt erhalten (Volume).

## Hinweise

- **Keine Datenbank:** Die App speichert nichts dauerhaft außer dem Branding – alle
  Lieder/Abläufe kommen live aus eurem ChurchTools. Jede Gemeinde ist für ihre Daten selbst
  verantwortlich.
- **Probleme/Fragen:** bei der Stelle melden, die euch den Zugang gegeben hat.
