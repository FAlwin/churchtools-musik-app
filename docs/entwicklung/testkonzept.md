# Testkonzept

Schwerpunkt auf **reiner Logik und serverseitigem Verhalten, das man von Hand kaum
vollständig durchprüfen kann**. Die App hat keine eigene DB; UI-Feinheiten werden
zusätzlich manuell (bzw. auf Staging) geprüft. Stand v2.13.x: **27 Testdateien**
(17 Client, 10 Server), ausgeführt mit Vitest.

## Umfang
| Ebene | Status | Tool | Ort |
|-------|--------|------|-----|
| Unit (Client-Logik) | aktiv | Vitest | `client/src/**/*.test.ts(x)` |
| Server-Services/-Controller/-Middleware | aktiv | Vitest (ChurchTools gemockt) | `server/src/**/*.test.ts` |
| E2E (voller Browser-Flow) | bewusst nicht | – | Kern-Flow manuell/Staging im Gottesdienst-Betrieb (Issue #141 offen) |

**Befehle:** `npm test` (alle), `npm run test:cov` (mit Coverage),
`npm run test:watch` (Watch-Modus, im Client).

## Server-Tests (ChurchTools gemockt)
- `services/setlistBuilder` + `getAgendaItems` – Ablauf-Mapping, Uhrzeiten/Dauer, Diff (LIS), Fingerabdruck
- `services/songUsage` – Spieltermine je Lied, Zukunft ausgeschlossen, Caching
- `services/seenSetlists` – „gesehen"-Basislinien-Store (atomar, Cleanup)
- `services/capabilitiesCache` + `churchtools(.capabilities)` – Rechte-Cache, CT-Aussetzer überbrücken
- `services/annotations` – Anmerkungen pro Konto inkl. Obergrenzen (#139)
- `controllers/setlistController.filetype` – Datei-Proxy Content-Type-Whitelist (#138)
- `middleware/session` – signiertes Session-Cookie, Ablauf/Format

## Getestete Client-Logik

### `transpose.ts` – Transponieren
- Einfache Dur-/Moll-Akkorde, Suffix-Erhalt (m7, sus4)
- Bass-Akkorde (Root **und** Bass transponiert, z. B. `E/G#`)
- b- vs. #-Schreibweise (`flat`-Flag)
- Optionale Akkorde in Klammern `(E)` (SongSelect-Dialekt)
- Oktav-Umlauf (B → C)
- Robustheit: leere Eingabe, unbekannter Root (deutsche Notation „H")
- `getSemitoneOffset` (aufwärts umwickelnd, Moll-Suffix ignoriert)
- `shiftKey` (Dur/Moll-Erhalt), Tonart-Listen vollständig (12/12)

### `chordpro.ts` – Parser (zwei Dialekte)
- `parseLine`: Text ohne Akkorde, führender Text, Akkord am Zeilenanfang, leere `[]`
- Standard-Dialekt: `start_of/end_of`-Blöcke, Kurzform `{chorus: 2}`,
  Typ-Normalisierung (`pre-chorus` → `pre_chorus`)
- SongSelect-Dialekt: `{comment: …}` → Typableitung, deutsche/englische Labels
- Sonderfälle: impliziter Vers, Metadaten überspringen, leere Abschnitte verwerfen,
  nachlaufende Leerzeilen entfernen
- `parseMetadata`: bekannte Felder lesen, unbekannte ignorieren

### Weitere Client-Logik
`songFilter` (Sortierung/Zeitfilter Lieder), `chartSettings`, `color`, `canvas`,
`chunkReload` (Reload-Schleifenschutz nach Deploy), `clearDeviceData` (Abmelde-Aufräumen),
`reachability`/`api.reachability`, `offline.registry`, `navStorage`, `dndAutoScroll`,
`annotations.keys`, `queryClient` sowie die Komponenten `Section`/`Segment`.

## Regel für neue Fehler
Jeder gefundene Bug bekommt **(a)** ein GitHub-Issue (Vorlage „Fehlerbericht") und,
wenn er reine Logik betrifft, **(b)** einen Regressionstest, der nach dem Fix grün ist.
