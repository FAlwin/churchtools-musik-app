# Testkonzept

Schwerpunkt auf **reiner Logik und serverseitigem Verhalten, das man von Hand kaum
vollständig durchprüfen kann**. Die App hat keine eigene DB; UI-Feinheiten werden
zusätzlich manuell (bzw. auf Staging) geprüft. Stand nach #239: **62 Testdateien** –
**44 Client (319 Tests)** + **18 Server (168 Tests)** mit Vitest + **1 Playwright-E2E-Smoke**.

## Umfang

| Ebene                                        | Status               | Tool                         | Ort                                           |
| -------------------------------------------- | -------------------- | ---------------------------- | --------------------------------------------- |
| Unit (Client-Logik)                          | aktiv                | Vitest                       | `client/src/**/*.test.ts(x)`                  |
| Client-Hooks/-Komponenten (Interaktionskern) | aktiv                | Vitest (jsdom)               | `client/src/{hooks,components}/**/*.test.tsx` |
| Server-Services/-Controller/-Middleware      | aktiv                | Vitest (ChurchTools gemockt) | `server/src/**/*.test.ts`                     |
| E2E Render-Smoke (ohne Login)                | aktiv (CI-Job `e2e`) | Playwright                   | `e2e/chart-smoke.spec.ts` (`?demo=chart`)     |
| E2E voller Auth-Flow (Login→Sync)            | offen                | –                            | braucht ChurchTools-Stub (Issue #174)         |

**Befehle:** `npm test` (alle Vitest), `npm run test:cov` (mit Coverage),
`npm run test:watch` (Watch-Modus, im Client), `npm run test:e2e` (Playwright).
Der E2E-Smoke fährt den Dev-Server hoch und lädt `?demo=chart` (mountet die Chart-Ansicht ohne
ChurchTools-Login) → prüft, dass die PDF-Seiten rendern und keine unbehandelte JS-Ausnahme auftritt.

## Server-Tests (ChurchTools gemockt)

- `services/setlistBuilder` + `getAgendaItems` – Ablauf-Mapping, Uhrzeiten/Dauer, Diff (LIS), Fingerabdruck
- `services/songUsage` – Spieltermine je Lied, Zukunft ausgeschlossen, Caching
- `services/seenSetlists` – „gesehen"-Basislinien-Store (atomar, Cleanup)
- `services/capabilitiesCache` + `churchtools(.capabilities)` – Rechte-Cache, CT-Aussetzer überbrücken
- `services/annotations` – Anmerkungen pro Konto inkl. Obergrenzen (#139)
- `controllers/setlistController.filetype` – Datei-Proxy Content-Type-Whitelist (#138)
- `middleware/session` – signiertes Session-Cookie, Ablauf/Format
- `services/userSettings` – Konto-Obergrenzen der Lied-Einstellungen (#195): Grenzlogik, Eintrags-
  und Byte-Grenze, Wert-Kappung, Schlüssel-Filter. ⚠️ Lücke bekannt: der Fall „Store liegt schon ÜBER
  der Grenze, Löschen muss trotzdem gehen" ist NICHT abgedeckt (#213)
- `utils/ipKey` – Rate-Limit-Schlüssel (#146): gleiches /64 ⇒ gleicher Schlüssel, verschiedene /64
  getrennt, IPv4-mapped wie IPv4, Zone-Index, Normalisierung, unparsebar, leer
- `services/buildSong.head` – Kopfangaben aus der ChordPro-Datei (#236): `{title}`/`{artist}`
  schlagen Liedname/Autor aus ChurchTools, ohne sie bleibt der CT-Wert stehen, ein leeres
  `{title: }` ersetzt nichts. Hängt bewusst an `getSongChart` und damit an der **Verdrahtung** in
  `buildSong` – der Fehler war ja nicht `metaValue`, sondern die fehlende Nutzung
- `middleware/session.rolling` – rollierende Verlängerung trägt Login-Zeitstempel **und** Konto-ID
  weiter (#152); Altformat ohne ID bleibt nutzbar
- `controllers/siteConfigController.trim` – `GET /api/site-config` liefert unauthentifiziert **keine**
  `musicianGroupIds`/`noteRoles` (auch nicht bei abgelaufener Session), angemeldet die volle Konfig (#152)
- `services/updateCheck` – Cache-Fenster: Erfolg lang (6 h), Fehler/Offline nur kurz
  (`ERROR_CACHE_MS` 15 min) und danach erneuter Versuch → schützt das GitHub-Rate-Limit (#152)

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

### Interaktionskern (Hooks/Komponenten, #141)

- `hooks/usePageDraw` (jsdom): Laden aus localStorage, Text hinzufügen + **Push-Dedup**
  (unveränderter Re-Render pusht nicht erneut), **Undo/Redo** (Text), **Key-Wechsel** lädt die
  jeweilige Seite. Bewusst ohne echtes Canvas (Strich-Persistenz bleibt manuell/Staging).
- `components/Coachmarks`: Schritte durchlaufen (Fertig → onClose), Überspringen, Auto-Ende ohne
  Ziel-Element, Auto-Skip fehlender Schritte.
- `utils/strokes` (`mergeStrokes`, reine null-Zweige), `utils/vanishedRows` (lokale
  Auflöse-Platzhalter #178) und `utils/annotationKeys` (Schlüssel-Grammatik: Ebenen-Präfix,
  nicht-leere Notizen je Ebene, Ebenen-Gruppierung unter Namensraum) rein getestet.
- **Seiten-Engine, seit der Aufteilung von `PageDeck` (#193):**
  - `hooks/usePageCanvases` (jsdom, `getContext` gestubbt): Maße + Seitenverhältnis der Quellseite,
    Striche der sichtbaren Seiten laden, fremde Ebene aufs Overlay, Querformat bedient beide Seiten,
    Zoom-Wiederherstellung nach dem Malen. Vor allem: **ein geänderter Schlüssel zeichnet neu**
    (das war die stille Lücke der abgeschalteten Hook-Prüfungen), ein Render ohne Änderung dagegen
    NICHT. Dazu der Bild-Vorrat der Nachbarseiten inkl. 40er-Deckel und Aufräumen gelöschter Striche.
  - `components/PageTextLayer`: was gezeigt wird (eigene/fremde Texte, Zusammenführen-Vorschau, der
    bearbeitete Text steht genau EINMAL da) und **wann Text anfassbar ist** – mit dem Stift nie
    (man muss darüber zeichnen können), auf der inaktiven Hälfte nie (#53).
  - `utils/pageKeys` (Signaturen: gleiche Schlüssel → gleiche Signatur, jede Änderung schlägt durch,
    kein Verschmelzen) und `utils/textObjStyle` (u. a. Bestandstexte ohne `bold`-Feld bleiben fett).
    ⚠️ **Nicht durch Tests abgedeckt und weiterhin nur am Gerät prüfbar:** Stift/Finger/Marker/
    Radierer, Zwei-Finger-Abbruch, Handballen, Pinch-Zoom und der Slide-Übergang.

### Weitere Client-Logik

`components/SongMenu` (#198: **jede Auswahl schließt das Menü** – der Aufruf stand vorher elf Mal
einzeln da; und was bei einem angezeigten Dokument NICHT erscheinen darf, weil es sich auf den
ChordPro-Text bezieht), `components/ChartAppearanceMenu` (A−/A+ nicht vertauscht, an den Grenzen
bleibt der Wert stehen), `components/SharersSheet` (beide Stufen, und **beide leeren Fälle sagen
einen Satz dazu** – eine stumme leere Liste ist eine Sackgasse), `chartSettings.stepFontSize`
(Zweierschritte, Grenzen halten), `chartPdfOptions.loadSongPdfOpts` (#239: der Weg über den Speicher
kommt zum selben Ergebnis wie der direkte, inkl. Kapo-Abzug; Unsinn im Speicher ergibt **kein** NaN
im Versatz),
`chordPdf.chartHead` (Titel/Autor des Blatts, #236: `{title}`/`{artist}` des **gerenderten** Textes
gehen vor, leerer Wert zählt nicht, eine Version bestimmt den Kopf ihres eigenen Blatts),
`songFilter` (Sortierung/Zeitfilter Lieder), `chartSettings`, `color`, `canvas`,
`chunkReload` (Reload-Schleifenschutz nach Deploy, inkl. `isChunkLoadError` #176),
`clearDeviceData` (Abmelde-Aufräumen), `reachability`/`api.reachability`, `offline.registry`,
`navStorage`, `dndAutoScroll`, `annotations.keys`, `queryClient` sowie die Komponenten
`Section`/`Segment`. Dazu `queryClient.session401` – der **globale 401-Fänger** (#186): ein 401 aus
einer Query **oder** Mutation löst den Sitzung-abgelaufen-Pfad aus, ein 502 (offline) bewusst nicht.
Neu seit v2.14.x: `utils/agendaItemTitle` (Anzeige-Regeln für Lied-Punkte, #200 – inkl. „keine
Dopplung" und Groß-/Kleinschreibung) und `hooks/useKeyboardInset` (Tastatur-Aussparung #207, jsdom:
Höhe korrekt, nie negativ, Listener an/ab, Scroll-Reset, kein Absturz ohne `visualViewport`).

**Bekannte Test-Lücken (bewusst als Issues geführt, nicht vergessen):** `migrateLocalAnnotations`
(einmalige Übernahme lokaler Anmerkungen ins Konto) ist weiterhin ungetestet – Rest von #192.
Erledigt: `utils/chordPdf.ts` 0 → 87,7 % und `services/annotations.ts` 13 → 53,6 % (#192),
`agendaItemWritePayload` mit 11 Tests (#212).

## Manuelle Tests

Alles, was Finger, Stift, iOS-Tastatur oder echte Netztrennung braucht, steht als Testfall in
[`docs/tests/`](../tests/README.md) – mit Schritten, erwartetem Ergebnis und dem Feld **Betrifft**,
über das `npm run testplan` vor einem Release die betroffenen Fälle auswählt. Aktuell 56 Fälle,
davon 12 „immer prüfen".

## Regel für neue Fehler

Jeder gefundene Bug bekommt **(a)** ein GitHub-Issue (Vorlage „Fehlerbericht"), **(b)** – wenn er
reine Logik betrifft – einen Regressionstest, der nach dem Fix grün ist, und **(c)** – wenn er nur
am Gerät auffällt – einen Testfall in `docs/tests/` mit der Issue-Nummer unter **Historie**. Sonst
wiederholt sich derselbe Fehler in einem halben Jahr.
