# CLAUDE.md – Churchtools Musik App (Worship Charts)

> Dieses Dokument ist die verbindliche Referenz für alle
> Entwicklungssessions in diesem Projekt. Immer zuerst lesen!
> **Grober Fahrplan: `docs/entwicklung/PROJEKTPLAN.md`** · Architektur-Entscheidungen:
> `docs/entwicklung/entscheidungen.md` · Testkonzept: `docs/entwicklung/testkonzept.md` ·
> Konfig/Umgebungen: `docs/entwicklung/konfigurationsmanagement.md` ·
> API des Backends: `docs/entwicklung/api-referenz.md`.
> Release-Notes: `CHANGELOG.md`. Granulare Aufgaben/Bugs: GitHub Issues + Projects-Board.
> **Manuelle Testfälle + Testlauf vor dem Release: `docs/tests/README.md`.**
> **Vor jedem Release: Release-Routine unten beachten.**

## Projektübersicht

- **Was:** Progressive Web App (PWA), die Chord Charts der aktuellen Setlist aus ChurchTools
  abruft, automatisch auf die hinterlegte Tonart transponiert und im Gottesdienst anzeigt.
  Ersetzt WorshipTools Charts. ChurchTools bleibt einzige Datenquelle.
- **Für wen:** Worship-Team der ECG Donrath (Musiker + Bandleiter), oft wenig technikaffin.
- **Status:** Fertig & produktiv – auf dem Synology-NAS deployt, intern im WLAN **und**
  extern unter `https://musik.ecg-donrath.de` live (Stand 03.08.2026: **v2.16.0 PRODUKTIV**, am
  ausgelieferten Bundle verifiziert).
- **Repository:** öffentliches GitHub-Repo `FAlwin/churchtools-musik-app` (origin/main), MIT-Lizenz.

## Tech-Stack

| Bereich         | Technologie                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend        | React + Vite + TypeScript (PWA)                                                                                                               |
| Styling         | SCSS Modules                                                                                                                                  |
| Datenfetching   | TanStack Query                                                                                                                                |
| Formulare       | React Hook Form + Zod                                                                                                                         |
| Backend         | Node.js + Express + TypeScript                                                                                                                |
| Datenbank       | keine – ChurchTools ist Datenquelle; Anmerkungen/Einstellungen pro Konto als JSON auf dem Volume (`ANNOTATIONS_PATH`), localStorage als Cache |
| Validierung     | Zod (serverseitig)                                                                                                                            |
| Deployment      | Docker auf Synology NAS (Container Manager)                                                                                                   |
| Externer Zugang | Synology Reverse Proxy + DDNS + Let's Encrypt (KEIN Cloudflare)                                                                               |
| Tests           | Vitest (Client-Logik/Hooks/Komponenten + Server, CT gemockt); Playwright-Render-Smoke (E2E)                                                   |
| CI              | GitHub Actions: lint + build + test je PR                                                                                                     |

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
│       ├── styles/          # _variables.scss, _mixins.scss, main.scss
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
- **Formatierung macht Prettier, nicht die Hand** (#198): `npm run format` vor dem Commit; die CI
  prüft es mit `npm run format:check` und schlägt sonst fehl. Wichtig zu wissen: **ESLint prüft
  Formatierung NICHT** – `eslint-config-prettier` schaltet alle Formatregeln ab (steht in
  `eslint.config.mjs` deshalb ZULETZT). Vor diesem Schritt war der Stil unbemerkt auseinandergelaufen
  (86 Dateien). Betroffen sind `ts/tsx/scss/json/md`, also auch `CHANGELOG.md` und die `docs/`.
- **ESLint: EINE Flat Config im Wurzelverzeichnis** (`eslint.config.mjs`, ESLint 9 – #279). Vorher lagen
  vier fast identische `.eslintrc.cjs` in `client/`, `server/`, `shared/` und `e2e/`; `no-explicit-any`
  stand viermal da. `npm run lint` = `eslint .` prüft jetzt **alles**, auch `shared/`, `e2e/` und
  `scripts/` (die fielen vorher stillschweigend heraus). Zu wissen:
  - **Typbewusste Regeln sind an** (`recommendedTypeChecked`). Damit greifen `no-floating-promises`
    und `no-misused-promises` – ein vergessenes `void`/`await` ist ein Fehler, keine Stilfrage.
  - **`no-console` gilt im Server** (`warn`/`error` erlaubt, `console.log` pro Stelle freizugeben).
  - Bewusste Ausnahmen, jeweils im Config-Kommentar begründet: `checksVoidReturn.attributes` aus
    (React-Idiom `onClick={async …}`), in Testdateien die `no-unsafe-*`-Familie aus (feuert auf
    `JSON.parse`/Mocks), Tooling- und Sonden-Dateien ohne Typprüfung.
  - ⚠️ **ESLint 9 meldet ungenutzte `eslint-disable`-Kommentare von selbst.** Dadurch fielen fünf
    wirkungslose `no-console`-Ausnahmen auf – die Regel war gar nicht aktiv. Ein Disable ohne aktive
    Regel ist Deko; jetzt zeigt der Lauf das.

### Frontend

- Komponenten: PascalCase (`ChordChart.tsx`)
- Hooks: camelCase mit use-Prefix (`useSetlist.ts`)
- Services: camelCase (`churchtoolsApi.ts`)
- Styles: `Component.module.scss` – eine Datei pro Komponente
- Globale Variablen nur aus `src/styles/_variables.scss`. **Einzige Ausnahme: `--sat`** – die
  iOS-Safe-Area oben wird in `main.tsx` gemessen (siehe unten), kommt also aus JS, nicht aus SCSS.
- **Abstand nach oben immer `max(20px, var(--sat, env(safe-area-inset-top, 0px)))`, NIE `env()` direkt**
  (#187): iOS setzt `env(safe-area-inset-top)` beim Schließen eines Modals kurz auf 0 → mit `env()`
  schrumpft die Kopfleiste im Transient und die ganze Leiste springt sichtbar. `main.tsx` misst den
  echten Wert über ein verstecktes Probe-Element und hält ihn stabil in `--sat`; nur eine echte
  Orientierungsänderung darf ihn senken. `env()` bleibt Fallback → keine Regression ohne JS-Messung.
- **Dialoge müssen die iOS-Tastatur aussparen** (#207): Jedes Vollbild-Overlay mit Eingabefeldern ist
  `position: fixed` (NIE `absolute` – sonst scrollt es mit dem Dokument mit) und nutzt den Hook
  `hooks/useOverlayKeyboardInset` + `padding-bottom: calc(… + var(--kb, 0px))`. Der Hook misst die
  Tastaturhöhe am `visualViewport` und holt den von iOS hinterlassenen Dokument-Scroll zurück; ohne
  ihn liegen Trefferlisten/Knöpfe unter der Tastatur und die Kopfleiste bleibt verrutscht. Gilt für
  `Sheet` (alle Dialoge), `ItemActionSheet` und den `ChordEditor`.
- **Ein 401 heißt „Sitzung abgelaufen" und führt zum Login** (#186, #210, #211): Der globale Fänger
  sitzt in **`services/api.ts`** (`setSessionExpiredHandler`, registriert in `App.tsx`) – bewusst in
  `apiFetch` und nicht mehr am QueryClient, denn `services/annotations.ts` und
  `services/userSettings.ts` rufen `apiFetch` direkt auf; am QueryClient blieben ihre 401er
  unsichtbar (#211). Kein Screen darf 401 selbst als „Erneut versuchen" anbieten – das war die alte
  Sackgasse, aus der nur Ab-/Neuanmelden half.
  ⚠️ **Ausnahme `/api/auth/…`** (`isAuthPath`): Dort ist 401 = „falsches Passwort", nicht
  „Sitzung abgelaufen". Ohne die Ausnahme löste ein Tippfehler beim Login das Abmelden samt
  Geräte-Aufräumen aus und **löschte die Offline-Reserve** (#210).
- API-Calls ausschließlich über `services/` + TanStack Query
- Keine Geschäftslogik in Komponenten (→ in `hooks/`)
- Keine Inline-Styles, außer für dynamische Laufzeitwerte
  (Schriftgröße, Akkordfarbe, Canvas-Position)

### Backend

- Routen enthalten keine Geschäftslogik
- Geschäftslogik gehört ausschließlich in `services/`
- Jede Route validiert Input mit Zod vor der Verarbeitung
- Fehlerbehandlung zentral in `middleware/errorHandler.ts`
- **401 vs. 403 streng trennen (#152):** `ctGet` gibt nur echte **401** als 401 weiter („Session
  abgelaufen"); ein **403** von ChurchTools bleibt **403**. Grund: Seit #186 löst jeder 401 einen
  Zwangs-Logout samt Geräte-Aufräumen aus – ein transienter Proxy-/Rechte-403 würde den Nutzer sonst
  grundlos abmelden. Umgekehrt mappt `getCsrfToken` eine tote CT-Session bewusst auf **401** (nicht
  502), damit ein Aussetzer beim Speichern ebenfalls sauber zum Re-Login führt statt als „offline"
  zu erscheinen.
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
`SiteConfig` (`shared/types`) hat sechs Felder: `appName`(fest), `description`(fest), `orgName`, `links`, `musicianGroupIds` und `noteRoles?`. Nur die ersten drei sind reine Anzeige-Werte.

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
Blättern schiebt horizontal ein (Slide-Übergang). _(Live-Chart-Reste `useDrawing.ts`/
`usePagedColumns.ts`/`constants.ts` wurden früher entfernt.)_ PageDeck delegiert (seit #140) die
querschneidenden Belange an eigene Hooks: `useZoomPersistence` (Zoom je Seite+Geräteklasse laden/
speichern + `restoreVisibleZoom`), `useKeyboardInsets` (iOS-Tastatur-Hub), `useSlideTransition`
(Blätter-Animation) und `usePointerStrokes` (Zeichen-Engine Stift/Marker/Radierer inkl. aller
Touch-Regeln); `composePane` bleibt bewusst in PageDeck.

**Gesten:** **ein Finger blättert, zwei Finger zoomen + verschieben** (auch im Zeichenmodus – ein
begonnener Strich wird bei Zweitfinger verworfen; Apple Pencil zeichnet, Finger zoomen). Pinch zoomt
und **speichert automatisch** (kein „Fertig"-Modus); Zurücksetzen über den Knopf in der Kopfleiste.
Im 2-up ist beim Anmerken nur die **aktive** Seite beschreibbar (die andere ausgegraut/gesperrt).

**Anmerkungen** kapselt `hooks/usePageDraw.ts` **pro Seite**: Striche (Stift/Marker/Radierer) auf einer
Anno-Canvas + Textfelder + **Rückgängig/Wiederholen**. Text wird **inline direkt auf der Seite**
bearbeitet (Tipp = Cursor an der Stelle; außerhalb tippen legt fest; **ein** Tipp auf einen Text
öffnet ihn direkt zum Bearbeiten; ziehen = verschieben, Ecken-Ziehknopf = Größe; Zeilenumbrüche
erlaubt). **Text-Format je Block** (fett/kursiv/unterstrichen + links/mitte/rechts) als optionale
Felder in `PageTextObj` (`DEFAULT_TEXT_STYLE` = normal & mittig; Bestandstexte ohne `bold`-Feld
gelten als fett → Fallback). Marker als **eine** halbtransparente Linie (Schnappschuss-Technik).
Werkzeugleiste `components/DrawToolbar.tsx`: Farbknopf mit Aufklapp-Palette (vier Farben
Rot/Blau/Grün/Orange + freier Picker). **Einheitliche Bedienung:** erster Tipp wählt ein Werkzeug,
zweiter Tipp klappt dessen Einstellungen links auf Höhe des Werkzeugs auf (`expandedTool`) –
Strichstärke bei Stift/Marker/Radierer, Text-Einstellungen als **senkrechte Spalte** (Größe in
„pt" · Format · Ausrichtung); ein dezenter Punkt-Hinweis (`.moreHint`) am aktiven Werkzeug zeigt
das an.

**Speicherung pro Konto (Server, geräteübergreifend):** Anmerkungen + Zoom laufen über
`services/annotations.ts` (localStorage = Cache, debounced Push, Pull beim Laden/Rückkehr/30 s; Pull
überspringt Seiten mit noch nicht hochgeladener **oder gerade laufender** Änderung; ausstehende
Uploads werden beim App-Verlassen sofort via `keepalive` geschickt). Pro-Lied-Einstellungen über
`services/userSettings.ts` (`utils/songVersions.ts`). **Anzeige-Einstellungen (Spalten `cols`,
Textgröße `fs`) werden geräteübergreifend synchronisiert** (kein Geräte-Suffix); **NUR der Zoom
bleibt pro Geräteklasse getrennt**. **Schlüssel** je Eintrag: `song<id>_v<versionKey>_<seite>` (Zoom zusätzlich
`_d<geräteklasse><spalten>`, z. B. `_dlarge2`; **`KEY_RE` in `annotations.ts` UND die Server-Zod-Regel
müssen diese Layout-Ziffer erlauben** – sonst wird der Querformat-Zoom nicht gesynct; Regressionstest
`annotations.keys.test.ts`). Die **Anmerkungs-Typen** (`AnnotationText`, `PageAnnotation`,
`SharedPage`) leben EINZIG in `shared/types/index.ts` (seit #137); Client und Server importieren von
dort, und ein **Compile-Wächter** in `annotationsController.ts` bricht den Build, wenn das Zod-Schema
vom Typ abweicht – neue Felder also IMMER an beiden Stellen ergänzen (Zod würde sie sonst beim
Speichern still wegschneiden, Ursache von #115). Dokument-Anmerkungen nutzen `worship_docdraw_<fileId>_<seite>`.
Geräteklasse `phone` vs `large` via `utils/deviceClass.ts`. Versions-Helfer: `utils/songVersions.ts`.

## Domänen-Besonderheiten

- **ChordPro:** zwei Dialekte unterstützen – Standard (`{start_of_verse}`) UND
  SongSelect (`{comment: Vers}`, optionale Akkorde `[(E)]`, Bass-Akkorde `[E/G#]`)
- **Transponieren:** Original-Tonart aus der .chordpro-Datei, Ziel-Tonart aus dem
  ChurchTools-Arrangement-Feld; manuelles Transponieren nur lokal, kein Zurückschreiben
- **CCLI:** Lizenznummer 2395145, SongSelect Premium; CCLI-Infos pro Song anzeigen
- **Farben:** Primär Blau `#0061A1`, Destruktiv Rot `#B22247`; Akkorde im Chart schwarz/fett
  (SongSelect-Stil). Details: `docs/entwicklung/design-system.md`

## Onboarding / Geführte Einführung (VERBINDLICH)

Neue Nutzer bekommen beim ersten Mal eine geführte Einführung mit Hinweisblasen am echten Element
(`components/Coachmarks.tsx`; Schritte + „gesehen"-Merker in `utils/onboarding.ts`; Ziele per
`data-tour="…"`-Attribut). Verbindliche Regel bei **jeder** Änderung/**jedem** neuen Feature:

1. **Einführung mitdenken:** Ändert oder ergänzt ein Feature die Bedienung (neuer Knopf, neue Geste,
   neuer Bereich), MUSS die Einführung dazu passen – Schritt ergänzen/anpassen in `utils/onboarding.ts`
   und ggf. ein `data-tour`-Attribut am neuen Element setzen. Betrifft es einen bestehenden Bereich,
   fügt man den Schritt in die passende Gruppe (`TERMINE_STEPS` / `CHART_STEPS`) ein.
2. **Damit es beim ersten Öffnen nach dem Update erscheint:** die betroffene Tour-**Version** erhöhen
   (`TOUR_TERMINE = 'termine-v1'` → `'termine-v2'` bzw. `TOUR_CHART`). Der Merker in localStorage
   passt dann nicht mehr → die (aktualisierte) Einführung erscheint bei allen automatisch beim ersten
   Öffnen. Ohne Versionserhöhung sehen Bestandsnutzer den neuen Schritt NICHT.
3. **Für ganz neue Bereiche** eine neue Tour-Gruppe + `TOUR_*`-Konstante anlegen und dort auslösen
   (Muster: `App.tsx` für Termine, `ChordChart.tsx` für die Chart-Ansicht – Start erst, wenn die
   Ziel-Elemente gerendert sind).

## Tests & CI

- **Befehle:** `npm test` (alle Unit-/Server-Tests), `npm run test:cov` (Coverage), im Client
  `npm run test:watch`; `npm run test:e2e` (Playwright).
- ⚠️ **`npm test` allein reicht als Freigabe NICHT:** Der Client-Build fährt `tsc && vite build`, und
  `tsc` typprüft die **Testdateien mit**. Ein Tippfehler im Typ eines Tests lässt alle Tests grün
  durchlaufen und bricht trotzdem den Build (und damit die CI). Vor dem Push immer auch
  `npm run build`.
- **Umgebung je Testdatei:** Standard ist `node` (reine Logik). Tests, die DOM/localStorage/jsPDF
  brauchen, setzen selbst `// @vitest-environment jsdom` als ERSTE Zeile – fehlt sie, scheitern sie
  mit „window is not defined".
- **Umfang:** Vitest für reine Logik (`utils/transpose.ts`, `chordpro.ts`, …), den
  Interaktionskern (`hooks/usePageDraw` Undo/Redo/Push-Dedup/Key-Wechsel), Basis-Komponenten
  (`Coachmarks`) und alle Server-Services/-Controller/-Middleware (ChurchTools gemockt).
  Coverage schließt `utils/`, `components/`, `hooks/`, `services/` ein.
- **E2E (Playwright):** ein **Render-Smoke** gegen `?demo=chart` (mountet die Chart-Ansicht ohne
  Login/Backend → prüft, dass die PDF-Seiten rendern, ohne unbehandelte JS-Fehler). Läuft im
  CI-Job selbst (Dev-Server hochgefahren), nicht gegen die LAN-Staging-Instanz. Der **volle
  Auth-Flow** (Login→Agenda→Anmerkung→Sync) braucht einen ChurchTools-Stub → offen als #174.
- **CI:** `.github/workflows/ci.yml` – Job `build-and-test` (`lint` + `build` + `test`) **und**
  Job `e2e` (Playwright-Smoke, Chromium) bei jedem PR und Push auf `main`. Kein DB-Service nötig.
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
- [x] npm audit: zuletzt geprüft am 26.07.2026 – Funde betreffen **ausschließlich Build-/Lint-/
      Test-Werkzeuge** (sass, eslint, vitest), zur Laufzeit nicht erreichbar; Prod-Pfad unbetroffen
      (Details in Issue #199). Frühere Prüfung 16.07.2026 – **0 Schwachstellen** (die früheren 3 moderaten
      esbuild/vite-Funde sind mit den aktuellen Dev-Deps nicht mehr vorhanden)

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
  **`X` (Major, z. B. `2`)\*\* und `latest`.
- **Test-Instanz (Auto-Deploy):** `deploy/docker-compose.staging.yml` (Container `musik-app-test`, Port
  3002, `:staging`, Scope `musik-app-test`, 60 s) zieht automatisch – über den **gepflegten
  Watchtower-Fork `nickfedor/watchtower`** (Original `containrrr` ist unmaintained / Docker-29-inkompatibel).
- **Prod-Instanz (bewusstes Update, seit v2.2.0):** `deploy/docker-compose.prod.yml` (Container `musik-app`,
  Port 3001) ist auf **`:2` gepinnt** und hat **keinen Auto-Pull**. Aktualisiert wird bewusst per
  `docker compose pull && up -d` (SSH) bzw. im Container Manager (Volume `worship-data` behalten).
- **Repo-Vorlagen (seit #35):** generische Container-Namen (`musik-app`/`-test`) für andere Gemeinden;
  **Volume-Keys (`worship-data`/`worship-data-test`) bleiben bewusst** → kein Datenverlust.
- **Stand ECG-Prod (seit v2.10.0-Deploy 13.07.2026):** Läuft als Container-Manager-Projekt
  **`worship-charts`** (Container `worship-charts`, Volume `worship-charts_worship-data`), Compose mit
  fixem **`name: worship-charts`** + **`COOKIE_SECURE: true`** (real erst am **2026-07-13** auf
  Prod aktiviert + verifiziert – zuvor lief der Container trotz gegenteiliger Doku ohne die Variable,
  also mit Default `false`; Container-Env `docker inspect … | grep cookie` = `COOKIE_SECURE=true`,
  Login live gegengeprüft: `/api/auth/login`+Folge-Calls alle `200`) + **Port nur lokal gebunden**
  (`127.0.0.1:3001:3001`, seit v2.10.0-Deploy: kein direkter LAN-Zugriff mehr, nur via Reverse
  Proxy/HTTPS; der Synology-RP erreicht `localhost` – verifiziert);
  NAS-Compose unter `/volume1/docker/churchtools-musik-app/docker-compose.yml`. Der `name:`-Eintrag
  fixiert den Volume-Präfix unabhängig vom CM-Projektnamen (Lehre aus dem Volume-Vorfall, s. u.).
- **Frontend-Update auf den Geräten (Service Worker, seit v2.5.0):** Nach dem Server-Update holt sich
  jedes Gerät den neuen Frontend-Build selbst – zuverlässig beim **Kaltstart/kompletten Neu-Öffnen**
  (bzw. Neuladen) und auf Knopfdruck über **„Nach Updates suchen"** im Mehr-Tab (lädt eine gefundene
  Version direkt). Der schwebende **„Neue Version verfügbar"-Balken** ist der passive Bonus-Weg (auf
  iOS unzuverlässig). Davon getrennt: der ältere Hinweis **„Neue Version X verfügbar – Was ist neu"**
  (`useUpdateCheck`) verlinkt nur die GitHub-Release-Notes. `registerType: 'prompt'` lädt nie
  ungefragt mitten in der Nutzung neu.
- **Gemeinden:** `deploy/docker-compose.yml` ist auf `:2` gepinnt; Update per `update.command`/`update.bat`.
- **Env (Volume `/app/data`, alle im Dockerfile gesetzt):** `SITE_CONFIG_PATH=/app/data/site.json`,
  `ANNOTATIONS_PATH=/app/data/annotations` (kontobezogene Anmerkungen/Einstellungen),
  `CAPABILITIES_CACHE_PATH=/app/data/capabilities-cache.json` (Rechte-Cache, überbrückt CT-Aussetzer),
  `SEEN_SETLISTS_PATH=/app/data/seen-setlists.json` (Basislinien für den „geändert"-Hinweis #143/#161)
  – beim Re-Deploy **Volume behalten**.

## Release-Routine (JEDES Mal vor einem Tag durchgehen)

Diese Checkliste wird **bei jedem Release** abgearbeitet – nichts überspringen. Am bequemsten über
den Skill `/festhalten`, der genau das automatisiert.

1. **Code grün:** `npm run lint` + `npm run build` + `npm test` laufen sauber durch.
2. **Einführung geprüft:** Bringt das Release ein neues/geändertes Bedienelement? Dann die geführte
   Einführung angepasst (Schritt + `data-tour`) UND die betroffene Tour-Version erhöht, damit sie
   beim ersten Öffnen erscheint (siehe „Onboarding / Geführte Einführung"). Wenn nein: bewusst nichts.
3. **Doku & Struktur aktuell:** Root enthält nur das Nötigste (`README.md`, `INSTALL.md`,
   `UPDATE.md`, `CHANGELOG.md`, `LICENSE`, `CLAUDE.md`); alles andere liegt geordnet in
   `docs/{betrieb,entwicklung,archiv}/`. Keine veralteten Aussagen, keine toten Verweise
   (z. B. auf gelöschte Dateien), keine Doppelungen (Changelog/API nur an einer Stelle).
4. **Installations-Anleitung gegen die Realität prüfen:** `INSTALL.md` + `UPDATE.md` +
   die Setup-/Update-Skripte in `deploy/` müssen zum tatsächlichen Vorgehen passen.
5. **CHANGELOG pflegen:** Abschnitt `[Unreleased]` mit den Änderungen seit dem letzten Tag füllen
   und auf die neue Version (`## [X.Y.Z] – Datum`) hochziehen. Versionierung nach SemVer.
6. **Taggen:** `git tag vX.Y.Z && git push origin vX.Y.Z` → CI baut `:latest` + `:X.Y` + `:X`
   (Major-Tag, damit Gemeinden sicher auf `:2` bleiben können). Prod-Deploy bewusst, nicht nebenbei.
7. **Memory aktualisieren:** Projekt-Memory + `MEMORY.md`-Index auf den neuen Stand bringen.

**⚠️ Prod-Deploy & Daten-Volume (Lehre aus dem Vorfall 2026-07-08):** Beim Aktualisieren im
Container Manager IMMER das **bestehende** Projekt neu aufbauen – **nie ein neues Projekt anlegen**.
Konkreter Ablauf im Synology Container Manager (es gibt KEINEN Knopf „Zurücksetzen"): das Projekt
öffnen → **Stopp** → **Aktion › Löschen** (dabei **KEINE** Volumes/Daten mitlöschen anhaken) →
**Projekt › Erstellen**. Nur so wird eine geänderte Compose (z. B. neue Env wie `COOKIE_SECURE`)
wirklich übernommen; ein reiner **Neustart** übernimmt Env-Änderungen NICHT. Das benannte Volume
überlebt das Löschen und wird beim Erstellen dank fixem `name:` wieder eingehängt. Der interne Volume-Name ist `<projektname>_<volume-key>`; ein abweichender
Projektname hängt den Container an ein **neues, leeres** Volume (Gemeindename/Links/Anmerkungen
wirken „weg", liegen aber unversehrt im alten Volume). Absicherung: Die Compose-Dateien setzen
`name:` fest (Prod `worship-charts`, Test `worship-charts-test`) → der Volume-Präfix ist damit
unabhängig vom Container Manager fixiert (`name` **nie** ändern). Vor größeren Eingriffen ein
Volume-Backup ziehen: `sudo tar czf ~/backup.tar.gz -C /volume1/@docker/volumes/<vol>/_data .`.
Recovery bei falsch eingehängtem Volume: Daten per `cp -a` ins aktuell gemountete Volume kopieren
(altes Volume nie löschen). Docker löscht benannte Volumes nie von selbst → Daten sind wiederherstellbar.

## Changelog

Release-Notes & Versionshistorie: siehe `CHANGELOG.md` (Single Source – hier nicht doppelt pflegen).

## So startest du die App lokal

```
cd ~/ecg-donrath/churchtools-musik-app
npm install        # einmalig
npm run dev:client # Frontend -> http://localhost:5173 (braucht das laufende Backend + echten
                   # ChurchTools-Login; es gibt KEINE Mock-Daten. Für UI-Prüfungen ohne Login:
                   # ?demo=chart / ?demo=pdf / ?demo=editor, siehe client/src/dev/)
npm run dev:server # Backend (Health-Endpoint) -> http://localhost:3001
```

## Stand & nächster Schritt

- **In `main` seit v2.16.0 (NICHT in Prod): die vier hohen Code-Check-Funde behoben** – #273, #274,
  #275, #276. Alle vier waren dieselbe Lehre („vorübergehend ≠ ungültig"), und bei jedem wurde zuerst
  nach der zweiten Stelle gesucht:
  - **#273** `read()` cachte `{}` bei JEDEM Lesefehler → der nächste Schreibvorgang überschrieb die
    Kontodatei. Es waren **sechs** Ablagen mit derselben Kopie; vier davon zerstörend (Anmerkungen,
    Einstellungen, Teilen-Tabelle für ALLE, Branding). Neu `services/jsonStore.ts` als einzige Stelle
    für Lesen/Schreiben; nur `ENOENT` heißt „leer". Die zwei reinen Caches (`seenSetlists`,
    `capabilitiesCache`) bleiben **bewusst** tolerant, mit Begründung im Code.
  - **#274** Download-Fehler wurde zu einem leeren Lied. Dafür musste `404` erst unterscheidbar
    werden (vorher wurde jede nicht-ok-Antwort zu 502) – die Zeile stand **zweimal** wortgleich, also
    neu der Helfer `fileDownloadError`. Das Lied trägt jetzt `chordproFailed`; Chart-Ansicht meldet es,
    „Als PDF teilen" fragt nach.
  - **#275** Dem Zwilling `client/services/userSettings.ts` fehlten **drei** Härtungen aus
    `annotations.ts` (grep: 19 Treffer dort, 0 hier). Sie werden jetzt **geteilt**, nicht nachgebaut:
    neu `services/pendingKeys.ts` (Merker in localStorage) und `services/appHidden.ts`
    (`visibilitychange`/`pagehide`); `annotations.ts` wurde auf beide umgestellt, sonst wäre es die
    dritte Kopie. Dazu `resumePendingSettings()` beim Start, `inflight`-Schutz im Pull.
  - **#276** „Teilen abschalten" meldete Erfolg ohne zu speichern. Zustandsmaschine dafür jetzt in
    `hooks/useSharing.ts` statt als `.catch(() => …)`-Einzeiler in `Settings.tsx`.
    Tests **Client 410 / Server 236 / 5 E2E**, 59 manuelle Testfälle (neu TF-EINST-08). Erledigt
    nebenbei zwei Punkte aus #283 (Settings-`catch`, veralteter Kommentar in `userSettings.flush.test`).
    ⚠️ **Gelernt:** `userSettings.flush.test.ts` und `.reset.test.ts` brauchen jetzt
    `@vitest-environment jsdom` – seit `pushSetting` den Merker schreibt, gibt es ohne jsdom
    „localStorage is not defined".
- **CODE-CHECK 05.08.2026 (nach v2.16.0): Qualität Note 1,7 „professionell, in Teilen
  herausragend", Sicherheit 0 kritische / 0 hohe Funde.** Gelobt: 0× `any`, 0× `@ts-ignore`, nur 5
  Non-null-Assertions im Produktionscode; Kommentare durchweg mit _warum_ + Issue-Nummer; die
  Dopplungs-Disziplin bei Schlüsseln (`shared/keys`), PDF-Optionen und Einstellungs-Umrechnung
  wirklich gelöst; SSRF doppelt zu, Path-Traversal ausgeschlossen, CSP ohne `unsafe-inline`,
  Rate-Limit-Schlüssel nicht manipulierbar; **jede Route einzeln geprüft – der „Custom-Route vor
  Sub-Router"-Footgun existiert hier nicht**; keine versionierten Geheimnisse (ganze Historie, neun
  Token-Muster).
  **Kritik: viermal dieselbe Lehre nicht angewandt – „vorübergehend ≠ ungültig" (#270).** Vier hohe
  Funde: #273 (`read()` cacht `{}` bei JEDEM Lesefehler → der nächste Schreibvorgang überschreibt die
  Kontodatei; `write()` setzt den Cache außerdem VOR dem Schreiben), #274 (Download-Fehler wird zu
  einem leeren Lied, und `Setlist.tsx:212` filtert es dann stumm aus der Sammel-PDF), #275 (dem
  Zwilling `client/services/userSettings.ts` fehlen DREI Härtungen, die `annotations.ts` hat – grep:
  19 Treffer dort, 0 hier; Folge: offline geänderte Tonart ist nach App-Neustart still weg), #276
  („Teilen abschalten" meldet Erfolg ohne zu speichern – privatsphäre-relevant). Mittel: #277, #278
  (`shared/` wird nicht gelintet), #279 (ESLint 8 EOL, keine typbewussten Regeln), #280
  (`churchtools.ts` 870 Z. aufteilen). Niedrig: #281 (**#268 ist unvollständig – ein Cookie ohne
  `s:`-Präfix landet nur in `req.cookies`, empirisch mit `cookie-parser` nachgestellt**), #282
  (`canUseGlobalNotes` wird aus dem Rechte-Cache überbrückt, obwohl es Lesezugriff auf FREMDE
  Anmerkungen gibt – #249-Begründung nicht übertragen), #283 (Sammel).
  **Zwei Agenten-Behauptungen selbst nachgeprüft und korrigiert:** „unsigniertes Cookie = dauerhafte
  401-Sackgasse" ist überzeichnet (ein Login überschreibt es – Ballast, kein Bypass), und
  „`shared/keys` wird nicht typgeprüft" ist falsch (`tsc --listFiles` zeigt die Datei in BEIDEN
  Builds; es fehlt nur der Lint). **Drei veraltete Aussagen in `testkonzept.md` und eine falsche
  `SiteConfig`-Angabe in CLAUDE.md + api-referenz.md dabei korrigiert** – in genau der Datei, die vor
  dieser Fehlerklasse warnt.
- **Aktuell (03.08.2026): v2.16.0 PRODUKTIV LIVE - verifiziert.** Digest
  `sha256:f8e177c6...` auf `:2`/`:2.16`/`:2.16.0`/`:latest` (amd64+arm64), GitHub-Release LATEST.
  Verifikation am ausgelieferten Bundle: `v2.16.0` im `index`-Chunk, `2.15.0` = **0 Treffer**, die in
  v2.16.0 NEUE Meldung „ChurchTools antwortet gerade nicht" im selben Chunk, `/api/update-check`
  = 2.16.0 = laufende Version (kein Update-Hinweis mehr). **Serverseitig gegengeprüft, nicht nur am
  Bundle:** Eine Anfrage an `/api/auth/me` mit kaputtem `ct_session` bekommt
  `Set-Cookie: ct_session=; Expires=Thu, 01 Jan 1970` zurück (#268 ist live), ohne Cookie kommt
  **kein** `Set-Cookie`, geschützte Endpunkte antworten 401. Cookie trägt `Secure` → `COOKIE_SECURE`
  ist in Prod an.
  **13 Issues in diesem Release** (#194, #245, #246, #247, #248, #249, #250, #251, #256, #174, #196,
  #268, #270); neun davon Fehler mit stillem Datenverlust, wegfliegender Anmeldung oder
  Ausfallrisiko. **#268 und #270 kamen erst aus Alwins Staging-Test** – ohne diesen Lauf wären sie in
  Produktion gegangen. Tests **Client 383 / Server 205 / 5 E2E** (vorher 319 / 168 / 1). Nutzersichtbar: Anmerkungen gehen bei Netzaussetzern
  und beim Schließen der App nicht mehr verloren (#245/#256), „Notizen von …" zeigt wieder die Ansicht
  des Kollegen (#247), eine übergroße ChurchTools-Datei legt die App nicht mehr lahm (#248), entzogene
  Admin-Rechte wirken sofort (#249), ein nicht ladbares Dokument wird gemeldet statt still durch
  Akkorde ersetzt (#251). Intern: **Sitzungs-Cookie verschlüsselt** (#194 – der CT-Anteil ist nicht
  mehr auslesbar; abwärtskompatibel, niemand wird abgemeldet), Schlüssel-Grammatik in `shared/keys`
  (#250) und ein **E2E-Auth-Flow gegen einen ChurchTools-Stub** (#174: Anmelden → Termin → Chart →
  Anmerkung → `PUT` mit 200). ⚠️ Beim Deploy: `SESSION_SECRET` unverändert lassen (der
  Verschlüsselungsschlüssel wird daraus abgeleitet). **#196 bleibt offen** – die Compose-Härtung liegt
  im Repo, das Anwenden auf dem NAS (Reverse Proxy für Staging!) steht aus.
- **Davor (31.07.2026): v2.15.0 PRODUKTIV LIVE ✅ – verifiziert.** `/api/health` ok/production,
  Version **2.15.0** im ausgelieferten `index`-Bundle (`2.14.2` = 0 Treffer), der in v2.15.0 neue Text
  „Lieder konnten nicht geladen werden." im `AllSongs`-Chunk, die Menü-Texte der drei neuen
  Komponenten im `ChordChart`-Chunk. `/api/update-check` meldet 2.15.0 = laufende Version → kein
  Update-Hinweis mehr. ⚠️ **Gelernt: Zwischen Tag und Deploy sehen ALLE Nutzer „neue Version"** –
  `useUpdateCheck` vergleicht das GitHub-Release (LATEST) mit der laufenden Version, nicht mit dem
  Server-Stand. Tag und Deploy zeitlich zusammenlegen.
  ⚠️ **Auch gelernt: v2.15.0 brachte KEINEN neuen sichtbaren Text mit** (nur Umbauten und
  Rechenkorrekturen). Für die Deploy-Verifikation musste der Marker maschinell gesucht werden
  (String-Literale heute gegen den Vorgänger-Tag) – bei reinen Refactoring-Releases ist die aus
  `VITE_APP_VERSION` injizierte Versionsnummer der Hauptbeleg.
  Testlauf-Issue: **#242** (auf 16 Pflichtfälle gekürzt, auf Staging `staging-41a710a` abgenommen).
  In v2.15.0 enthalten: Seiten-Engine aufgeteilt (#193), Ablauf-Ansicht und `setlistBuilder`
  aufgeteilt (#232/#230), Persistenz raus aus den Komponenten (#231), Prettier-Prüfung in der CI
  (#233), Testmanagement für die manuellen Tests (#234, `docs/tests/` + `npm run testplan`),
  Kleinkram aus den Sammel-Issues (#229 → #215/#199/#192), `{title}`/`{artist}` aus dem ChordPro
  (#236) und die Chart-Ansicht entlastet (#198 abgeschlossen: Lied-Menü, Aussehen-Menü und
  „Notizen von …"-Wähler heraus, `ChordChart` 1053 → 812 Zeilen). Nutzersichtbar davon: #236, der
  Kapo im geteilten PDF (#239 – dabei gefunden), Querformat nach Rückkehr aus dem Hintergrund und
  die einheitliche Titel-Darstellung (beide #215) – der Rest ist intern.
  Davor v2.14.1: Titel eines Lied-Punkts ist
  änderbar und wird zusammen mit dem Liednamen angezeigt – wie in ChurchTools (Lied – Du großer Gott)
  (#200); Konto-Obergrenze für Lied-Einstellungen (#195); Login-Bremse wirkt auch bei IPv6 (#146);
  Datei-Abrufe folgen keinen Weiterleitungen (#199); iOS-Tastatur in Dialogen sperrt die Trefferliste
  nicht mehr aus und die Kopfleiste bleibt sitzen (#207, v2.14.1).
  Davor (v2.13.6): Abgelaufene Anmeldung führt überall sauber zum
  Login statt in eine „Erneut versuchen"-Sackgasse (#186, globaler 401-Fänger), Kopfleiste springt
  nicht mehr beim Schließen eines Dialogs (#187, stabile Safe-Area `--sat`), Delta-Nachschliff (#152).
  Davor: gelöschte Ablaufpunkte lösen sich immer sichtbar auf (#178), ErrorBoundary heilt Chunk-Fehler
  (#176), UI-Monolithen aufgeteilt + Interaktionskern getestet (#140/#141, v2.13.4/.5).
  Live-Aktualisierung (Terminliste + offener Ablauf gleichen sich selbst ab), Ablauf-Änderungs-
  Markierung (#143/#161: geänderte Punkte leuchten auf, entfernte lösen sich im „poof"-Partikel-Effekt
  auf), Lied-Statistik mit Zeitfilter (#158) + volle sortierbare Lied-Auswahl beim Hinzufügen/
  Verknüpfen (#157), Bearbeiten-Dialog „alles erst mit Speichern", Code-Check-Härtungen (u.a.
  sha256-Fingerprint, seen-setlists aufs Volume, Datei-Proxy). Davor: Team-Notizen (#124, v2.9.0,
  PCO-Modell), Rechte-Cache (v2.8.1), Code-Splitting (#142). Onboarding-Pflege ist verbindlich →
  Sektion „Onboarding / Geführte Einführung".
- **Fertig & produktiv:** App funktional vollständig (Charts + automatisches Transponieren,
  ChordPro-Editor, Dokumenten-Viewer, kompletter Ablauf + Bearbeiten, „Alle Lieder" mit
  Statistik, rechtebewusste UI). Auf dem NAS deployt (Container Manager, `worship-charts`),
  **intern** `http://<NAS-IP>:3001` und **extern** `https://musik.ecg-donrath.de` live.
- **Redesign live (19.06.2026):** ChurchTools-Look ist auf `main` und **produktiv** unter
  `https://musik.ecg-donrath.de`. (Aktuelle Testzahlen stehen NUR in `docs/entwicklung/testkonzept.md` –
  hier bewusst keine Zahl, damit sie nicht doppelt gepflegt werden muss.)
- **Test-Instanz dauerhaft (seit 25.06.2026):** `worship-charts-test` (`:3002`) läuft image-basiert
  mit **Auto-Deploy** (Staging-Image) – Abnahme neuer Features vor dem Prod-Release.
- **Verteilung an andere Gemeinden:** abgeschlossen (öffentliches Repo, MIT, GHCR-Images, `deploy/`-Paket
  mit Setup-Skripten). Selbst-Hosting-Anleitung: `INSTALL.md` + `UPDATE.md`.
- **🔴 CODE-CHECK 31.07.2026 (nach v2.15.0): Qualität professionell, Note 2 · Sicherheit 0 kritische,
  0 hohe Funde.** Gelobt: **kein einziges `any`** im Produktivcode (als Fehler erzwungen), kein
  `@ts-ignore`, ausnahmslos gelebte Server-Schichtung, der Compile-Wächter Zod↔Typ in
  `annotationsController.ts:38-45`, CSP ohne `unsafe-inline` mit automatisch nachgezogenem
  Script-Hash (live gegen Prod verifiziert), kein IDOR, kein Path-Traversal, SSRF im Datei-Proxy
  doppelt zu (Host-Präfix **plus** `redirect: 'manual'`), `npm audit --omit=dev` = 0. **Der
  Sub-Router-Footgun aus dem Geräteverleih existiert hier NICHT** (jede Route einzeln geprüft).
  **Alle Funde als Issues: #245–#251.** ⚠️ **Die drei hohen Funde sind ALLE dieselbe Fehlerklasse –
  „dieselbe Regel an einer zweiten Stelle, Korrektur nur an einer":** #245 (`annotations.ts` fehlt die
  Härtung, die `userSettings.ts` unter #213 schon hat → Anmerkung verschwindet nach fehlgeschlagenem
  Upload), #246 (Migrations-Merker wird auch nach Fehlschlag gesetzt → Übernahme dauerhaft verpasst),
  #247 (`settingsForLevel` ohne `intOr` – **40 Zeilen unter der Funktion, die am selben Tag dagegen
  eingeführt wurde**). Dazu #250: `annotationKeys.ts` nennt sich „zentrale Grammatik", die Erzeuger in
  `ChordChart.tsx:340-369` bauen die Schlüssel aber selbst – und der Test dazu prüft **Literale statt
  Erzeuger**, bleibt also bei genau diesem Fehler grün. **Konsequenz: Pflichtschritt „nach der zweiten
  Stelle suchen" ist jetzt in der globalen CLAUDE.md und als Schritt 1b im `/festhalten`-Skill
  verankert.**
- **Zuletzt erledigt (31.07.2026): v2.15.0 getaggt.** Vier nutzersichtbare Korrekturen – `{title}`/
  `{artist}` aus dem ChordPro werden übernommen (#236), „Als PDF teilen" rechnet den Kapo mit (#239),
  Querformat nach Rückkehr aus dem Hintergrund und einheitliche Ablauf-Titel (beide #215) – plus
  **#198 komplett abgeschlossen** (alle sieben Pakete, im Code gegengeprüft). Tests Client 319 /
  Server 168, 57 manuelle Testfälle. Keine neuen Bedienelemente → Einführung bewusst unverändert;
  gegengeprüft, dass die vier aufgeteilten Dateien kein `data-tour`-Ziel verloren haben (Coachmarks
  überspringen fehlende Ziele STILL).
- **Davor (27.07.2026): v2.14.2 – in Prod, am ausgelieferten Bundle verifiziert.**
  Enthält die drei Folgefehler aus #186: **#210** (falsches Passwort löscht die Offline-Reserve),
  **#211** (401-Fänger wandert nach `services/api.ts`, sieht jetzt auch Anmerkungs-/Einstellungs-Sync),
  **#218** (Offline→Online-Hänger im Login) sowie #212 (`agendaItemWritePayload` ausgelagert + 11
  Tests), #213 (Konto-Limit blockiert Aufräumen nicht mehr), #214 (`trust proxy: 'loopback'`, echter
  Express-Test), #197 (Liederheft-PDF raus aus dem Render), #192 (Tests `chordPdf`/`annotations`),
  #198/#215 (Nachschliff, u. a. `ctCookie()` statt 29 `as string`). Tests: Client 185 / Server 150.
  Davor v2.14.0 (#200 Titel bei Lied-Punkten, #195, #146) und v2.14.1 (#207 iOS-Tastatur in Dialogen);
  v2.13.6: globaler 401-Fänger (#186), Safe-Area `--sat` (#187), Nachschliff (#152).
- **Bestätigte ChurchTools-Eigenheit (26.07.2026, am Gerät verifiziert):** Ein Lied-Punkt hat in CT
  einen **eigenen Titel UND** ein verknüpftes Lied. CT **behält** einen selbst gesetzten Titel und
  zeigt beides an; der Titel ist unabhängig vom Lied schreibbar (`title` + `arrangementId` in EINEM
  PUT). Bei der ECG heißen die Lied-Punkte per Vorgabe schlicht `Lied`.
- **Onboarding bewusst NICHT angepasst** (Release-Routine Schritt 2): #200 brachte kein neues
  Bedienelement (das Titelfeld gab es schon, es war nur gesperrt) und der Tour-Text „…um Titel,
  Dauer, Zuständige zu ändern…" stimmt jetzt sogar erst; #207 ist ein reiner Layout-Fix.
- **#193 erledigt (27.07.2026, am iPad geprüft):** `PageDeck` 1161 → **713 Zeilen**, abgeschaltete
  Hook-Prüfungen **13 → 1**. Neu: `hooks/usePageCanvases` (Seiten malen + Bild-Vorrat),
  `hooks/useZoomOrchestration` (Pinch-Zoom **komplett** – vorher 3 Refs, 4 Effekte und 4
  Gesten-Callbacks verstreut), `hooks/usePageNavigation`, `components/PageTextLayer`, `SlidePanes`,
  `PageDrawToolbar`, `utils/textObjStyle` (Textstil stand 3× fast gleich da → Drift lässt Text beim
  Blättern springen, #113), `utils/pageKeys` + `hooks/useLatestRef`/`useRefPair`.
  **Das Muster zum Merken:** `drawKeyFor`/`zoomKeyBaseFor` sind Props und je Render NEUE Funktionen –
  deshalb waren die Prüfungen aus. Abhängigkeit ist jetzt ihr **Ergebnis** (Signatur über die
  Seitenschlüssel + `useMemo`), nicht die Funktion. Das schloss eine stille Lücke: Ein
  Schlüsselwechsel ohne Seiten-/Sync-Wechsel ließ den alten Strich-Stand stehen.
  ⚠️ Das eine verbliebene Disable ist begründet (`overlayTexts`: `syncTick` ist ein reines
  Speicher-geändert-Signal, das der Rumpf nicht liest).
- **Offen / optional:** CT-Cookie nicht mehr im App-Cookie (#194, Architektur); Staging härten
  (#196, reine NAS-/Konfigurationsarbeit); Restpunkte aus #198/#215 und Kleinkram-Rest (#199);
  `migrateLocalAnnotations` weiter ohne Test (Rest von #192).
  Dazu: Musik-Verfügbarkeit/Abwesenheiten als App-Modul (#177, Plan in
  `docs/entwicklung/plan-verfuegbarkeit-phase1.md`); voller Auth-Flow-E2E mit CT-Stub (#174);
  Push-Benachrichtigung (#144), BPM-Puls (#145), Objektradierer/Vektor-Striche (#134).
  Erledigt: #193/#200/#195/#146(komplett)/#207/#186/#187/#152/#178/#176/#140/#141/#161/#124/#32/#45/#46/#47.
  **#175 (OAuth-Spike) am 27.07.2026 als überholt GESCHLOSSEN:** In einer ChurchTools-Extension
  (`/ccm/`) läuft die Anmeldung automatisch über die CT-Session im gleichen Context – dort braucht
  es kein OAuth, und der Session-Proxy entfällt von selbst. Wieder aufmachen nur, falls die
  Extension-Schiene scheitert; die offene Frage wäre dann unverändert der Umfang eines Access-Tokens.

## Deployment-Stand (NAS) – wichtige Lernpunkte

- Prod läuft image-basiert (GHCR) im Container Manager (Projekt `worship-charts`, Port 3001).
- **⚠️ Reihenfolge beim Prod-Update (zwei Vorfälle am 26.07.2026):**
  **1. `sudo docker pull ghcr.io/falwin/churchtools-musik-app:2`** ausführen und den Erfolg prüfen,
  **2. erst dann** Stopp → Aktion › Löschen (Volumes NICHT) → Projekt › Erstellen.
  Gründe – beide real passiert:
  - **Der Pull IST der Update-Schritt.** Compose/Container Manager ziehen bei vorhandenem Tag **nicht**
    neu, sondern nehmen das lokal liegende `:2`-Image. Ohne Pull läuft nach dem „Erstellen" die ALTE
    Version weiter (so blieb v2.14.1 unbemerkt auf v2.14.0 stehen). Gegenprobe:
    `sudo docker images --digests | grep churchtools-musik-app` → Digest muss zum Release passen.
  - **Erst löschen, dann pullen = Ausfall.** Scheitert der Pull, steht Prod ohne Container da (HTTP 502).
    Genau das passierte, weil ein **veralteter `ghcr.io`-Login auf dem NAS** jeden Pull mit
    `denied: denied` abwies – obwohl das Image öffentlich ist: Docker nutzte die kaputten
    gespeicherten Zugangsdaten statt anonym zu ziehen. **Fix: `sudo docker logout ghcr.io`.**
    Die Meldung führt auf die falsche Spur (klingt nach fehlenden Rechten bei GitHub).
- **Verifikation nach dem Deploy** (nicht nur `/api/health`, das sagt nur „irgendeine Version läuft"):
  ausgeliefertes Bundle prüfen – `curl -s https://musik.ecg-donrath.de/ | grep -o '/assets/index-[^"]*\.js'`,
  dann in dieser Datei die Versionsnummer suchen. Bei Änderungen in nachgeladenen Seiten (Setlist,
  ChordChart) zusätzlich die Chunks aus `/sw.js` prüfen – Code-Splitting heißt, dass ein neuer
  Setlist-Fix NICHT im Haupt-Bundle steckt.
  ⚠️ **Nicht über Chunk-Dateinamen verifizieren** (27.07.2026 nachgemessen): Zwei lokale Builds
  desselben Commits erzeugen bei mehreren Chunks (`index`, `Setlist`, `ChordChart`, `Settings`,
  `AllSongs`, `logoAsset`, `dndAutoScroll`, `useSongFilter`) **unterschiedliche Hashes** – der Build
  ist nicht reproduzierbar, ein Hash-Unterschied zu Prod beweist also gar nichts. Verlässlich sind
  nur **Inhalte**: `VITE_APP_VERSION` (die Versionsnummer steckt im `index`-Bundle) und ein
  markanter Text-/Code-Schnipsel des jeweiligen Fixes.
- Prod-`.env` auf dem NAS: `CHURCHTOOLS_BASE_URL` + `SESSION_SECRET` (**kein** Login-Token!).
- **Cookie `secure` per Env `COOKIE_SECURE`:** In Prod **`true`** (seit 13.07.2026; Zugang nur über
  HTTPS via Synology-Reverse-Proxy, Prod-Port an `127.0.0.1:3001` gebunden). `trust proxy` ist in Prod
  gesetzt. Bei reinen HTTP-Instanzen (z. B. andere Gemeinden im LAN) `COOKIE_SECURE` weglassen/`false`,
  sonst speichert der Browser das Session-Cookie nicht → „nicht angemeldet" nach Login.
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
  - „Einzelne Song-Kategorien sehen (view songcategory)" – sonst nichts. Kein Service-Konto nötig.

## Berechtigungsmodell (Capabilities)

- Server liest beim Login `/api/permissions/global` (Modul `churchservice`) → `parseCapabilities`
  (`server/src/services/churchtools.ts`) leitet ab: `canViewSongs`/`canViewAgendas`/`canEditSongs`/
  `canEditAgendas` (aus `view/edit songcategory|agenda`) + `isAdmin` (aus `ADMIN_PERMISSION`, Default
  `churchcore:administer persons`; **Admin ⇒ alles**). Die Fähigkeiten steuern die Client-UI (`App.tsx`,
  Tabs/Knöpfe); serverseitig erzwungen wird `requireSession` (alle Datenrouten) + `requireAdmin`
  (`PUT /api/site-config`, `GET /api/groups`, `GET /api/groups/:id/roles`). Fachliche Schreibrechte
  setzt ChurchTools selbst durch (die App reicht das Nutzer-Cookie durch und gibt 403 weiter).
- **Musiker-Gruppen (v2.8.0, Fundament für #124):** `canUseGlobalNotes` = aktives Mitglied **einer** der
  in `site.json` konfigurierten **`musicianGroupIds`** (Admin wählt sie im Mehr-Tab per Mehrfachauswahl,
  Dropdown aus `GET /api/groups`). Check: `getActiveGroupIds(cookie,userId)` → `/api/persons/{id}/groups`
  (Filter `groupMemberStatus==="active"` + kein `memberEndDate`; Gruppen-ID steckt in
  `group.domainIdentifier`). ECG-Musikteam = Gruppe 9. **Kein Admin-Bypass** („nur Musiker"). Die
  eigentlichen Team-Notizen sind **seit v2.9.0 fertig** (#124 geschlossen, PCO-Modell: Anmerkungen
  bleiben pro Konto, wer mag teilt sie, Berechtigte sehen/importieren sie – `teamNotesController.ts`).
  Die früher geplante gemeinsame „Team-Ebene" (`_shared.json`) wurde bewusst verworfen.

## Schreibzugriff (Editor) – ChurchTools-Eigenheiten

- Schreibende Calls brauchen ein CSRF-Token (`GET /api/csrftoken`) + Session-Cookie.
- Upload: `POST /api/files/song_arrangement/{arrId}` multipart, Feld `files[]`.
- Löschen: `DELETE /api/files/{fileId}` (fileId aus der fileUrl `?…id=` extrahiert).
- Versionen werden als separate `"<Titel> — <Name> (App).chordpro"` gespeichert (Original bleibt
  unangetastet); abwärtskompatibel zu Bestandsdateien `"(ECG)"` sowie alt `"— Bearbeitet.chordpro"`/
  `"— ECG.chordpro"` (Name „Bearbeitet"). Marker `(App)` ist bewusst gemeinde-neutral (früher `(ECG)`).
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

- [ ] ⚠️ **Login-Token aus lokaler Dev-`.env` entfernen – NICHT erledigt (Stand 31.07.2026).** Der
      Haken hier war falsch: `CHURCHTOOLS_LOGIN_TOKEN` ist in der lokalen `.env` **gefüllt** (im
      Sicherheits-Review nachgeprüft, ohne den Wert auszugeben). Er trägt die vollen persönlichen
      ChurchTools-Rechte. Die Datei ist korrekt gitignoriert und war nie im Repo – das Risiko ist rein
      lokal (Geräteverlust, Backup). **Zu tun: Token in ChurchTools widerrufen, Zeile leeren.**
- [ ] **Funde aus dem Code-Check 05.08.2026 abarbeiten** – vier hohe (#273, #274, #275, #276), vier
      mittlere (#277, #278, #279, #280), drei niedrige (#281, #282, #283). Die vier hohen sind
      viermal dieselbe Lehre („vorübergehend ≠ ungültig") und der sinnvollste nächste Schritt.
- [ ] **#196 auf dem NAS anwenden** – der einzige Punkt mit realem aktuellem Risiko: solange die
      Test-Instanz auf allen Interfaces lauscht und ohne `COOKIE_SECURE` läuft, wandert das
      Sitzungs-Cookie unverschlüsselt durchs LAN. **Braucht vorher einen Reverse Proxy auf die
      Test-Domain** – sonst sperrt `COOKIE_SECURE=true` alle aus.
- [x] Test-Service-Konto/Token #1012 in ChurchTools gelöscht (14.06.2026)
- [x] White-Label (Farb-Anpassung) verworfen → feste CT-Version (Redesign live, 19.06.2026)
- [x] Verteilung an andere Gemeinden (Selbst-Hosting) – abgeschlossen (öffentlich, MIT, `INSTALL.md`)
- [x] Offline-Reserve (Issue #32) – umgesetzt & produktiv seit v2.6.0; Plan bleibt als Referenz:
      `docs/entwicklung/plan-offline-reserve.md`
- [ ] Musik-Verfügbarkeit/Abwesenheiten als App-Modul – **optional**, aus dem Kern-Projekt
      herausgenommen (22.06.2026, siehe `docs/entwicklung/PROJEKTPLAN.md`); lebt als Issue #177 mit Plan
      in `docs/entwicklung/plan-verfuegbarkeit-phase1.md`
