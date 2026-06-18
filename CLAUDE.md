# CLAUDE.md – Churchtools Musik App (Worship Charts)

> Dieses Dokument ist die verbindliche Referenz für alle
> Entwicklungssessions in diesem Projekt. Immer zuerst lesen!
> **Grober Fahrplan: `PROJEKTPLAN.md`** · Architektur-Entscheidungen:
> `docs/entscheidungen.md` · Testkonzept: `docs/testkonzept.md` ·
> Konfig/Umgebungen: `docs/konfigurationsmanagement.md`.
> Granulare Aufgaben/Bugs: GitHub Issues + Projects-Board.

## Projektübersicht
- **Was:** Progressive Web App (PWA), die Chord Charts der aktuellen Setlist aus ChurchTools
  abruft, automatisch auf die hinterlegte Tonart transponiert und im Gottesdienst anzeigt.
  Ersetzt WorshipTools Charts. ChurchTools bleibt einzige Datenquelle.
- **Für wen:** Worship-Team der ECG Donrath (Musiker + Bandleiter), oft wenig technikaffin.
- **Status:** Fertig & produktiv – auf dem Synology-NAS deployt, intern im WLAN **und**
  extern unter `https://musik.ecg-donrath.de` live (Stand 13.06.2026).
- **Repository:** privates GitHub-Repo `FAlwin/churchtools-musik-app` (origin/main).

## Tech-Stack
| Bereich        | Technologie                        |
|----------------|------------------------------------|
| Frontend       | React + Vite + TypeScript (PWA)    |
| Styling        | SCSS Modules                       |
| Datenfetching  | TanStack Query                     |
| Formulare      | React Hook Form + Zod              |
| Backend        | Node.js + Express + TypeScript     |
| Datenbank      | keine (ChurchTools ist Datenquelle; Notizen/Annotationen lokal im Browser) |
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
- Commits auf Englisch, klein und präzise; pro abgeschlossenem Teilschritt ein Commit

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

## White-Label (vorbereitet)
Marken-Konfiguration zentral in `client/src/config/branding.ts` (Name, Kurzname, Beschreibung,
Logo-Pfad, Org-Name, Theme-/Hintergrundfarbe). Genutzt vom PWA-Manifest (`vite.config.ts`) und
dem Login. Logo-Dateien in `client/public/` (`logo.png`, `logo.svg`, `icon-192/512.png`). Für eine
andere Gemeinde: branding.ts + Logo-Dateien anpassen. Farben zusätzlich in `_variables.scss`
(SCSS) – beim Vollausbau aus einer Quelle speisen. Voller White-Label-Ausbau (mehrere Gemeinden
umschaltbar, eigene CT-Instanz) ist ein eigenes Folgepaket.

**Laufzeit-Branding (umgesetzt, Phase A–C):** Name/Kurzname/Logo/Farben/CCLI werden zur Laufzeit
aus `site.json` (Volume) gelesen und vom Client angewendet (`useSiteConfig` + `utils/applyBranding.ts`).
Ein ChurchTools-**Admin** stellt sie per Klick auf der Seite `pages/Settings.tsx` ein
(`PUT /api/site-config`). Das **PWA-Manifest ist dynamisch**: der Server liefert
`/api/manifest.webmanifest` aus der Config (Name/Farben/Logo), `index.html` verweist fest darauf,
vite-plugin-pwa generiert nur noch den Service Worker (`manifest: false`). Die Standard-Defaults
liegen zentral in `DEFAULT_SITE_CONFIG` (`shared/types`); das frühere `client/src/config/branding.ts`
ist entfernt. Speicherpfad: `SITE_CONFIG_PATH`, Admin-Recht: `ADMIN_PERMISSION`
(Default `churchcore:administer persons`, je Instanz prüfen).
**iOS-Grenze:** `apple-mobile-web-app-title` in `index.html` bleibt statisch (iOS liest ihn beim
„Zum Home-Bildschirm"); Android nutzt `short_name` aus dem dynamischen Manifest.

**Verteilung an andere Gemeinden (Phase D umgesetzt):** Release-Workflow `.github/workflows/release.yml`
baut bei Tag `v*` das Image und pusht es **privat** nach `ghcr.io/<owner>/churchtools-musik-app`
(bei PRs nur Build-Validierung). Verteil-Paket `deploy/` (image-basiertes `docker-compose.yml` mit
Volume + `.env.example` + `ANLEITUNG.md`). Lizenz proprietär (`LIZENZ.md`, Nutzung auf Anfrage,
Image privat → Gemeinden brauchen GitHub-Token `read:packages`). **Release auslösen:**
`git tag vX.Y.Z && git push --tags`. Stand/Details: `WHITE-LABEL.md`.

## Anmerkungen (Zeichnen/Text)
`useDrawing.ts` kapselt Canvas-Striche (Stift/Marker/Radierer) + Text-Anmerkungen (localStorage
pro Song). Bedienung: Text **antippen** = auswählen (Rahmen), **nochmal antippen** = Inhalt
bearbeiten, **ziehen** = verschieben. Werkzeugleiste zeigt bei Auswahl Farbe/Größe (live) + 🗑.
Farb-Voreinstellungen: Orange/Petrol/Schwarz-Weiß (`DRAW_COLORS`, `#14110F` → Creme im Dunkelmodus)
+ freier `<input type=color>`-Picker. **Undo/Redo** (↺/↻) über einen Verlauf aus Canvas-Bild +
Text-Liste pro Schritt; „Alles löschen" ist ebenfalls rückgängig machbar. **Wichtig:** Solange
Anmerkungen existieren (`hasAnnotations`), sind Schriftgröße/Spalten gesperrt (halbtransparente
Schicht über der Steuerung) – sonst würden die pixelbasierten Anmerkungen beim Umbruch verrutschen.

## Domänen-Besonderheiten
- **ChordPro:** zwei Dialekte unterstützen – Standard (`{start_of_verse}`) UND
  SongSelect (`{comment: Vers}`, optionale Akkorde `[(E)]`, Bass-Akkorde `[E/G#]`)
- **Transponieren:** Original-Tonart aus der .chordpro-Datei, Ziel-Tonart aus dem
  ChurchTools-Arrangement-Feld; manuelles Transponieren nur lokal, kein Zurückschreiben
- **CCLI:** Lizenznummer 2395145, SongSelect Premium; CCLI-Infos pro Song anzeigen
- **Branding:** Teal #00616E, Orange #EB5E28 (Akkorde), Cream #FFFCF2

## Tests & CI
- **Befehle:** `npm test` (alle), `npm run test:cov` (Coverage), im Client
  `npm run test:watch`.
- **Umfang (bewusst schlank):** Vitest-Unit-Tests nur für die kniffligste reine Logik –
  `client/src/utils/transpose.ts` (Transponieren) und `chordpro.ts` (zwei Dialekte).
  Kein API/E2E: UI + Proxy werden manuell geprüft (Begründung: `docs/testkonzept.md`).
- **CI:** `.github/workflows/ci.yml` läuft `lint` + `build` + `test` bei jedem PR
  und Push auf `main`. Kein DB-Service nötig.
- **Regel:** Jeder Bug → Issue (Vorlage „Fehlerbericht"); betrifft er reine Logik,
  zusätzlich ein Regressionstest.

## Security-Checkliste
- [x] .env + .gitignore korrekt eingerichtet
- [x] Zod-Validierung auf allen API-Routen
- [x] helmet eingerichtet
- [x] express-rate-limit eingerichtet (zusätzlich striktes Limit am Login)
- [x] Repository privat (GitHub `FAlwin/churchtools-musik-app`)
- [x] Authentifizierung: persönlicher ChurchTools-Login, Session in signiertem httpOnly-Cookie
- [x] HTTPS extern via Synology Reverse Proxy + Let's Encrypt (`musik.ecg-donrath.de`)
- [x] npm audit: zuletzt geprüft am 11.06.2026 – 3 moderate (esbuild/vite,
      nur Dev-Server, kein Prod-Risiko; Fix = vite@8 Breaking Change, zurückgestellt)

## Deployment
- **Synology NAS via Docker** (Container Manager, Projekt `worship-charts`) → **umgesetzt & live**.
- **docker-compose.yml + Dockerfile:** vorhanden; ein Container liefert API + App aus (Port 3001).
- **Intern (WLAN):** `http://192.168.10.188:3001`.
- **Extern (HTTPS):** `https://musik.ecg-donrath.de` über **Synology Reverse Proxy** → `localhost:3001`,
  DNS via Synology-DDNS (`ecgdonrath.synology.me`) + Hetzner-CNAME, Zertifikat Let's Encrypt,
  Portweiterleitung 443/80 im UniFi-Router (DSM 5000/5001 bleiben zu). **Kein Cloudflare.**
- **Anleitung:** `DEPLOYMENT.md` (Schritt-für-Schritt, Container Manager + externer Zugang).

## Changelog
| Datum      | Branch | Was                                         |
|------------|--------|---------------------------------------------|
| 11.06.2026 | main   | Initial Setup (Git, Tooling, Struktur)      |
| 11.06.2026 | main   | Server-Grundgerüst + Health-Endpoint        |
| 11.06.2026 | main   | Frontend-MVP: alle 4 Screens + Chart-Logik (Mock-Daten), im Browser verifiziert |
| 11.06.2026 | main   | ChurchTools-API erkundet, Datenmodell bestätigt |
| 11.06.2026 | main   | Schritt 7: Backend-Proxy + Login + Setlist-Pipeline, gegen echte Daten getestet |
| 11.06.2026 | main   | Schritt 8: Frontend an Backend angebunden (TanStack Query, Mock-Daten ersetzt) |
| 11.06.2026 | main   | Chart-UX-Feinschliff (Blättern, Schriftarten, pro-Lied-Einstellungen, Steuerung) |
| 11.06.2026 | main   | ChordPro-Editor mit Rückspeicherung als ECG-Version (gegen Test-Lied verifiziert) |
| 11.06.2026 | main   | Dokumenten-Viewer (PDF/Bild) integriert: Anzeige-Auswahl, Blättern, Zoom/Anpassen pro Seite, Anmerkungen |
| 11.06.2026 | main   | Schritt 9: Deployment-Setup (Docker) |
| 11.06.2026 | main   | **Auf NAS deployt** (Container Manager), lokal im WLAN live; Cookie-über-HTTP-Fix |
| 12.06.2026 | main   | Privates GitHub-Remote angelegt; Termin-Untertitel in Übersicht |
| 12.06.2026 | main   | Kompletten Ablauf anzeigen (nicht nur Lieder); Zuständig-Personen |
| 12.06.2026 | main   | Ablauf VOLL bearbeiten (Drag&Drop/Löschen/Umbenennen/Hinzufügen) → ChurchTools |
| 12.06.2026 | main   | UX-Feinschliff; „Alle Lieder"-Ansicht mit Suche + Nutzungsstatistik |
| 12.06.2026 | main   | Rechtebewusste UI (`/api/capabilities`): Mitglied = nur Liederbuch |
| 13.06.2026 | main   | Review/Cleanup; Gottesdienst-Sortierung nach Uhrzeit |
| 13.06.2026 | main   | **Externer Zugang live:** `https://musik.ecg-donrath.de` (Reverse Proxy + DDNS) |
| 13.06.2026 | main   | Spalten-Pagination robust (End-Marker statt scrollWidth); Akkord-Abstand-Regler entfernt |
| 14.06.2026 | main   | Neues Logo (Schallwellen-Icon); PWA-Name „Churchtools Musik App" (short_name + apple-title) |
| 14.06.2026 | main   | White-Label vorbereitet: Name/Logo/Org/Farben zentral in src/config/branding.ts |
| 14.06.2026 | main   | Erscheinungsbild Hell/Dunkel/**System**; „Display anlassen" app-weit + Re-Acquire |
| 14.06.2026 | main   | Anmerkungen: Farb-Palette (Orange/Petrol/SW + freier Picker), Text auswählen→Farbe/Größe/Inhalt live, Undo/Redo, sicheres Löschen (Leiste), „Alles löschen" rückgängig machbar |
| 14.06.2026 | main   | Schrift/Spalten gesperrt, solange Anmerkungen vorhanden (verhindert verrutschte Anmerkungen beim Zoomen); halbtransparente Sperr-Schicht im Aussehen-Menü |
| 14.06.2026 | main   | Ablauf-Bearbeiten: Punkt antippen → Aktionsmenü (Umbenennen / 🎵 Lied verknüpfen / 🔗 Verknüpfung aufheben / Löschen); bestehender Text-Punkt wird in-place zum Lied und zurück |
| 14.06.2026 | main   | Verantwortliche setzbar über CT-Dienst-Tokens (`[Musik]` etc.) per Chips+Freitext (Hinzufügen + nachträglich); CT füllt Personen aus dem Dienstplan; offene Dienste als oranger „Dienst ?"-Chip hervorgehoben |
| 14.06.2026 | main   | Lied-Statistik bezieht kommende 3 Monate ein (eingeplante Lieder zählen mit, „zuletzt" zeigt auch zukünftige Termine); Cache wird bei Ablauf-Änderungen sofort invalidiert (Server + Client) |
| 14.06.2026 | main   | Fix: Dienst-Chips säubern jetzt alle Klammern + nachgestelltes „?" (z.B. „[Kamera Studio]?" → „Kamera Studio ?") |
| 18.06.2026 | chore/blueprint-angleichen | An Blueprint angeglichen: PROJEKTPLAN.md + docs/ (entscheidungen, testkonzept, konfigurationsmanagement); Vitest-Unit-Tests für transpose.ts + chordpro.ts (30 Tests); CI (GitHub Actions: lint+build+test); Issue-Vorlagen + Projects-Board |
| 18.06.2026 | feature/white-label-runtime | White-Label Phase A+B: Laufzeit-Branding (site.json auf Volume, `GET /api/site-config` + `/api/site-logo`, Client wendet Farben/Name/Logo an); Admin-Einstellungsseite (`PUT /api/site-config`, CT-Admin-Recht, Logo-Upload/Farben/CCLI per Klick); Farb-Utils + 7 Tests |
| 18.06.2026 | feature/white-label-manifest | White-Label Phase C: PWA-Manifest dynamisch (`GET /api/manifest.webmanifest` aus dem Branding, `manifest:false` im vite-plugin-pwa, fester Link in index.html); `config/branding.ts` entfernt (Defaults nun in `DEFAULT_SITE_CONFIG`) |
| 18.06.2026 | feature/white-label-deploy | White-Label Phase D: Release-Workflow (Tag `v*` → privates GHCR-Image, PR = nur Build-Check); `deploy/`-Paket (image-basiertes compose + .env.example + ANLEITUNG.md); Volume `worship-data`/`musik-data` für Branding-Persistenz; Lizenz `LIZENZ.md` (proprietär, auf Anfrage) |

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
  **intern** `http://192.168.10.188:3001` und **extern** `https://musik.ecg-donrath.de` live.
- **Offen / optional:** Login-Token aus lokaler Dev-`.env` neu erzeugen/entfernen;
  Test-Service-Konto/Token #1012 in ChurchTools widerrufen; Musik-Abwesenheitsplaner nachbauen
  (separates Projekt); White-Label für andere Gemeinden.

## Deployment-Stand (NAS)
- Liegt auf dem NAS unter der `docker`-Freigabe: `docker/churchtools-musik-app`
  (vom Mac über die gemountete Freigabe kopiert, ohne node_modules/.git/Dev-.env).
- Container Manager → Projekt `worship-charts` (aus `docker-compose.yml`), Port 3001.
- Prod-`.env` auf dem NAS: `CHURCHTOOLS_BASE_URL` + `SESSION_SECRET` (kein Login-Token!).
- **Wichtige Lernpunkte fürs Re-Deploy:**
  - Updates: Code in den NAS-Ordner kopieren, dann Projekt **neu erstellen** –
    bei Zweifel an Cache: **Projekt löschen + Image löschen + neu erstellen** (sonst
    nutzt Docker alten Stand; passiert bei Kopie über SMB).
  - Cookie: bewusst **ohne `secure`**-Flag (LAN läuft über HTTP; sonst speichert der
    Browser das Session-Cookie nicht → „nicht angemeldet" nach Login).
  - `trust proxy` ist in Produktion gesetzt (für späteren HTTPS-Tunnel).
  - **Branding-Volume (seit Phase D):** `docker-compose.yml` mountet `worship-data:/app/data`
    (Laufzeit-Branding `site.json`). Beim Re-Deploy das Volume behalten – sonst sind die per
    Einstellungsseite gesetzten Werte nach dem Neubau weg (fallen zurück auf ECG-Defaults).
- **So lokal starten:** `npm run dev:server` UND `npm run dev:client` (beide!). Der Vite-
  Dev-Proxy leitet `/api` an `localhost:3001` weiter.
- **Bekannte Datenlücke:** Nicht alle Arrangements haben eine `.chordpro`-Datei (manche nur
  `.sng`/`.txt`) → Frontend zeigt dann „keine Akkord-Datei hinterlegt".

## API des eigenen Backends
- `GET  /api/site-config` → Laufzeit-Branding (öffentlich, auch für den Login-Screen)
- `GET  /api/site-logo` → hochgeladenes Logo als Bild (404, wenn keins gesetzt → Standard-Logo)
- `GET  /api/manifest.webmanifest` → PWA-Manifest, zur Laufzeit aus dem Branding erzeugt
- `PUT  /api/site-config` → Branding speichern (nur Admin, Zod-validiert)
- `POST /api/auth/login` {email, password} → `{authenticated, user}` + setzt Session-Cookie
- `POST /api/auth/logout` → Session löschen
- `GET  /api/auth/me` → `{authenticated, user?}`
- `GET  /api/capabilities` → Rechte des Nutzers (view/edit agenda, view/edit songcategory) → steuert UI
- `GET  /api/services?from=&to=` → `Service[]` (nur mit Setlist; Default-Fenster -7d…+42d)
- `GET  /api/services/:eventId/setlist` → kompletter Ablauf (`AgendaItem[]`, Lieder mit ChordPro + ECG, documents[])
- `PATCH /api/services/:eventId/agenda/order` → Reihenfolge zurückschreiben (ganze Liste)
- `POST/PUT/DELETE /api/services/:eventId/agenda/items[/:itemId]` → Ablaufpunkt anlegen/ändern/löschen
- `GET  /api/songs?query=` → Songsuche (Lied zum Ablauf hinzufügen)
- `GET  /api/song-library` → alle Lieder (Ansicht „Alle Lieder")
- `GET  /api/song-usage` → Nutzungsstatistik letzte 12 Monate (1h-Cache)
- `GET  /api/songs/:songId/chart` → Chart eines einzelnen Lieds (aus „Alle Lieder")
- `PUT  /api/songs/:songId/chordpro` {arrangementId, text} → bearbeitete ECG-.chordpro speichern
- `DELETE /api/songs/:songId/chordpro` {arrangementId} → ECG-Version löschen (zurück zum Original)
- `GET  /api/songs/:songId/files/:fileId` → PDF/Bild aus ChurchTools durchreichen (Viewer)

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
- **Rechte „Liederbuch für alle Mitglieder":** CT-Rolle braucht „Veranstaltungen sehen (view)"
  + „Einzelne Song-Kategorien sehen (view songcategory)" – sonst nichts. Kein Service-Konto nötig.

## Schreibzugriff (Editor) – ChurchTools-Eigenheiten
- Schreibende Calls brauchen ein CSRF-Token (`GET /api/csrftoken`) + Session-Cookie.
- Upload: `POST /api/files/song_arrangement/{arrId}` multipart, Feld `files[]`.
- Löschen: `DELETE /api/files/{fileId}` (fileId aus der fileUrl `?…id=` extrahiert).
- Bearbeitung wird als separate `"<Titel> — ECG.chordpro"` gespeichert, Original bleibt.
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
- [x] White-Label vorbereitet (branding.ts) – Vollausbau (mehrere Gemeinden) offen
- [ ] Musik-Abwesenheitsplaner (separate Flask-App) in diese App nachbauen
