# Umsetzungsplan – Churchtools Musik App (Worship Charts)

*ECG Donrath · Technische Leitung: Alwin · Stand: 11. Juni 2026*

## Kontext

Das Worship-Team der ECG Donrath nutzt bisher WorshipTools Charts für Chord Charts im
Gottesdienst – das bedeutet doppelte Datenpflege neben ChurchTools. Ziel: eine eigene PWA, die
Setlisten und Chord Charts direkt aus ChurchTools zieht, automatisch auf die hinterlegte Tonart
transponiert und einfach zu bedienen ist – auch für wenig technikaffine Musiker.

Grundlage ist ein nahezu vollständiger Design-Prototyp (Claude-Design-Handoff). Dieser Plan folgt
verbindlich der ECG-Projektvorlage (`vorlage_neues-projekt.md`).

Festgelegte Entscheidungen:
- **Hosting:** Synology-NAS via Docker + Cloudflare Tunnel
- **Anmeldung:** persönlicher ChurchTools-Login pro Musiker
- **Repository:** vorerst nur lokal/NAS (kein GitHub-Remote)
- **Design:** Prototyp 1:1 als echte App umsetzen

## Tech-Stack (laut Vorlage)

| Bereich | Technologie |
|---|---|
| Frontend | React + Vite + TypeScript (PWA) |
| Styling | SCSS Modules, globale Vars in `styles/_variables.scss` |
| Datenfetching | TanStack Query (alle Calls über `services/`) |
| Formulare | React Hook Form + Zod |
| Backend | Node.js + Express + TypeScript |
| Datenbank | keine (ChurchTools ist Datenquelle; Notizen/Annotationen lokal) |
| Validierung | Zod (serverseitig auf allen Routen) |
| Deployment | Docker auf Synology NAS + Cloudflare Tunnel |

## Architektur

Eine reine Browser-App kann ChurchTools nicht direkt aufrufen (CORS + Login-Daten gehören nicht in
den Client). Daher **Fullstack**: das Express-Backend (`/server`) ist der Proxy + hält die persönliche
ChurchTools-Session; das React-Frontend (`/client`) redet nur mit dem eigenen Backend.

```
Handy/Tablet → /client (React PWA) → /server (Express-Proxy, Session) → ChurchTools REST API
```

Ordnerstruktur (npm-Workspaces-Monorepo):
```
churchtools-musik-app/
├── client/   src/{components,pages,hooks,services,utils,types,styles,assets}
├── server/   src/{routes,controllers,services,middleware,types,utils}
├── shared/types/   (geteilte Typen: Service, SetlistSong, Setlist, ChordProSection)
├── .env / .env.example / .gitignore
└── CLAUDE.md
```

## Phasen / Schritte

### ✅ Schritt 1 – Git & Grundstruktur *(erledigt)*
git init, .gitignore, .env.example, leere .env, Initial-Commit.

### ✅ Schritt 2 – Tooling & Code-Qualität *(erledigt)*
TypeScript strict, ESLint (TS-Plugin), Prettier (singleQuote, semi, tabWidth 2),
eslint-config-prettier – für client und server.

### ✅ Schritt 3 – Ordnerstruktur (Fullstack) *(erledigt)*
client (Vite+React+TS+SCSS Modules), server (Express+TS), shared/types.

### ✅ Schritt 4 – Sicherheits-Grundregeln *(erledigt)*
Secrets nur via .env; helmet, express-rate-limit, zentraler errorHandler; npm audit berichtet
(3 moderate, nur Dev-Server esbuild/vite, kein Prod-Risiko – zurückgestellt).

### ✅ Schritt 5 – CLAUDE.md *(erledigt)*
Aus Vorlage Abschnitt 2 befüllt (Tech-Stack, Konventionen, Security-Checkliste, Changelog).

### ✅ Schritt 6 – Frontend Design & Logik (Mock-Daten) *(erledigt, im Browser verifiziert)*
- Globales Theme nach `styles/_variables.scss` (Teal #00616E, Orange #EB5E28, Cream #FFFCF2)
- Screens als `pages/`: Login, Agenda, Setlist, ChordChart
- Wiederverwendbare Komponenten je mit `*.module.scss`
- Reine Logik in `utils/`: `transpose.ts`, `chordpro.ts` – **beide Dialekte**
  (Standard `{start_of_verse}` UND SongSelect `{comment: Vers}`, Klammer-/Bass-Akkorde)
- Geschäftslogik in `hooks/` (useSettings, useWakeLock, useDrawing, useLocalStorage)
- Einstellungen + Annotationen via localStorage
- PWA-Manifest + Icons

### ✅ Schritt 7 – Backend: ChurchTools-Proxy & persönlicher Login *(erledigt)*
- `routes/` → `controllers/` → `services/churchtools.ts`
- `POST /api/auth/login`: Zod-validiert, Session serverseitig, signiertes httpOnly-Cookie
- Proxy: events, agenda, songs/arrangements (inkl. `key`), Datei-Download
- helmet, strenges Rate-Limit am Login, zentraler Error-Handler

### ✅ Schritt 8 – Frontend an Backend anbinden *(erledigt)*
`services/` + TanStack Query statt Mock-Daten; automatisches Transponieren auf Ziel-Tonart.

### ✅ Phase 3 – Editor & Dokumente *(erledigt, vom User abgenommen 11.06.2026)*
- **ChordPro-Editor:** Text bearbeiten mit Live-Vorschau; speichert als separate
  `"<Titel> — ECG.chordpro"` in ChurchTools (Original bleibt), Umschalter ECG/Original,
  „Zurücksetzen" löscht die ECG-Datei. Auch Neuanlage, wenn keine Datei existiert.
- **Dokumenten-Viewer:** PDF/Bild eines Arrangements als Anzeige-Quelle (statt Akkorde),
  integriert im normalen Ablauf; mehrseitiges Blättern, Zoom/Anpassen pro Seite (gespeichert),
  Anmerkungen pro Seite. Auswahl pro Lied im Titel-Menü.

### ✅ Schritt 9 – Deployment *(lokal erledigt 11.06.2026)*
Dockerfile + docker-compose.yml; ein Container liefert API + App aus. **Auf dem
Synology-NAS deployt** (Container Manager, Projekt `worship-charts`), lokal im WLAN
live unter `http://<NAS-IP>:3001`. Anleitung in `DEPLOYMENT.md`.
- Offen/optional: Cloudflare-Tunnel (externer HTTPS-Zugang) – Domain müsste zu
  Cloudflare umziehen. PWA-Installation (Homescreen) funktioniert bereits.

### Schritt 10 (optional, später)
Externer Zugang via Cloudflare · Liederbibliothek-Suche · Metronom/BPM · weiterer Feinschliff

## Vor Schritt 7 an der echten ChurchTools-Instanz zu klären
1. Exakte API-Kette: Agenda → Song → Arrangement → Datei → Tonart-Feld
2. Name/Typ des Tonart-Felds am Arrangement (`key`?)
3. Erzwingt die Instanz 2-Faktor? → ggf. persönlicher Login-Token statt Passwort
4. NAS: Docker + Cloudflare Tunnel bereits eingerichtet?

## App lokal starten
```
cd ~/ecg-donrath/churchtools-musik-app
npm install        # einmalig
npm run dev:client # Frontend (Mock-Daten) -> http://localhost:5173
npm run dev:server # Backend (Health-Endpoint) -> http://localhost:3001
```
