# CLAUDE.md – Churchtools Musik App (Worship Charts)

> Dieses Dokument ist die verbindliche Referenz für alle
> Entwicklungssessions in diesem Projekt. Immer zuerst lesen!

## Projektübersicht
- **Was:** Progressive Web App (PWA), die Chord Charts der aktuellen Setlist aus ChurchTools
  abruft, automatisch auf die hinterlegte Tonart transponiert und im Gottesdienst anzeigt.
  Ersetzt WorshipTools Charts. ChurchTools bleibt einzige Datenquelle.
- **Für wen:** Worship-Team der ECG Donrath (Musiker + Bandleiter), oft wenig technikaffin.
- **Status:** In Entwicklung (Grundgerüst steht)
- **Repository:** lokal (Remote-Repo später – Entscheidung 11.06.2026: vorerst nur lokal/NAS)

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
| Deployment     | Docker auf Synology NAS            |
| Tunnel         | Cloudflare Tunnel                  |

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

## Domänen-Besonderheiten
- **ChordPro:** zwei Dialekte unterstützen – Standard (`{start_of_verse}`) UND
  SongSelect (`{comment: Vers}`, optionale Akkorde `[(E)]`, Bass-Akkorde `[E/G#]`)
- **Transponieren:** Original-Tonart aus der .chordpro-Datei, Ziel-Tonart aus dem
  ChurchTools-Arrangement-Feld; manuelles Transponieren nur lokal, kein Zurückschreiben
- **CCLI:** Lizenznummer 2395145, SongSelect Premium; CCLI-Infos pro Song anzeigen
- **Branding:** Teal #00616E, Orange #EB5E28 (Akkorde), Cream #FFFCF2

## Security-Checkliste
- [x] .env + .gitignore korrekt eingerichtet
- [x] Zod-Validierung auf allen API-Routen
- [x] helmet eingerichtet
- [x] express-rate-limit eingerichtet (zusätzlich striktes Limit am Login)
- [ ] Repository auf privat gestellt (kein Remote – vorerst lokal/NAS)
- [x] Authentifizierung: persönlicher ChurchTools-Login, Session in signiertem httpOnly-Cookie
- [ ] HTTPS (via Cloudflare Tunnel beim Deployment)
- [x] npm audit: zuletzt geprüft am 11.06.2026 – 3 moderate (esbuild/vite,
      nur Dev-Server, kein Prod-Risiko; Fix = vite@8 Breaking Change, zurückgestellt)

## Deployment
- **Ziel:** Synology NAS via Docker (+ Cloudflare Tunnel optional) → **umgesetzt**.
- **docker-compose.yml + Dockerfile:** vorhanden; ein Container liefert API + App aus.
- **Anleitung:** `DEPLOYMENT.md` (Schritt-für-Schritt, Synology Container Manager).
- **Domain/HTTPS:** noch offen (Cloudflare-Tunnel optional; bisher lokal über HTTP).

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
| 11.06.2026 | main   | Schritt 9: Deployment-Setup (Docker + Cloudflare optional) |
| 11.06.2026 | main   | **Auf NAS deployt** (Container Manager), lokal im WLAN live; Cookie-über-HTTP-Fix |

## So startest du die App lokal
```
cd ~/ecg-donrath/churchtools-musik-app
npm install        # einmalig
npm run dev:client # Frontend (Mock-Daten) -> http://localhost:5173
npm run dev:server # Backend (Health-Endpoint) -> http://localhost:3001
```

## Stand & nächster Schritt
- **Erledigt:** Schritte 1–9. App funktional vollständig (inkl. ChordPro-Editor +
  Dokumenten-Viewer), vom User abgenommen, und **auf dem Synology-NAS deployt**
  (Container Manager, Projekt `worship-charts`), lokal im WLAN live unter
  `http://<NAS-IP>:3001` (NAS-IP 192.168.10.188).
- **Offen / optional:** externer Zugang per Cloudflare-Tunnel (Domain müsste zu
  Cloudflare umziehen – `ecg-donrath.de` liegt aktuell woanders); Login-Token aus
  lokaler Dev-`.env` neu erzeugen/entfernen; Remote-Repo optional.

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
- **So lokal starten:** `npm run dev:server` UND `npm run dev:client` (beide!). Der Vite-
  Dev-Proxy leitet `/api` an `localhost:3001` weiter.
- **Bekannte Datenlücke:** Nicht alle Arrangements haben eine `.chordpro`-Datei (manche nur
  `.sng`/`.txt`) → Frontend zeigt dann „keine Akkord-Datei hinterlegt".

## API des eigenen Backends (für Schritt 8)
- `POST /api/auth/login` {email, password} → `{authenticated, user}` + setzt Session-Cookie
- `POST /api/auth/logout` → Session löschen
- `GET  /api/auth/me` → `{authenticated, user?}`
- `GET  /api/services?from=&to=` → `Service[]` (nur mit Setlist; Default-Fenster -7d…+42d)
- `GET  /api/services/:eventId/setlist` → `SetlistSong[]` (inkl. ChordPro original + ECG, documents[])
- `PUT  /api/songs/:songId/chordpro` {arrangementId, text} → bearbeitete ECG-.chordpro speichern
- `DELETE /api/songs/:songId/chordpro` {arrangementId} → ECG-Version löschen (zurück zum Original)
- `GET  /api/songs/:songId/files/:fileId` → PDF/Bild aus ChurchTools durchreichen (Viewer)

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

## Offene Punkte
- [ ] Schritt 7: echten per-User-Login bauen (POST /api/login). Token-Erkundung erledigt.
- [ ] NAS: Docker + Cloudflare Tunnel bereits eingerichtet?
- [ ] WorshipTools-Migration: wie viele Lieder? (Songs liegen teils schon als .chordpro in CT)
