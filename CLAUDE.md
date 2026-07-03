# CLAUDE.md – Churchtools Musik App (Worship Charts)

> Dieses Dokument ist die verbindliche Referenz für alle
> Entwicklungssessions in diesem Projekt. Immer zuerst lesen!
> **Grober Fahrplan: `docs/entwicklung/PROJEKTPLAN.md`** · Architektur-Entscheidungen:
> `docs/entwicklung/entscheidungen.md` · Testkonzept: `docs/entwicklung/testkonzept.md` ·
> Konfig/Umgebungen: `docs/entwicklung/konfigurationsmanagement.md` ·
> API des Backends: `docs/entwicklung/api-referenz.md`.
> Release-Notes: `CHANGELOG.md`. Granulare Aufgaben/Bugs: GitHub Issues + Projects-Board.
> **Vor jedem Release: Release-Routine unten beachten.**

## Projektübersicht
- **Was:** Progressive Web App (PWA), die Chord Charts der aktuellen Setlist aus ChurchTools
  abruft, automatisch auf die hinterlegte Tonart transponiert und im Gottesdienst anzeigt.
  Ersetzt WorshipTools Charts. ChurchTools bleibt einzige Datenquelle.
- **Für wen:** Worship-Team der ECG Donrath (Musiker + Bandleiter), oft wenig technikaffin.
- **Status:** Fertig & produktiv – auf dem Synology-NAS deployt, intern im WLAN **und**
  extern unter `https://musik.ecg-donrath.de` live (Stand 13.06.2026).
- **Repository:** öffentliches GitHub-Repo `FAlwin/churchtools-musik-app` (origin/main), MIT-Lizenz.

## Tech-Stack
| Bereich        | Technologie                        |
|----------------|------------------------------------|
| Frontend       | React + Vite + TypeScript (PWA)    |
| Styling        | SCSS Modules                       |
| Datenfetching  | TanStack Query                     |
| Formulare      | React Hook Form + Zod              |
| Backend        | Node.js + Express + TypeScript     |
| Datenbank      | keine – ChurchTools ist Datenquelle; Anmerkungen/Einstellungen pro Konto als JSON auf dem Volume (`ANNOTATIONS_PATH`), localStorage als Cache |
| Validierung    | Zod (serverseitig)                 |
| Deployment     | Docker auf Synology NAS (Container Manager) |
| Externer Zugang| Synology Reverse Proxy + DDNS + Let's Encrypt (KEIN Cloudflare) |
| Tests          | Vitest (Unit, nur reine Logik in `client/src/utils`) |
| CI             | GitHub Actions: lint + build + test je PR |

## Ordnerstruktur
Monorepo mit npm-Workspaces:
```
churchtools-musik-app/
├── client/                  # React + Vite PWA
│   ├── public/              # statische Assets (logo.png, PWA-Icons)
│   └── src/
│       ├── components/      # wiederverwendbare UI-Komponenten (+ *.module.scss)
│       ├── pages/           # Screens: Login, Agenda, Setlist, ChordChart
│       ├── hooks/           # Geschäftslogik (Custom Hooks)
│       ├── services/        # API-Kommunikation (alle fetch-Aufrufe + TanStack Query)
│       ├── utils/           # reine Hilfsfunktionen: chordpro.ts, transpose.ts
│       ├── types/           # client-spezifische Typen
│       ├── styles/          # _variables.scss, main.scss
│       └── assets/          # Bilder, Icons, Fonts
├── server/                  # Express-Proxy zu ChurchTools
│   └── src/
│       ├── routes/          # nur Routing
│       ├── controllers/     # Request/Response-Handling
│       ├── services/        # Geschäftslogik (churchtools.ts) – HTTP-unabhängig
│       ├── middleware/      # errorHandler, Auth, Rate-Limit
│       ├── types/           # server-spezifische Typen
│       └── utils/           # Hilfsfunktionen
└── shared/types/            # geteilte Typen (Service, SetlistSong, Setlist, …)
```

## Konventionen

### Allgemein
- TypeScript überall – kein `any` ohne Kommentar und Begründung
- Zentrale/geteilte Typen in `shared/types/` – niemals lokal duplizieren
- Commits auf Deutsch mit Conventional-Commit-Präfix (`feat:`/`fix:`/`docs:`/`ui:`/`chore:`),
  klein und präzise; pro abgeschlossenem Teilschritt ein Commit

### Frontend
- Komponenten: PascalCase (`ChordChart.tsx`)
- Hooks: camelCase mit use-Prefix (`useSetlist.ts`)
- Services: camelCase (`churchtoolsApi.ts`)
- Styles: `Component.module.scss` – eine Datei pro Komponente
- Globale Variablen nur aus `src/styles/_variables.scss`
- API-Calls ausschließlich über `services/` + TanStack Query
- Keine Geschäftslogik in Komponenten (→ in `hooks/`)
- Keine Inline-Styles, außer für dynamische Laufzeitwerte
  (Schriftgröße, Akkordfarbe, Canvas-Position)

### Backend
- Routen enthalten keine Geschäftslogik
- Geschäftslogik gehört ausschließlich in `services/`
- Jede Route validiert Input mit Zod vor der Verarbeitung
- Fehlerbehandlung zentral in `middleware/errorHandler.ts`
- ChurchTools-Login-Daten verlassen den Browser nicht dauerhaft –
  Session läuft serverseitig, Client bekommt signiertes httpOnly-Cookie

### Sicherheit
- Secrets ausschließlich über `.env`
- `.env` wird nie committet – nur `.env.example` mit Platzhaltern
- `npm audit` regelmäßig ausführen

## Design & Branding (feste ChurchTools-Version)
Das frühere White-Label (Farb-/Logo-Anpassung pro Gemeinde) wurde **zurückgebaut**: Die App ist eine
**feste ChurchTools-Version** mit eigenem Schallwellen-Logo. Aussehen = ChurchTools-Designsprache
(helle gruppierte Listen auf Grau, **blaue** Primärfarbe `#0061A1`, System-Font, untere Tab-Bar,
Light/Dark). Alle Design-Tokens in `styles/_variables.scss` (Single Source); `applyBranding.ts` setzt
**keine** Laufzeit-Farben mehr. Logo-Assets in `client/public/` (`logo-rund-hell/-dunkel.png`,
`icon-192/512.png`, `favicon.svg`); PWA-Manifest ist **statisch** (`public/manifest.webmanifest`).

**Einziger anpassbarer Wert:** der **Gemeinde-Name** (`orgName`) – ein ChurchTools-**Admin** ändert ihn
im Mehr-Tab (`pages/Settings.tsx`, `PUT /api/site-config`); persistiert in `site.json` (Volume,
`SITE_CONFIG_PATH`). Admin-Recht über `ADMIN_PERMISSION` (Default `churchcore:administer persons`).
`SiteConfig` (`shared/types`) ist auf `{ appName(fest), description(fest), orgName }` geschrumpft.

**Navigation:** untere Tab-Bar `Termine`/`Lieder`/`Mehr` (`components/TabBar.tsx`), Detailseiten
(Setlist, Chart) als Vollbild-Push. Routing in `App.tsx` über `tab` + `view` (rechteabhängig).

**Design-Regeln (verbindlich):** `docs/entwicklung/design-system.md` – Farben nur über Tokens (es gibt **kein**
`--orange`/`--teal`/`--chord`; Akzent = Blau, Destruktiv = Rot), System-Font, gemeinsame Bausteine
(SCSS-Mixins `styles/_mixins.scss`, `<Segment>`, `Icon`/Line-Icons statt Emojis).

## Akkord-Ansicht: durchgehender Seiten-Strom + Anmerkungen
Die Akkord-Ansicht ist **kein** Live-HTML-Chart mehr, sondern ein **Seiten-Strom aus Canvas-Seiten**.
`utils/chordPdf.ts` baut aus ChordPro ein A4-PDF (SongSelect-Look, alles schwarz, Logo oben rechts);
`generateSetlistPdfWithOwners` erzeugt daraus **eine** kombinierte PDF + `owners[]` (welche Seite zu
welchem Lied/Seite/Version gehört).

`hooks/useSetlistPages.ts` fügt daraus + aus **hochgeladenen Dokumenten** (PDF/Bild) **einen
durchgehenden Strom** zusammen: je Lied steuert – nach `viewSource` – entweder seine Akkord-Seiten
**oder** sein gewähltes Dokument bei (Dokument-Canvas je Datei-ID gecacht). Ergebnis: `pages[]`
(Canvas) + erweiterte `owners[]` (`kind: 'chord' | 'doc'`).
`components/PageDeck.tsx` ist die **gemeinsame 2-Seiten-Engine**, die diesen Strom rendert (pdf.js/
Bild → Canvas): Hochformat 1 Seite, **Querformat 2 Seiten nebeneinander** über Liedgrenzen, je Seite
eigener Zoom. `StreamView`/`DocumentView` gibt es nicht mehr (durch PageDeck ersetzt).
Blättern schiebt horizontal ein (Slide-Übergang). *(Live-Chart-Reste `useDrawing.ts`/
`usePagedColumns.ts`/`constants.ts` wurden früher entfernt.)*

**Gesten:** **ein Finger blättert, zwei Finger zoomen + verschieben** (auch im Zeichenmodus – ein
begonnener Strich wird bei Zweitfinger verworfen; Apple Pencil zeichnet, Finger zoomen). Pinch zoomt
und **speichert automatisch** (kein „Fertig"-Modus); Zurücksetzen über den Knopf in der Kopfleiste.
Im 2-up ist beim Anmerken nur die **aktive** Seite beschreibbar (die andere ausgegraut/gesperrt).

**Anmerkungen** kapselt `hooks/usePageDraw.ts` **pro Seite**: Striche (Stift/Marker/Radierer) auf einer
Anno-Canvas + Textfelder + **Rückgängig/Wiederholen**. Text wird **inline direkt auf der Seite**
bearbeitet (Tipp = Cursor an der Stelle; außerhalb tippen legt fest; Tipp auf Text = auswählen,
nochmal = bearbeiten, ziehen = verschieben, Ecken-Ziehknopf = Größe). Marker als **eine**
halbtransparente Linie (Schnappschuss-Technik). Werkzeugleiste `components/DrawToolbar.tsx`:
Farbknopf mit Aufklapp-Palette, vier Farben (Rot/Blau/Grün/Orange) + freier Picker; Größenanzeige
in „pt" (intern cqh).

**Speicherung pro Konto (Server, geräteübergreifend):** Anmerkungen + Zoom laufen über
`services/annotations.ts` (localStorage = Cache, debounced Push, Pull beim Laden/Rückkehr/30 s; Pull
überspringt Seiten mit noch nicht hochgeladener **oder gerade laufender** Änderung; ausstehende
Uploads werden beim App-Verlassen sofort via `keepalive` geschickt). Pro-Lied-Einstellungen über
`services/userSettings.ts`. **Schlüssel** je Eintrag: `song<id>_v<versionKey>_<seite>` (Zoom zusätzlich
`_d<geräteklasse><spalten>`, z. B. `_dlarge2`; **`KEY_RE` in `annotations.ts` UND die Server-Zod-Regel
müssen diese Layout-Ziffer erlauben** – sonst wird der Querformat-Zoom nicht gesynct; Regressionstest
`annotations.keys.test.ts`). Dokument-Anmerkungen nutzen `worship_docdraw_<fileId>_<seite>`.
Geräteklasse `phone` vs `large` via `utils/deviceClass.ts`. Versions-Helfer: `utils/songVersions.ts`.

## Domänen-Besonderheiten
- **ChordPro:** zwei Dialekte unterstützen – Standard (`{start_of_verse}`) UND
  SongSelect (`{comment: Vers}`, optionale Akkorde `[(E)]`, Bass-Akkorde `[E/G#]`)
- **Transponieren:** Original-Tonart aus der .chordpro-Datei, Ziel-Tonart aus dem
  ChurchTools-Arrangement-Feld; manuelles Transponieren nur lokal, kein Zurückschreiben
- **CCLI:** Lizenznummer 2395145, SongSelect Premium; CCLI-Infos pro Song anzeigen
- **Farben:** Primär Blau `#0061A1`, Destruktiv Rot `#B22247`; Akkorde im Chart schwarz/fett
  (SongSelect-Stil). Details: `docs/entwicklung/design-system.md`

## Tests & CI
- **Befehle:** `npm test` (alle), `npm run test:cov` (Coverage), im Client
  `npm run test:watch`.
- **Umfang (bewusst schlank):** Vitest-Unit-Tests nur für die kniffligste reine Logik –
  `client/src/utils/transpose.ts` (Transponieren) und `chordpro.ts` (zwei Dialekte).
  Kein API/E2E: UI + Proxy werden manuell geprüft (Begründung: `docs/entwicklung/testkonzept.md`).
- **CI:** `.github/workflows/ci.yml` läuft `lint` + `build` + `test` bei jedem PR
  und Push auf `main`. Kein DB-Service nötig.
- **Regel:** Jeder Bug → Issue (Vorlage „Fehlerbericht"); betrifft er reine Logik,
  zusätzlich ein Regressionstest.

## Security-Checkliste
- [x] .env + .gitignore korrekt eingerichtet
- [x] Zod-Validierung auf allen API-Routen
- [x] helmet eingerichtet
- [x] express-rate-limit eingerichtet (zusätzlich striktes Limit am Login)
- [x] Öffentliches Repo unter MIT-Lizenz (`FAlwin/churchtools-musik-app`); keine Secrets im Code/in der Historie (`.env` nie eingecheckt)
- [x] Authentifizierung: persönlicher ChurchTools-Login, Session in signiertem httpOnly-Cookie
- [x] HTTPS extern via Synology Reverse Proxy + Let's Encrypt (`musik.ecg-donrath.de`)
- [x] npm audit: zuletzt geprüft am 11.06.2026 – 3 moderate (esbuild/vite,
      nur Dev-Server, kein Prod-Risiko; Fix = vite@8 Breaking Change, zurückgestellt)

## Deployment
- **Synology NAS via Docker** (Container Manager, Projekt `worship-charts`) → **umgesetzt & live**.
- **docker-compose.yml + Dockerfile:** vorhanden; ein Container liefert API + App aus (Port 3001).
- **Intern (WLAN):** `http://<NAS-IP>:3001`.
- **Extern (HTTPS):** `https://musik.ecg-donrath.de` über **Synology Reverse Proxy** → `localhost:3001`,
  DNS via DDNS (`<euer-ddns>.synology.me`) + CNAME, Zertifikat Let's Encrypt,
  Portweiterleitung 443/80 im Router (DSM-Admin-Ports bleiben zu). **Kein Cloudflare.**
- **Anleitung (hostende Gemeinden):** `INSTALL.md` (image-basiert, empfohlen) + `UPDATE.md`.
  Build-aus-Quellcode-Variante: `docs/betrieb/DEPLOYMENT.md`.
- **Images:** `.github/workflows/staging.yml` baut bei jedem Push (main/feature/**) ein `:staging`-Image
  (amd64) nach GHCR; `release.yml` baut bei Tag `vX.Y.Z` Multi-Arch mit den Tags `vX.Y.Z`, `X.Y`,
  **`X` (Major, z. B. `2`)** und `latest`.
- **Test-Instanz (Auto-Deploy):** `deploy/docker-compose.staging.yml` (`worship-charts-test`, Port 3002,
  `:staging`, Scope `worship-test`, 60 s) zieht automatisch – über den **gepflegten Watchtower-Fork
  `nickfedor/watchtower`** (Original `containrrr` ist unmaintained / Docker-29-inkompatibel).
- **Prod-Instanz (bewusstes Update, seit v2.2.0):** `deploy/docker-compose.prod.yml` (`worship-charts`,
  Port 3001) ist auf **`:2` gepinnt** und hat **keinen Auto-Pull mehr**. Auf neue Versionen weist das
  In-App-Update-Banner hin; aktualisiert wird bewusst per `docker compose pull && up -d` (SSH) bzw.
  im Container Manager. Volume (`worship-data`) beim Neu-Erstellen behalten.
- **Gemeinden:** `deploy/docker-compose.yml` ist auf `:2` gepinnt; Update per `update.command`/`update.bat`.
- **Env (Volume `/app/data`):** `SITE_CONFIG_PATH=/app/data/site.json`,
  `ANNOTATIONS_PATH=/app/data/annotations` (kontobezogene Anmerkungen/Einstellungen) – beim Re-Deploy
  Volume behalten.

## Release-Routine (JEDES Mal vor einem Tag durchgehen)
Diese Checkliste wird **bei jedem Release** abgearbeitet – nichts überspringen. Am bequemsten über
den Skill `/festhalten`, der genau das automatisiert.

1. **Code grün:** `npm run lint` + `npm run build` + `npm test` laufen sauber durch.
2. **Doku & Struktur aktuell:** Root enthält nur das Nötigste (`README.md`, `INSTALL.md`,
   `UPDATE.md`, `CHANGELOG.md`, `LICENSE`, `CLAUDE.md`); alles andere liegt geordnet in
   `docs/{betrieb,entwicklung,archiv}/`. Keine veralteten Aussagen, keine toten Verweise
   (z. B. auf gelöschte Dateien), keine Doppelungen (Changelog/API nur an einer Stelle).
3. **Installations-Anleitung gegen die Realität prüfen:** `INSTALL.md` + `UPDATE.md` +
   die Setup-/Update-Skripte in `deploy/` müssen zum tatsächlichen Vorgehen passen.
4. **CHANGELOG pflegen:** Abschnitt `[Unreleased]` mit den Änderungen seit dem letzten Tag füllen
   und auf die neue Version (`## [X.Y.Z] – Datum`) hochziehen. Versionierung nach SemVer.
5. **Taggen:** `git tag vX.Y.Z && git push origin vX.Y.Z` → CI baut `:latest` + `:X.Y` + `:X`
   (Major-Tag, damit Gemeinden sicher auf `:2` bleiben können). Prod-Deploy bewusst, nicht nebenbei.
6. **Memory aktualisieren:** Projekt-Memory + `MEMORY.md`-Index auf den neuen Stand bringen.

## Changelog
Release-Notes & Versionshistorie: siehe `CHANGELOG.md` (Single Source – hier nicht doppelt pflegen).

## So startest du die App lokal
```
cd ~/ecg-donrath/churchtools-musik-app
npm install        # einmalig
npm run dev:client # Frontend (Mock-Daten) -> http://localhost:5173
npm run dev:server # Backend (Health-Endpoint) -> http://localhost:3001
```

## Stand & nächster Schritt
- **Fertig & produktiv:** App funktional vollständig (Charts + automatisches Transponieren,
  ChordPro-Editor, Dokumenten-Viewer, kompletter Ablauf + Bearbeiten, „Alle Lieder" mit
  Statistik, rechtebewusste UI). Auf dem NAS deployt (Container Manager, `worship-charts`),
  **intern** `http://<NAS-IP>:3001` und **extern** `https://musik.ecg-donrath.de` live.
- **Redesign live (19.06.2026):** ChurchTools-Look ist auf `main`, getestet (44 Tests) und
  **produktiv** unter `https://musik.ecg-donrath.de`.
- **Test-Instanz dauerhaft (seit 25.06.2026):** `worship-charts-test` (`:3002`) läuft image-basiert
  mit **Auto-Deploy** (Staging-Image) – Abnahme neuer Features vor dem Prod-Release.
- **Verteilung an andere Gemeinden:** abgeschlossen (öffentliches Repo, MIT, GHCR-Images, `deploy/`-Paket
  mit Setup-Skripten). Selbst-Hosting-Anleitung: `INSTALL.md` + `UPDATE.md`.
- **Offen / optional:** Musik-Abwesenheitsplaner nachbauen (separates Projekt); Offline-Reserve
  (Issue #32, Plan `docs/entwicklung/plan-offline-reserve.md`).

## Deployment-Stand (NAS) – wichtige Lernpunkte
- Prod läuft image-basiert (GHCR) im Container Manager (Projekt `worship-charts`, Port 3001).
  **Updates kommen automatisch** (kein manuelles Code-Kopieren / Rebuild mehr) – siehe „Auto-Deploy" oben.
- Prod-`.env` auf dem NAS: `CHURCHTOOLS_BASE_URL` + `SESSION_SECRET` (**kein** Login-Token!).
- **Cookie bewusst ohne `secure`-Flag:** LAN läuft über HTTP; mit `secure` speichert der Browser
  das Session-Cookie nicht → „nicht angemeldet" nach Login. `trust proxy` ist in Prod gesetzt.
- **Daten-Volume behalten:** `worship-data:/app/data` hält `site.json` (Gemeindename) + Anmerkungen.
  Beim Neu-Erstellen des Projekts das Volume behalten – sonst fallen die Werte auf Defaults zurück.
- **Bekannte Datenlücke:** Nicht alle Arrangements haben eine `.chordpro`-Datei (manche nur
  `.sng`/`.txt`) → Frontend zeigt dann „keine Akkord-Datei hinterlegt".

## API des eigenen Backends
Vollständige Endpunkt-Referenz: `docs/entwicklung/api-referenz.md`.

## ChurchTools-Schreibzugriff Ablauf – Eigenheiten (verifiziert 12.06.2026, Event 1500)
- **Umsortieren:** `PUT /api/events/{id}/agenda` mit `{items:[…]}` (ganze Liste, position = Index).
- **Einzelpunkt:** `PUT /…/agenda/items/{id}` (Titel/Notiz/responsible) – ignoriert `position`.
- **`responsible` als String** senden (Text), nicht als Objekt – Personen bleiben erhalten.
- **KRITISCH Lied-Punkte:** Verknüpfung als **top-level `arrangementId`**, NICHT verschachteltes
  `song:{…}` – sonst stuft CT den Punkt unwiderruflich auf `text` herab.
- **Text↔Lied umwandeln (verifiziert 14.06., Event 776):** `PUT` mit `type:'song'` + top-level
  `arrangementId` macht aus einem `text`-Punkt sauber ein Lied; `PUT` mit `type:'text'` ohne
  `arrangementId` löst die Verknüpfung wieder (Titel bleibt). Kein Downgrade.
- **`responsible` ist ein TEXTFELD (max 1000 Zeichen), KEIN Personen-Objekt** (Objekt → 400).
  Dienst-Tokens wie `[Musik]`/`[Predigt]` als Text senden – CT expandiert sie selbst zu den im
  Dienstplan zugewiesenen Personen (`persons[]`, `person:null` solange unbesetzt → CT zeigt rote `?`).
  Dienst-Liste: `GET /api/services` (id, name). Personen-Objekte lassen sich hier NICHT schreiben.
- Payload immer aus **frischen Live-Daten** bauen (Backup-Daten → 422). CSRF-Token nötig.
- **Uhrzeit ausblenden (das „Auge", verifiziert 26.06.2026):** `POST /…/agenda/items/{id}/hide`
  bzw. `/unhide` (leerer Body, HTTP 204). Der Zustand steht NICHT in `start` (bleibt immer gefüllt!),
  sondern in **`startTimes[eventId]`**: `null` = ausgeblendet, sonst die Zeit. Beim Lesen die Uhrzeit
  IMMER aus `startTimes[eventId]` ableiten, nicht aus `start`. Diagnose-Skript: `server/scripts/probe-agenda-hidden.ts`.
- **Rechte „Liederbuch für alle Mitglieder":** CT-Rolle braucht „Veranstaltungen sehen (view)"
  + „Einzelne Song-Kategorien sehen (view songcategory)" – sonst nichts. Kein Service-Konto nötig.

## Schreibzugriff (Editor) – ChurchTools-Eigenheiten
- Schreibende Calls brauchen ein CSRF-Token (`GET /api/csrftoken`) + Session-Cookie.
- Upload: `POST /api/files/song_arrangement/{arrId}` multipart, Feld `files[]`.
- Löschen: `DELETE /api/files/{fileId}` (fileId aus der fileUrl `?…id=` extrahiert).
- Versionen werden als separate `"<Titel> — <Name> (ECG).chordpro"` gespeichert (Original bleibt
  unangetastet); abwärtskompatibel zu alt `"— Bearbeitet.chordpro"`/`"— ECG.chordpro"` (Name „Bearbeitet").
  Erkennung/Slug in `server/src/services/setlistBuilder.ts` (`versionNameOf`, `versionSlug`).
- Rechte regelt ChurchTools (403 → Hinweis im Editor). Verifiziert an Test-Lied „Treu" (songId 21).
- Datei-Download braucht die volle fileUrl (nur `id` reicht nicht); Browser lädt nur über den Proxy.

## ChurchTools-API – bestätigtes Datenmodell (11.06.2026, Instanz v3.133.0)
Erkundet mit `server/scripts/probe-*.ts` (persönlicher Login-Token, nur lesend).

- **Gottesdienste:** `GET /api/events?from=YYYY-MM-DD&to=YYYY-MM-DD`
  (kommende Events haben oft noch KEINE Agenda – die wird erst kurz vorher angelegt)
- **Setlist:** `GET /api/events/{id}/agenda` → `data.items[]`; Song-Items haben `item.song`:
  `{ songId, arrangementId, title, arrangement, category, key, bpm, isDefault }`
  → **`item.song.key` = Ziel-Tonart für diesen Gottesdienst**
- **Song/Arrangement:** `GET /api/songs/{id}` → `arrangements[]` mit
  `key` / `keyOfArrangement` (Standardtonart), `bpm`, `beat`, `tempo`, `files[]`
- **Dateien:** `arrangements[].files[]` – Formate `.chordpro` (SongSelect-Dialekt!),
  `.txt`, `.sng` (SongBeamer), `.pdf`. `.chordpro` ist das richtige für uns.
  `file.fileUrl` ist eine `?q=public/filedownload&id=…`-URL.
- **Datei-Download (wichtig):** Der `Authorization: Login <token>`-Header funktioniert für
  `/api/*`, aber NICHT für `public/filedownload` (Redirect-Loop). Lösung: mit
  `GET /api/whoami?login_token=<token>` ein Session-Cookie holen, dann die Datei mit
  diesem Cookie laden. Im Backend (Schritt 7) hält der Proxy ohnehin die Session.
- **Original- vs. Ziel-Tonart:** `.chordpro` enthält `{key:}` (Original) → transponieren auf
  `item.song.key` (Ziel aus der Agenda).
- **2-Faktor:** kein Problem – Login-Token-Zugriff klappt.

## Offene Punkte (optional)
- [x] Login-Token aus lokaler Dev-`.env` entfernt (14.06.2026) – in ChurchTools noch widerrufen
- [x] Test-Service-Konto/Token #1012 in ChurchTools gelöscht (14.06.2026)
- [x] White-Label (Farb-Anpassung) verworfen → feste CT-Version (Redesign live, 19.06.2026)
- [x] Verteilung an andere Gemeinden (Selbst-Hosting) – abgeschlossen (öffentlich, MIT, `INSTALL.md`)
- [ ] Offline-Reserve (Issue #32, Plan `docs/entwicklung/plan-offline-reserve.md`)
- [ ] Musik-Abwesenheitsplaner (separate Flask-App) in diese App nachbauen
