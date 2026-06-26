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

**Design-Regeln (verbindlich):** `docs/design-system.md` – Farben nur über Tokens (es gibt **kein**
`--orange`/`--teal`/`--chord`; Akzent = Blau, Destruktiv = Rot), System-Font, gemeinsame Bausteine
(SCSS-Mixins `styles/_mixins.scss`, `<Segment>`, `Icon`/Line-Icons statt Emojis).
*Entfernt (durch feste Version): `deploy/`, `.github/workflows/release.yml`, `LIZENZ.md`.*

## Akkord-Ansicht: PDF-Strom + Anmerkungen
Die Akkord-Ansicht ist **kein** Live-HTML-Chart mehr, sondern ein **erzeugtes PDF**: `utils/chordPdf.ts`
baut aus ChordPro ein A4-PDF (SongSelect-Look, alles schwarz, Logo oben rechts). Der ganze Ablauf
wird zu **einer** PDF zusammengefasst (`generateSetlistPdfWithOwners` → `owners[]` = welche Seite zu
welchem Lied/Seite/Version gehört). `components/StreamView.tsx` rendert den Strom (pdf.js → Canvas):
Hochformat 1 Seite, **Querformat 2 Seiten nebeneinander** über Liedgrenzen, je Seite eigener Zoom.
*(Live-Chart-Reste `useDrawing.ts`/`usePagedColumns.ts`/`constants.ts` wurden entfernt.)*

**Anmerkungen** kapselt `hooks/usePageDraw.ts` **pro Seite**: Striche (Stift/Marker/Radierer) auf einer
Anno-Canvas + Textfelder (platzieren/auswählen/verschieben/bearbeiten) + **Rückgängig/Wiederholen**.
Bedienung: Text-Werkzeug → ins Leere tippen = Feld; nach Bestätigen ist der Text ausgewählt (Rahmen);
tippen = auswählen, nochmal = bearbeiten, ziehen = verschieben; Tipp ins Leere hebt Auswahl auf.
Marker wird als **eine** halbtransparente Linie gemalt (Schnappschuss-Technik, kein „Gepunktel").
Farben fest **Schwarz/Rot/Gelb** + freier Picker. Hochgeladene Dokumente (PDF/Bild) nutzen weiter
`components/DocumentView.tsx` (eigene, lokale Anmerkungen).

**Speicherung pro Konto (Server, geräteübergreifend):** Anmerkungen + Zoom laufen über
`services/annotations.ts` (localStorage = Cache, debounced Push, Pull beim Laden/Rückkehr/30 s; Pull
überspringt Seiten mit noch nicht hochgeladener Änderung). Pro-Lied-Einstellungen über
`services/userSettings.ts`. **Schlüssel** je Eintrag: `song<id>_v<versionKey>_<seite>` (Zoom zusätzlich
`_d<geräteklasse>`). Geräteklasse `phone` vs `large` (Tablet+Computer) via `utils/deviceClass.ts` –
display-abhängige Werte (Spalten/Schrift/Zoom) gelten pro Gerätetyp, musikalische (Tonart/Kapo/
Abschnitte/Version) überall gleich. Versions-Helfer: `utils/songVersions.ts`.

## Domänen-Besonderheiten
- **ChordPro:** zwei Dialekte unterstützen – Standard (`{start_of_verse}`) UND
  SongSelect (`{comment: Vers}`, optionale Akkorde `[(E)]`, Bass-Akkorde `[E/G#]`)
- **Transponieren:** Original-Tonart aus der .chordpro-Datei, Ziel-Tonart aus dem
  ChurchTools-Arrangement-Feld; manuelles Transponieren nur lokal, kein Zurückschreiben
- **CCLI:** Lizenznummer 2395145, SongSelect Premium; CCLI-Infos pro Song anzeigen
- **Farben:** Primär Blau `#0061A1`, Destruktiv Rot `#B22247`; Akkorde im Chart schwarz/fett
  (SongSelect-Stil). Details: `docs/design-system.md`

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
- **Anleitung:** `DEPLOYMENT.md` (Schritt-für-Schritt, Container Manager + externer Zugang).
- **Auto-Deploy (Test + Prod):** `.github/workflows/staging.yml` baut bei jedem Push (main/feature/**)
  ein `:staging`-Image (amd64) nach GHCR; `release.yml` baut bei Tag `vX.Y.Z` Multi-Arch + `:latest`.
  Beide NAS-Instanzen laufen image-basiert mit **Watchtower** (Auto-Pull): Test
  `deploy/docker-compose.staging.yml` (`worship-charts-test`, Port 3002, `:staging`, Scope
  `worship-test`, 60 s); Prod `deploy/docker-compose.prod.yml` (`worship-charts`, Port 3001,
  `:latest`, Scope `worship-prod`, 300 s). **Kein manueller Container-Rebuild mehr.** Volume
  (`worship-data` / `worship-data-test`) beim Neu-Erstellen behalten.
- **Env (Volume `/app/data`):** `SITE_CONFIG_PATH=/app/data/site.json`,
  `ANNOTATIONS_PATH=/app/data/annotations` (kontobezogene Anmerkungen/Einstellungen) – beim Re-Deploy
  Volume behalten.

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
| 18.06.2026 | redesign/churchtools-look | Design-Hausputz: Token-Hygiene (tote `--orange`/`--teal`/`--chord` entfernt, Roh-Hex→Tokens, neue `--seg-on`/`--track-off`/`--scrim`, Fonts→`var(--ui)`, Google-Fonts raus), gemeinsame Bausteine (`_mixins.scss`, `<Segment>`), Altlasten (`deploy/`, `release.yml`, `LIZENZ.md`) entfernt, `docs/design-system.md`; Fix: Spinner folgt currentColor |
| 18.06.2026 | redesign/churchtools-look | **Komplettes Redesign im ChurchTools-Look** (Plan-Änderung: feste CT-Version statt White-Label): neue Token-Palette (blau `#0061A1`, System-Font, Light/Dark); untere Tab-Bar Termine/Lieder/Mehr + `tab`/`view`-Routing; ct-nav-Header; alle Seiten neu gestaltet (Termine-Karten/Monatsgruppen, Lieder mit NoteTile/key-pill, Setlist mit Akzentbalken, Chart-Sektionsfarben, Mehr-Tab mit Segment/Toggle); neues Schallwellen-Logo; White-Label zurückgebaut (nur `orgName` admin-anpassbar, feste Palette/Logo, statisches Manifest); Funktionalität unverändert |
| 19.06.2026 | main   | Tests/A11y zum Redesign: `hasOpaquePixel` aus der Bearbeiten-Sperre extrahiert + getestet, Render-Tests für `<Segment>`/`<Section>` (44 Tests grün), Fokusring + `prefers-reduced-motion` + aria-labels. **Redesign nach `main` gemerged (PR #14) und produktiv deployt** (`worship-charts`, musik.ecg-donrath.de) – extern verifiziert |
| 19.06.2026 | main   | Chart-Lesbarkeit (`ChordLine.module.scss`): Abstand Akkord↔Text (`margin-bottom`), Zeilenpaar-Abstand `1px`→`0.4em`, Mindestabstand zwischen Akkorden (`padding-right: 0.7ch`, kein „Dm7Am" mehr); **Akkorde in Akzentfarbe Blau** (`--blue`) statt schwarz – produktiv deployt + verifiziert |
| 19.06.2026 | main   | **iOS-PWA-Layout-Fix** (auf echtem iPhone verifiziert): App-Höhe robust via `--app-h` = `window.innerHeight` + untere Safe-Area statt `100dvh` (Querformat-Bug + dunkler Streifen behoben); `#root` als Bezugsrahmen für `.screen`-Detailansichten (kein leerer Balken/Streifen); Scroll-Padding unten; Chart-Footer mit fester Mindesthöhe (springt nicht mehr) + einheitlicher Abstand über dem Home-Strich. |
| 25.06.2026 | feature/versions-account-annotations | **Großer Funktions-Block (vor v2.1.0):** Akkord-Ansicht = erzeugtes PDF (SongSelect-Look) + 2-Seiten-Querformat-Strom; **mehrere benannte Lied-Versionen** (in ChurchTools, Team-weit) statt nur „bearbeitet"; **Anmerkungen+Zoom+Einstellungen pro Konto** serverseitig (geräteübergreifend, display-abhängige Werte pro Gerätetyp); volle Anmerkungen pro Seite (Stift/Marker/Text/Undo); Ablauf-PDF-Export; **Auto-Deploy** der Test-Instanz (Staging-Image + Watchtower). Diverse Fixes (Marker glatt, Text-Eingabe-Leiste oben/auswählen, letztes Lied im 2-up, „Link hinzufügen" auf HTTP, Auto-Sync-Race). Build/Lint/44 Tests grün. |
| 25.06.2026 | main   | **Release v2.1.0 produktiv live.** Branch nach `main` gemergt, Tag `v2.1.0` → Multi-Arch-Image (`2.1.0`/`2.1`/`latest`) in GHCR. **Test + Prod auf image-basiert + Watchtower umgestellt** (`deploy/docker-compose.staging.yml` Scope `worship-test`, `deploy/docker-compose.prod.yml` Scope `worship-prod`) → **Auto-Deploy**, kein manueller Rebuild mehr. `https://musik.ecg-donrath.de` verifiziert (v2.1.0, Volume/Branding erhalten). |
| 25.06.2026 | main   | **Zoom-Notausgang (Bugfix, iPad):** In `StreamView.tsx` konnte eine reingezoomte Seite „festhängen" – v. a. bei einem aus dem Speicher wiederhergestellten Zoom gab es keinen sichtbaren Ausweg (Pinch ist im Lesemodus aktiv, Wischen/Tippen währenddessen blockiert). Neu: Knopf **„Zoom zurücksetzen"** erscheint, sobald eine sichtbare Seite vergrößert ist (`onTransformed` → `zoomedSlots`); Tipp setzt Seite auf Fit zurück **und** löscht ihren gespeicherten Zoom dauerhaft (`clearStoredZoom`, beide Keys + Server-`zoom:null`). Pinch + bewusstes Speichern unverändert. Build/Lint/44 Tests grün. |
| 26.06.2026 | main → **v2.1.2 LIVE** | **StreamView/PDF-Politur (4 Punkte):** (1) **Zoom-Notausgang in die Kopfleiste** neben „Aa" verschoben (statt schwebend; `StreamView` meldet `onZoomedChange` hoch + wird per `resetZoomSignal` zurückgesetzt; neues Line-Icon `zoom-reset` = Lupe+Rahmen-Ecken). (2) **Seitenzahl nur bei mehrseitigen Liedern**, lied-bezogen (`owners.filter(songIdx===)`, `Seite localPage+1 / N`); einseitig keine Anzeige. (3) **„Nur Text" sauber** (`lyricRows` in `chordPdf.ts`): Akkorde raus, Silbentrenner `\s+-\s+`→`''`, Mehrfach-Leerzeichen→eins, getrimmt, linksbündiger Fließtext. (4) **Akkord-Lücken-Fix** (`wrapLine`): Akkord aufs erste Wort mit echtem Text statt aufs führende Leerzeichen (`[C] wort` erzeugte sonst eine auf Akkordbreite aufgeblasene Lücke). **Entscheidung:** echte Mehrfach-Leerzeichen im Quelltext (Phrasen-Pausen, z. B. Lied „Treu") bleiben in der Akkord-Ansicht bewusst erhalten (nur „Nur Text" reduziert sie). `DemoPdf` (`?demo=pdf`) um Testblock erweitert, lokal verifiziert. Build/Lint/44 Tests grün. **Als `v2.1.2` produktiv getaggt → musik.ecg-donrath.de (Auto-Deploy via GHCR + Watchtower).** |
| 26.06.2026 | main → **v2.1.3 LIVE** | **Akkord-Layout-Politur (2 Punkte, am Lied „Das glaube ich" aufgefallen):** (1) **Breite Akkorde dürfen über akkordlose Folgewörter ragen** (`drawRow`, `chordDebt`-Buchhaltung): ein Akkord, der breiter ist als seine kurze Silbe (z. B. `E/G#` über „ler", `C#m` über „An"), erzwingt nur dann Extra-Platz, wenn direkt danach wieder ein Akkord käme → keine „An␣␣␣den"-Lücken mehr, nie Überlappung; `wrapLine` bewusst konservativ (kein Überlauf). (2) **Zeilen einheitlich linksbündig**: `drawRow` überspringt führende reine-Leerzeichen-Token (`[A]␣␣␣Ich…` startete sonst eingerückt) → jede Zeile bündig am Rand. **Mehrfach-Leerzeichen INNERHALB der Zeile bleiben bewusst** (Phrasen-Pausen; Alwin hat Reduktion ausdrücklich verworfen). DemoPdf um Lücken-Test (breite Akkorde) erweitert. Erst auf Test verifiziert (Preview + Test-Instanz), dann von Alwin abgenommen → Tag `v2.1.3` live. Build/Lint/44 Tests grün. |

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
  mit **Auto-Deploy** (Staging-Image + Watchtower) – Abnahme neuer Features vor dem Prod-Release.
- **Offen / optional:** Login-Token aus lokaler Dev-`.env` neu erzeugen/entfernen;
  Test-Service-Konto/Token #1012 in ChurchTools widerrufen; Musik-Abwesenheitsplaner nachbauen
  (separates Projekt); **Verteilung an andere Gemeinden (Selbst-Hosting)** – Fahrplan steht in
  `WHITE-LABEL.md`.

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
- `GET  /api/site-config` → `{ appName, description, orgName }` (öffentlich, für Login/Mehr)
- `PUT  /api/site-config` → Gemeinde-Name speichern (nur Admin, Zod-validiert)
- `POST /api/auth/login` {email, password} → `{authenticated, user}` + setzt Session-Cookie
- `POST /api/auth/logout` → Session löschen
- `GET  /api/auth/me` → `{authenticated, user?}`
- `GET  /api/capabilities` → Rechte des Nutzers (view/edit agenda, view/edit songcategory) → steuert UI
- `GET  /api/services?from=&to=` → `Service[]` (nur mit Setlist; Default-Fenster -7d…+42d)
- `GET  /api/services/:eventId/setlist` → kompletter Ablauf (`AgendaItem[]`, Lieder mit `chordpro` (Original) + `versions[]` + documents[])
- `PATCH /api/services/:eventId/agenda/order` → Reihenfolge zurückschreiben (ganze Liste)
- `POST/PUT/DELETE /api/services/:eventId/agenda/items[/:itemId]` → Ablaufpunkt anlegen/ändern/löschen (PUT-Felder u.a. `title`, `responsible`, `arrangementId`, `unlink`, `durationMin` → CT-Sekunden)
- `PUT  /api/services/:eventId/agenda/items/:itemId/hidden` {hidden} → Uhrzeit aus-/einblenden (CT-„Auge", hide/unhide)
- `GET  /api/songs?query=` → Songsuche (Lied zum Ablauf hinzufügen)
- `GET  /api/song-library` → alle Lieder (Ansicht „Alle Lieder")
- `GET  /api/song-usage` → Nutzungsstatistik letzte 12 Monate (1h-Cache)
- `GET  /api/songs/:songId/chart` → Chart eines einzelnen Lieds (aus „Alle Lieder")
- `POST /api/songs/:songId/versions` {arrangementId, name, text} → neue benannte Version anlegen → `SongVersion`
- `PUT  /api/songs/:songId/versions/:versionKey` {arrangementId, text?, name?} → Version aktualisieren/umbenennen
- `DELETE /api/songs/:songId/versions/:versionKey` {arrangementId} → Version löschen (Original bleibt)
- `GET  /api/songs/:songId/files/:fileId` → PDF/Bild aus ChurchTools durchreichen (Viewer)
- `GET  /api/annotations?songs=` / `PUT /api/annotations/:key` / `DELETE …/:key` → Anmerkungen+Zoom pro Konto (Feld-Merge strokes/texts/zoom; key `song<id>_v<ver>_<seite>[_d<class>]`)
- `GET  /api/settings?songs=` / `PUT /api/settings` → Lied-Einstellungen pro Konto (Schlüssel-Wert, Merge)

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
- [ ] Verteilung an andere Gemeinden (Selbst-Hosting) – Fahrplan in `WHITE-LABEL.md`
- [ ] Musik-Abwesenheitsplaner (separate Flask-App) in diese App nachbauen
