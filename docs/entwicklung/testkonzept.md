# Testkonzept

Schwerpunkt auf **reiner Logik und serverseitigem Verhalten, das man von Hand kaum
vollständig durchprüfen kann**. Die App hat keine eigene DB; UI-Feinheiten werden
zusätzlich manuell (bzw. auf Staging) geprüft. Stand nach #314: **96 Testdateien** –
**63 Client (528 Tests)** + **33 Server (347 Tests)** mit Vitest + **5 Playwright-E2E** (Render-Smoke + voller Auth-Flow).

## Umfang

| Ebene                                        | Status               | Tool                         | Ort                                           |
| -------------------------------------------- | -------------------- | ---------------------------- | --------------------------------------------- |
| Unit (Client-Logik)                          | aktiv                | Vitest                       | `client/src/**/*.test.ts(x)`                  |
| Client-Hooks/-Komponenten (Interaktionskern) | aktiv                | Vitest (jsdom)               | `client/src/{hooks,components}/**/*.test.tsx` |
| Server-Services/-Controller/-Middleware      | aktiv                | Vitest (ChurchTools gemockt) | `server/src/**/*.test.ts`                     |
| E2E Render-Smoke (ohne Login)                | aktiv (CI-Job `e2e`) | Playwright                   | `e2e/chart-smoke.spec.ts` (`?demo=chart`)     |
| E2E voller Auth-Flow (Login→Sync)            | aktiv (CI-Job `e2e`) | Playwright + CT-Stub         | `e2e/auth-flow.spec.ts` + `e2e/ct-stub.mjs`   |

**Befehle:** `npm test` (alle Vitest), `npm run test:cov` (mit Coverage),
`npm run test:watch` (Watch-Modus, im Client), `npm run test:e2e` (Playwright).
Der Render-Smoke fährt den Dev-Server hoch und lädt `?demo=chart` (mountet die Chart-Ansicht ohne
ChurchTools-Login) → prüft, dass die PDF-Seiten rendern und keine unbehandelte JS-Ausnahme auftritt.

**Auth-Flow (#174):** Dafür laufen drei Prozesse – der ChurchTools-**Stub** (`e2e/ct-stub.mjs`), der
**echte** Server (mit seiner echten Session-, Rechte- und Proxy-Logik, nur auf den Stub gerichtet) und
der Client. Geprüft wird der Weg, der im Gottesdienst zählt: Anmelden → Terminliste (also Login,
Session-Cookie **und** Rechte-Abfrage) → Ablauf mit Lied-Punkt (#200) → Chart (Seitenstrom aus dem
ChordPro der Stub-Datei) → Strich zeichnen → **`PUT /api/annotations/…` mit Status 200**, wobei der
Schlüssel der Grammatik aus #250 folgen muss. Dazu: die geführte Einführung erscheint beim ersten
Öffnen, und ohne Anmeldung steht die Anmeldemaske statt einer „Erneut versuchen"-Sackgasse (#186).
Genau in diesem Bereich lagen die teuersten Fehler dieses Projekts – #186, #211, #245, #256.

## Server-Tests (ChurchTools gemockt)

- `services/setlistBuilder` + `getAgendaItems` – Ablauf-Mapping, Uhrzeiten/Dauer, Diff (LIS), Fingerabdruck
- `services/songUsage` – Spieltermine je Lied, Zukunft ausgeschlossen, Caching
- `services/seenSetlists` – „gesehen"-Basislinien-Store (atomar, Cleanup)
- `services/capabilitiesCache` + `churchtools(.capabilities)` – Rechte-Cache, CT-Aussetzer überbrücken
- `services/annotations` – Anmerkungen pro Konto inkl. Obergrenzen (#139)
- `controllers/setlistController.filetype` – Datei-Proxy Content-Type-Whitelist (#138)
- `middleware/session` – signiertes Session-Cookie, Ablauf/Format
- `services/userSettings` – Konto-Obergrenzen der Lied-Einstellungen (#195): Grenzlogik, Eintrags-
  und Byte-Grenze, Wert-Kappung, Schlüssel-Filter. Auch der Fall „Store liegt schon ÜBER der Grenze,
  Löschen muss trotzdem gehen" ist abgedeckt (#213, `server/src/services/userSettings.test.ts`)
- `utils/ipKey` – Rate-Limit-Schlüssel (#146): gleiches /64 ⇒ gleicher Schlüssel, verschiedene /64
  getrennt, IPv4-mapped wie IPv4, Zone-Index, Normalisierung, unparsebar, leer
- `services/buildSong.head` – Kopfangaben aus der ChordPro-Datei (#236): `{title}`/`{artist}`
  schlagen Liedname/Autor aus ChurchTools, ohne sie bleibt der CT-Wert stehen, ein leeres
  `{title: }` ersetzt nichts. Hängt bewusst an `getSongChart` und damit an der **Verdrahtung** in
  `buildSong` – der Fehler war ja nicht `metaValue`, sondern die fehlende Nutzung
- `middleware/session.crypto` – Cookie-Verschlüsselung (#194): das CT-Cookie steht **nicht** im
  Klartext im App-Cookie, Hin- und Rückweg ergeben dasselbe, jedes Setzen erzeugt einen anderen Wert
  (frischer IV), ein manipulierter Wert gilt als KEINE Session. Dazu die drei **Bestandsformate**
  (mit/ohne Konto-ID, nur CT-Cookie) – sie müssen weiter gelesen werden, sonst meldet ein Update alle
  ab. Und `sessionRateKey`: zwei verschieden verschlüsselte Cookies derselben Sitzung ergeben DENSELBEN
  Rate-Limit-Schlüssel – ohne diese Stabilität wäre das Limit nach #194 still wirkungslos gewesen
- `middleware/session.rolling` – rollierende Verlängerung trägt Login-Zeitstempel **und** Konto-ID
  weiter (#152); Altformat ohne ID bleibt nutzbar
- `controllers/siteConfigController.trim` – `GET /api/site-config` liefert unauthentifiziert **keine**
  `musicianGroupIds`/`noteRoles` (auch nicht bei abgelaufener Session), angemeldet die volle Konfig (#152)
- `services/churchtools.filelimit` – Datei-Proxy (#248): die Obergrenze greift bei der
  **angekündigten** Größe (ohne zu laden), bei **fehlender** und bei **lügender** Ankündigung (dort
  zählt der Leser mit); genau an der Grenze ist noch in Ordnung. Dazu die Fehlerbilder: eine
  Zeitüberschreitung wird **504**, ein echter Netzfehler bleibt er selbst, und der Host-Wächter aus
  #199 fragt eine Fremd-URL gar nicht erst an
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

`utils/adminDrafts` (#251 – die Vergleiche, die „ungespeicherte Änderungen" erkennen: beide
reihenfolgeunabhängig, und eine Gruppe ohne Rollen zählt als nicht vorhanden – sonst meldet der
Entwurf ein falsches „geändert" und warnt beim Schließen ohne Grund),
`components/DrawToolbar` (#251 – die Leiste, die Musiker im Gottesdienst anfassen, stand bei 0 %:
zweiter Tipp aufs aktive Werkzeug öffnet die Strichstärken statt zu wechseln, Werkzeugwechsel schließt
sie, ausgewählter Text öffnet den Text-Balken von selbst, und das Einklappen landet im **Geräte-**
Namensraum `worship:` statt im Konto-Namensraum), `utils/streamCompose` (#251 – die Zusammensetzung
des Seitenstroms: Reihenfolge, `localPage` je Lied neu gezählt, Versions-Schlüssel je Ebene, ein Lied
ohne Seiten verschiebt die Zuordnung der anderen NICHT, und der Rückfall von einem nicht ladbaren
Dokument auf die Akkorde wird **gemeldet** statt still),
`components/SongMenu` (#198: **jede Auswahl schließt das Menü** – der Aufruf stand vorher elf Mal
einzeln da; und was bei einem angezeigten Dokument NICHT erscheinen darf, weil es sich auf den
ChordPro-Text bezieht), `components/ChartAppearanceMenu` (A−/A+ nicht vertauscht, an den Grenzen
bleibt der Wert stehen), `components/SharersSheet` (beide Stufen, und **beide leeren Fälle sagen
einen Satz dazu** – eine stumme leere Liste ist eine Sackgasse), `chartSettings.stepFontSize`
(Zweierschritte, Grenzen halten), `chartSettings.settingsForLevel` (#247: **dieselbe Umrechnung wie
`loadSettings`, nur mit anderer Quelle** – Unsinn ergibt kein NaN, fehlende Werte kommen aus
`DEFAULT_SETTINGS`, und die Schlüssel-Rückfälle `_dlarge`/`_dphone`/song-only gelten auch beim
Ansehen fremder Notizen; dazu der Vertrag „Quelle Gerät liefert dasselbe wie Quelle Tabelle"), `chartPdfOptions.loadSongPdfOpts` (#239: der Weg über den Speicher
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

**Bekannte Test-Lücken:** derzeit keine offene, die als Issue geführt wird.

⚠️ **Korrektur (31.07.2026):** Hier stand bis heute „`migrateLocalAnnotations` ist weiterhin ungetestet
– Rest von #192". **Das war falsch** – die Funktion ist seit #229 (27.07.) mit 10 Tests abgedeckt, wie
der CHANGELOG-Eintrag zu #229 korrekt sagt; nur diese Seite wurde damals nicht nachgezogen. Die
veraltete Aussage hat prompt Folgefehler erzeugt: Der Prüf-Agent im `/code-check` übernahm sie, und
sie landete unhinterfragt im Issue #246. **Lehre: Auch eine Aussage über Tests im Code gegenprüfen –
und wenn zwei Doku-Stellen dasselbe behaupten, beide nachziehen.**
Die echte Lücke war eine andere und kleinere: von den Fehlerzweigen der Migration waren **401 und 413**
geprüft, der **vorübergehende Netz-/Serverfehler nicht** – genau dort saß #246. Jetzt 14 Tests
(`services/annotations.migrate`): Merker bleibt bei 500/offline/Teilerfolg aus, ein zu großer Eintrag
(413) verhindert den Abschluss dagegen NICHT. **Merkregel: „401 und 413 getestet" heißt nicht
„Fehlerfall getestet" – die Zweige einzeln prüfen.**

Neu abgedeckt: `services/annotations.flush` (#245, 9 Tests) – **der fehlgeschlagene Upload wird
zurückgelegt und wiederholt**, der Pull überschreibt die Seite danach NICHT (das war die eigentliche
Ausfallkette), 413 meldet dem Nutzer die Ursache, 401 schaltet ab ohne Wiederholung, ein neuerer
Strich gewinnt gegen den zurückgelegten und ein anderes Feld überlebt daneben. Aufbau bewusst von
`userSettings.flush.test.ts` (#213) übernommen – gleiche Fehlerklasse, gleicher Test.
Erledigt: `utils/chordPdf.ts` 0 → 87,7 % und `services/annotations.ts` 13 → 53,6 % (#192),
`agendaItemWritePayload` mit 11 Tests (#212).

**Erkannt im Code-Check 31.07.2026 (#251), teils erledigt:** `DrawToolbar.tsx` (479 Z.) ist seit
#251 mit `DrawToolbar.test.tsx` abgedeckt. Offen bei **0 %** bleiben `ChordEditor.tsx`
(360 Z.) und `PageDeck.tsx` (664 Z.) – die Werkzeugleiste ist das, was Musiker im
Gottesdienst tatsächlich anfassen. `client/vitest.config.ts` nimmt zudem `src/pages/**` und `App.tsx`
ganz aus der Messung, die größten Dateien tauchen also nicht einmal in der Statistik auf. Nicht
Coverage jagen, sondern die reinen Teile herauslösen (`commitInlineText`, `layerDown`) und die
Werkzeugleisten-Bedienung in jsdom prüfen; Zeigergerät-Nahes bleibt zu Recht manuell.

✅ **Erledigt in #250 – der Test schützt jetzt:** `services/annotations.keys.test.ts` prüfte `KEY_RE`
gegen **handgeschriebene Literale** statt gegen die Funktionen, die die Schlüssel erzeugen. Lieferte
`modeSeg` künftig `_lyrics` statt `_lyr`, wären alle Client-Tests grün geblieben und der Konto-Sync
still gestorben – also genau der Fehler, den der Test „zementieren" sollte. Seit #250 laufen die
Prüfungen gegen die **Erzeuger** (`drawKeyForOwner`/`zoomKeyBaseForOwner`, siehe Kopfkommentar der
Testdatei); die Literale stehen nur noch als zweite Absicherung des Formats daneben.
**Merkregel bleibt: Tests gegen die Erzeuger schreiben, nicht gegen Literale.**

## Manuelle Tests

Alles, was Finger, Stift, iOS-Tastatur oder echte Netztrennung braucht, steht als Testfall in
[`docs/tests/`](../tests/README.md) – mit Schritten, erwartetem Ergebnis und dem Feld **Betrifft**,
über das `npm run testplan` vor einem Release die betroffenen Fälle auswählt. Aktuell 60 Fälle,
davon 12 „immer prüfen".

## Regel für neue Fehler

Jeder gefundene Bug bekommt **(a)** ein GitHub-Issue (Vorlage „Fehlerbericht"), **(b)** – wenn er
reine Logik betrifft – einen Regressionstest, der nach dem Fix grün ist, und **(c)** – wenn er nur
am Gerät auffällt – einen Testfall in `docs/tests/` mit der Issue-Nummer unter **Historie**. Sonst
wiederholt sich derselbe Fehler in einem halben Jahr.
