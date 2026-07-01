# Plan: Offline-Reserve (Charts ohne Netz im Saal)

**Status:** Phase 1 umgesetzt (01.07.2026), auf Staging/Gerät im Flugmodus zu verifizieren. Phase 2
(expliziter „Für offline speichern"-Button) weiterhin optional/offen. Rein clientseitig – keine
Server-Änderung nötig.

**Umgesetzt (Phase 1):** React-Query-Cache wird in IndexedDB persistiert
(`client/src/queryClient.ts` + `PersistQueryClientProvider` in `main.tsx`; `gcTime`/`maxAge` 7 Tage;
`buster` = App-Version). Persistiert werden alle erfolgreichen Queries inkl. `['me']` → man bleibt
offline angemeldet, solange die Session gültig war. Datei-Downloads (`/api/songs/:id/files/:id`)
laufzeit-gecacht via Workbox `CacheFirst` (`worship-files`, 60 Einträge / 30 Tage) in
`client/vite.config.ts`.

## Problem / Ist-Zustand

- Die App ist eine PWA; Workbox **precacht die App-Hülle** (JS/CSS/Logo/Schriften) → die App
  startet offline und sieht normal aus.
- Die **Inhalte** (Termine, Ablauf/ChordPro, hochgeladene PDFs/Bilder) kommen **live** über `/api`
  vom Backend. Dafür gibt es **kein Caching**: kein Runtime-Caching für `/api`, keine persistente
  Speicherung der React-Query-Daten, kein Datei-Cache. → Ohne Netz im Saal bleibt alles leer.

## Ziel

Die Lieder/Charts (und der Ablauf) eines Gottesdienstes sind im Saal auch **ohne Netz** verfügbar,
sofern vorher online geladen und die Session noch gültig ist.

## Empfohlener Ansatz

**Phase 1 – „Angeschautes bleibt" (automatisch, mittlerer Aufwand):**

1. **React-Query-Persistenz**: `@tanstack/react-query-persist-client` + IndexedDB-Persister
   (z. B. `idb-keyval`). Queries `services`, `agenda`, `song-chart` persistent cachen
   (`maxAge` z. B. 7 Tage). → Was man online geöffnet hat, ist offline aus dem Cache da.
   ChordPro/Versionen stecken in der `agenda`-Query (`SetlistSong.chordpro`/`versions`) → automatisch
   mit abgedeckt.
2. **Datei-Downloads** (PDFs/Bilder über `GET /api/songs/:id/files/:fileId`): Workbox
   **Runtime-Caching** in `vite.config.ts` (`VitePWA → workbox.runtimeCaching`), Strategie
   `StaleWhileRevalidate` oder `CacheFirst`, `maxEntries`/`maxAgeSeconds` begrenzen. → Angeschaute
   Dokumente offline verfügbar.

**Phase 2 – expliziter „Für offline speichern"-Button pro GD (optional):**

- Button in der Setlist/Terminkarte, der proaktiv alle Charts + Dokumente des GD per Prefetch lädt
  und damit den Cache füllt – ohne dass man jeden Punkt einzeln öffnen muss. Fortschrittsanzeige.

## Tücken / offene Punkte

- **Login offline unmöglich:** Die Session (Cookie) muss gültig sein. Gecachte Daten (React-Query-
  Persist, SW-Datei-Cache) sind unabhängig von Auth lesbar, aber **neue** Calls scheitern (401).
  → Klare Grenze: „vorher online laden, Session gültig halten". Im UI ehrlich kommunizieren.
- **Cache-Größe:** PDFs sind groß. Cache-Storage-Limits beachten, `maxEntries`/`maxAge` setzen,
  alte GD verwerfen. Ggf. nur die nächsten/aktuellen GD cachen.
- **Frische:** Online aktuelle Daten (SWR/Refetch), offline der Cache-Stand.
- **Anmerkungen/Einstellungen:** liegen schon pro Konto serverseitig **und** in localStorage →
  offline aus localStorage lesbar (kein Server nötig). Push/Sync offline entfällt (ok).

## Aufwand / Test

- Phase 1: mittel. Neue Pakete: `@tanstack/react-query-persist-client`,
  `@tanstack/query-sync-storage-persister` bzw. ein IndexedDB-Persister. Workbox-`runtimeCaching`
  ergänzen. Keine Server-Änderung.
- **Testen nur auf echtem Gerät im Flugmodus** (vorher online GD öffnen → Netz aus → prüfen).
  Im Desktop-Preview kaum sinnvoll testbar.

## Reihenfolge

1. React-Query-Persist (Daten) – schnellster Gewinn.
2. Workbox-Runtime-Caching für Datei-Downloads (PDFs/Bilder).
3. Geräte-Test im Flugmodus.
4. Optional Phase 2: expliziter Offline-Button.
