# API des eigenen Backends

> Referenz der Endpunkte, die das Express-Backend dem Client anbietet (ausgelagert aus `CLAUDE.md`).
> ChurchTools-spezifische Schreib-/Lese-Eigenheiten stehen weiterhin in `CLAUDE.md`.
> Stand: 13.08.2026 (nach v2.21.0, inkl. der ungetaggten Liedverwaltung #321/#322).
> Alle `/api/...`-Routen erfordern eine gültige Session – **außer** `health`,
> `site-config` (GET), `update-check` und dem kompletten `auth/`-Router (`login`, `logout`, `me`;
> `me` antwortet ohne Session bewusst mit `{authenticated:false}`).
>
> **503 bei Drosselung (#300):** Antwortet ChurchTools mit **429** („zu viele Anfragen"), wird das zu
> einem **503** mit `Retry-After`-Kopf – bewusst nicht als 429, weil der Client einen 429 als „zu viele
> Anmeldeversuche" deuten würde. Betrifft **alle** ChurchTools-gestützten Endpunkte, weil es in `ctGet`
> sitzt. `/api/song-usage` liefert 503 zusätzlich **während seiner Sperrfrist**, also auch ohne einen
> ChurchTools-Aufruf. Ausnahme: `getCsrfToken` bildet ein CT-429 weiter auf **502** ab (mit dem
> CT-Status im Text).
>
> **401/403-Vertrag (wichtig für den Client):** `ctGet` reicht nur echte **401** als 401 weiter
> („Session abgelaufen"), ein **403** von ChurchTools bleibt **403** – denn jeder 401 löst im Client
> einen Zwangs-Logout aus (#152/#186). `getCsrfToken` mappt eine tote CT-Session dagegen bewusst auf
> **401** (nicht 502), damit auch ein Aussetzer beim Speichern sauber zum Re-Login führt.
>
> 🔴 **Das Session-Cookie heisst seit CT 3.136.2 `ChurchToolsV2_ct_<gemeinde>`** (#381, gemessen
> 03.09.2026); das alte `ChurchTools_ct_<gemeinde>` wird von der Anmeldung aktiv geloescht
> (`Max-Age=0`). `extractSessionCookie` akzeptiert `ChurchTools(V<n>)?_…` mit **nicht-leerem** Wert
> und nimmt bei mehreren Treffern die hoechste Fassungsnummer. Wurde der alte Name allein gesucht,
> schlug **jede** Anmeldung mit `502 Keine Session von ChurchTools erhalten.` fehl.
>
> ⚠️ **Folge davon: bei toter Session kommt kein 401 mehr** (#381):
> `/api/whoami` antwortet mit **200** und `{"id":-1,"lastName":"Anonymous"}`, `/api/permissions/global`
> mit **200** und lauter `false`. Nur `/api/csrftoken` verhält sich noch wie früher. `whoami()` erzeugt
> das 401 deshalb selbst, wenn die Antwort keine Person beschreibt (`id > 0`, gelesen mit `ctId`) –
> sonst hielte die App den Phantom-Nutzer für angemeldet.

## System / Auth / Konfiguration

- `GET  /api/health` → `{status, env}` (öffentlich, für Reverse-Proxy/Monitoring)
- `GET  /api/update-check` → neueste veröffentlichte Version (liest GitHub-Release; für den In-App-Hinweis)
- `GET  /api/site-config` → öffentlich `{ appName, description, orgName, links }` plus leere `musicianGroupIds`/`noteRoles`; **angemeldet die vollständige Konfiguration** (die internen Gruppen-/Rollen-IDs gelangen so nicht unauthentifiziert nach außen)
- `PUT  /api/site-config` → Gemeinde-Name/Anmerkungs-Zuweisungen speichern (nur Admin, Zod-validiert)
- `POST /api/auth/login` {email, password} → `{authenticated, user}` + setzt signiertes Session-Cookie
- `POST /api/auth/logout` → Session + ChurchTools-Session beenden
- `GET  /api/auth/me` → `{authenticated, user?}`
- `GET  /api/capabilities` → Rechte des Nutzers (view/edit agenda, view/edit songcategory, canUseGlobalNotes, **canUseCcli** aus `use ccli`) → steuert UI

## Termine / Ablauf

- `GET  /api/services?from=&to=` → `Service[]` (nur mit Setlist; Default-Fenster -7d…+42d; enthält `setlistChanged`-Markierung je Konto). Der Termin-**Untertitel** kommt aus einem 10-Minuten-Memo je Konto+Kalender+Termin (#306) – er war die Hälfte der Dauerlast. Ein Fehler wird bewusst NICHT gemerkt.
- `GET  /api/services/:eventId/setlist` → kompletter Ablauf (`AgendaItem[]`, Lieder mit `chordpro` + `versions[]` + documents[]; geänderte/entfernte Punkte markiert)
- `GET  /api/services/:eventId/setlist/version` → billiger Fingerabdruck (sha256) des Ablaufs für den Live-Abgleich (8s-Poll; Server-5s-Memo je Event)
- `POST /api/services/:eventId/seen` → aktuellen Ablauf-Stand als „gesehen"-Basislinie merken (steuert den „geändert"-Hinweis, #143/#161)
- `PATCH /api/services/:eventId/agenda/order` → Reihenfolge zurückschreiben (ganze Liste)
- `POST /api/services/:eventId/agenda/items` → Ablaufpunkt anlegen
- `PUT  /api/services/:eventId/agenda/items/:itemId` → Punkt ändern (Felder gebündelt: `title`, `responsible`, `arrangementId`, `unlink`, `note`, `durationMin` → CT-Sekunden)
- `DELETE /api/services/:eventId/agenda/items/:itemId` → Punkt löschen
- `PUT  /api/services/:eventId/agenda/items/:itemId/hidden` {hidden} → Uhrzeit aus-/einblenden (CT-„Auge")
- `GET  /api/agenda-services` → ChurchTools-Dienste (für die Verantwortlich-Chips)

## Lieder

- `GET  /api/song-library` → alle Lieder (Ansicht „Alle Lieder" + Auswahl beim Hinzufügen/Verknüpfen).
  Liefert bewusst den **ChurchTools-Namen**, nicht `{title: …}` aus der Datei: Die Liste lädt keine
  ChordPro-Texte, und sie dafür zu laden hieße, bei jedem Öffnen jede Lieddatei einzeln zu holen
  (#236). Überall sonst gewinnt `{title}` – siehe unten.
- `GET  /api/song-categories` → `[{id, name}]` – die Lied-Kategorien, in denen der Nutzer anlegen
  bzw. ändern darf (#322). **Schon am Recht zugeschnitten:** `edit songcategory` nennt die erlaubten
  Kategorie-IDs, ein Administrator bekommt alle. Die Oberfläche filtert **nicht** noch einmal – zwei
  Filter über dieselbe Regel wären zwei Stellen, die auseinanderlaufen.
  Die **Namen** stammen aus `getMasterData` der alten Schnittstelle (`ctAjax.ts`); einen `/api`-Weg
  für Kategorien gibt es nicht (fünf Pfade geprüft, alle 404). Scheitert der Aufruf, werden sie aus
  den vorhandenen Liedern gebildet – dann fehlen Kategorien, die **kein** Lied benutzt, und eine
  erlaubte ID ohne Namen erscheint als „Kategorie N" (nicht weggelassen: sonst verschweigt die App
  ein Recht). Gemessen mit `server/scripts/probe-songmgmt.ts`.
- `POST /api/songs` `{name, categoryId, author?, ccli?, copyright?, key?, arrangementName?, eventId?}`
  → **201** `{songId, arrangementId, imAblauf?, ablaufFehler?}` – ein neues Lied anlegen (#322).
  Legt **immer auch ein Arrangement** an (`isDefault: true`; ohne das Flag hätte das Lied kein
  Standard-Arrangement – gemessen). Mit `eventId` wandert es zusätzlich in den Ablauf dieses Termins.
- `GET  /api/song-text-search?q=…` → `SongTextTreffer[]` – **Suche in den Liedtexten** (#322). Baut beim
  ersten Aufruf einen Index über alle Lieder (ein Datei-Download je Lied), danach eine Stunde aus dem
  Speicher; gebündelt (fünf gleichzeitige Suchen = ein Aufbau) und bei einer Drosselung mit Sperrfrist.
  Unter `LIEDTEXT_SUCHE_MIN_ZEICHEN` (3) wird nicht gesucht – die Grenze steht in `@shared/types`, weil
  Client und Server sie beide prüfen. Gemessen: Weder `/api/songs?query=` noch CCLI können das.
- `GET  /api/songselect/songs/:songNumber/liedtext` → `SongSelectLiedtext` – **CCLIs Liedtext** zu einer
  Nummer (#381), Grundlage der Vorschau vor dem Anlegen. Gemessen am 14.08.2026: Der Aufruf heißt
  `getCCLILyrics` und nimmt `songNumber`; CCLI liefert den Text **strukturiert** (`lyricParts` mit
  „Vers 1", „Chorus 1") und dazu einen **`disclaimer`**, der **angezeigt werden muss**.
  ⚠️ **Nur beim bewussten Öffnen eines Treffers aufrufen, nie beim Durchsehen:** Ob CCLI den Abruf als
  Nutzung verbucht, ist offen (die Antwort enthält keinen Hinweis darauf – das beweist nichts). Der Client
  speichert je Nummer zwischen (`staleTime: Infinity`).
- `GET  /api/songs/:songId/liedtext-vorschau` → `LiedtextVorschau` (`{chordpro: string | null}`) – das
  **rohe ChordPro des Original-Notenblatts** für die Vorschau (#379). Seit 04.09.2026 der ganze Text
  statt eines gekürzten Anfangs; die **Abschnitte baut der Client** (`utils/liedtextTeile.ts`) mit dem
  Parser des Blattes – kein zweiter Abschnitts-Parser auf dem Server. **Baut den Suchindex NICHT:** Steht
  er frisch, kommt die Antwort daraus (der Index hält das ChordPro; keine Anfrage an ChurchTools); sonst
  wird **genau dieses eine** Notenblatt geladen. `chordpro: null` heißt „hat keinen Text" – ein gültiger
  Fall, kein Fehler.
- `GET  /api/songs/:songId/stammdaten` → `LiedStammdatenAnsicht` – Name, Kategorie, Autor, CCLI,
  Copyright eines Liedes (fürs Änderungsformular; die Bibliothek kennt diese Felder nicht).
- `PUT  /api/songs/:songId` `{name?, categoryId?, author?, ccli?, copyright?}` → `LiedStammdatenAnsicht`
  – Stammdaten ändern (#322, Schritt 11). **Nur die geänderten Felder schicken**; ein leerer Text heißt
  „löschen". Der Server macht daraus ein vollständiges `PUT` gegen ChurchTools (lesen–ändern–schreiben,
  `songWritePayload`), weil ChurchTools bei einem Teil-`PUT` die nicht gesendeten Felder leert
  (gemessen). Prüft das Recht an der **alten und der neuen** Kategorie und lehnt eine CCLI-Nummer ab,
  die ein anderes Lied hat (409). `note` wird nicht angenommen – ChurchTools speichert es nicht.
- `DELETE /api/songs/:songId` → `{name}` – Lied samt Arrangements und Dateien löschen. Prüft das Recht
  an seiner Kategorie; gibt den Namen zurück, weil es ihn danach nicht mehr gibt.

  **Zwei Regeln erzwingt der Server, nicht das Formular:** Die Kategorie muss im Recht des Nutzers
  vorkommen (403), und dieselbe **CCLI-Nummer** wird blockiert (409, die Meldung nennt das vorhandene
  Lied). Die Doppel-Erkennung läuft über `getAllSongs`, **nicht** über die Bibliothek – die wirft
  Lieder ohne Arrangement weg, also genau den Rest eines halb gescheiterten Versuchs.

  **Teilfehlschläge sind benannt, nicht verschwiegen:** Scheitert das Arrangement, liegt in
  ChurchTools ein Lied ohne eines – die Meldung sagt das und warnt vor einem zweiten Versuch (er
  legte ein Doppel an). Scheitert nur der Ablauf-Eintrag, ist das **kein** Fehler: Antwort 201 mit
  `imAblauf: false` und Grund. Nichts wird automatisch wiederholt oder zurückgenommen.
  `note` geht bewusst nicht mit – ChurchTools ignoriert das Feld beim Anlegen (gemessen).

- `GET  /api/song-usage` → Nutzungsstatistik je Song als **`{ dates: string[] }`** (vergangene Spieltermine, bis zu 4 Jahre zurück, absteigend; 1h-Cache). Häufigkeit + „zuletzt gespielt" für den gewählten Zeitraum rechnet der **Client** daraus – ohne erneuten Server-Roundtrip. Bei Drosselung **503** (+ `Retry-After`), wenn kein früherer Stand im Speicher liegt; der Client zeigt dann „–" statt einer Null und lässt die Liederliste vollständig (#300).
- `GET  /api/songs/:songId/arrangements` → Arrangements eines Lieds (für „Zu Ablauf hinzufügen")
- `GET  /api/songs/:songId/chart` → Chart eines einzelnen Lieds (aus „Alle Lieder")
- `POST /api/songs/:songId/versions` {arrangementId, name, text} → neue benannte Version → `SongVersion`
- `PUT  /api/songs/:songId/versions/:versionKey` {arrangementId, text?, name?} → Version aktualisieren/umbenennen
- `DELETE /api/songs/:songId/versions/:versionKey` {arrangementId} → Version löschen (Original bleibt)
- `GET  /api/songs/:songId/files/:fileId` → PDF/Bild aus ChurchTools durchreichen (Content-Type-Whitelist; Viewer)
- `GET  /api/songs/:songId/arrangements/:arrangementId/files` → **alle** Dateien des Arrangements als
  `ArrangementFileEntry[]` (flach: ChordPro, Versionen, PDF/Bild und alles andere; `size` kann `null`
  sein, wenn ChurchTools sie nicht mitliefert) (#321)
- `POST /api/songs/:songId/arrangements/:arrangementId/files?name=<Dateiname>` → Datei anhängen →
  frische Liste. **Roher Rumpf, kein Multipart:** die Datei unverändert als Body, Art über
  `Content-Type`, Name über `?name=`. Grenze `MAX_FILE_BYTES` (50 MB) wie beim Lesen. Ein leerer
  Rumpf ist **400**, nicht eine 0-Byte-Datei (#321)
- `GET  /api/songselect/search?title=…` → CCLI-SongSelect nach Titel durchsuchen → Treffer mit
  Titel, Autoren, Nummer, Tonart und je Format `hasLyrics`/`hasChordPro`/`hasChordSheet`
  (**vorhanden UND lizenziert**). Zusätzlich `gesamt` und `vollstaendig` – ChurchTools liefert 100
  auf einmal, mehr ist ungeklärt (#322)
- `GET  /api/songselect/songs/:songNumber` → ein Lied per CCLI-Nummer, zusätzlich mit `copyright`
  (fürs Anlegen-Formular) (#322)
- `POST /api/songs/:songId/arrangements/:arrangementId/songselect/chordpro` {songNumber} → holt das
  ChordPro bei CCLI **in der Tonart des Arrangements** und legt es ab → frische Dateiliste.
  Ersetzt ein vorhandenes Original-ChordPro (erst hochladen, dann das alte löschen). Läuft über die
  **alte** ChurchTools-Schnittstelle (`index.php?q=churchservice/ajax`), gekapselt in `ctAjax.ts`
  (die einzige Stelle, die sie kennt), CCLI-Aufrufe in `ctSongSelect.ts` – Einzelheiten in
  [`churchtools-songselect.md`](./churchtools-songselect.md)
- `PUT /api/songs/:songId/arrangements/:arrangementId/chordpro` {text} → schreibt das **Original**-
  Notenblatt aus eigenem Text (der Editor nach dem Anlegen, 04.09.2026) → frische Dateiliste. Dieselbe
  Stelle wie der SongSelect-Import (`originalNotenblattSchreiben`): pro Arrangement genau ein Original,
  erst hochladen, dann das alte löschen, die `(App)`-Versionen bleiben. `text` getrimmt, 1–200 000
  Zeichen; das Arrangement muss zu **diesem Lied** gehören (sonst 404).
- `DELETE /api/songs/:songId/files/:fileId` → Datei löschen. Die Datei muss zu **diesem Lied**
  gehören (sonst 404) – ohne diese Prüfung wäre der Weg ein „lösche beliebige Datei", denn
  ChurchTools prüft nur das Bearbeiten-Recht, nicht welche Datei gemeint war (#321, vgl. #199)

**Kopfangaben eines Lieds – die Datei hat das letzte Wort (#236).** Überall, wo ein Lied als
`SetlistSong` geliefert wird (`/setlist`, `/songs/:songId/chart`), gewinnen die ChordPro-Angaben der
Datei über das, was ChurchTools am Lied/Arrangement hinterlegt hat: `{title}` → `title`,
`{artist}` → `author`, `{key}` → `originalKey`, `{time}` → `timeSig`. Ein **leerer** Wert
(`{title: }`) gilt als nicht gesetzt und ersetzt den ChurchTools-Wert nicht. Abgeleitet wird aus dem
Original (bzw. der ersten Version, falls kein Original existiert); welche Überschrift auf dem
gerenderten Blatt steht, entscheidet zusätzlich der **angezeigte** Text – siehe `chartHead()` im
Client, damit eine Version mit eigener Überschrift auch ihre eigene trägt.

## Anmerkungen / Einstellungen (pro Konto, serverseitig auf dem Volume)

- `GET  /api/annotations?songs=` / `PUT /api/annotations/:key` / `DELETE …/:key` → Anmerkungen+Zoom pro Konto (Feld-Merge strokes/texts/zoom; key `song<id>_v<ver>_<seite>[_lyr][_d<class>]`; Konto-Obergrenzen #139)
- `GET  /api/settings?songs=` / `PUT /api/settings` → Lied-Einstellungen pro Konto (Schlüssel-Wert, Merge)

## Team-Notizen (geteilte Anmerkungen, PCO-Modell)

- `GET/PUT /api/annotations/sharing` → eigenen Teilen-Schalter lesen/setzen
- `GET  /api/annotations/sharers?songs=` → wer teilt für die gefragten Lieder geteilte Anmerkungen
- `GET  /api/annotations/of/:personId` → geteilte Anmerkungen einer Person (schreibgeschützt ansehen)
- `GET  /api/settings/of/:personId` → Ansicht-Einstellungen dieser Person (damit man in DEREN Darstellung schaut)

## Verfügbarkeit / Abwesenheiten (#177 – eigenes Konto, Nutzer-Cookie)

- `GET  /api/absences?from=&to=` → eigene Abwesenheiten (Standard: heute bis in einem Jahr); `eigene: true` = Marker-Eintrag der App/des Syncs
- `POST /api/absences` `{startDate, endDate, comment?}` → legt eine ChurchTools-Abwesenheit mit Marker `[Musikteam] …` an; **201** neu, **200** wenn derselbe Zeitraum schon stand (kein Doppel); 400 bei Ende vor Anfang / > 1 Jahr
- `PUT  /api/absences/:id` `{startDate, endDate, comment?}` → ändert einen eigenen Eintrag. ChurchTools kann Abwesenheiten nicht ändern: Der Server legt **erst neu an, dann löscht er den alten** (andersherum wäre nach einem Fehlschlag alles weg). **403** bei manuellen Einträgen, **409** wenn ein ANDERER eigener Eintrag denselben Zeitraum belegt, **502** wenn das Aufräumen scheiterte (der neue Eintrag steht dann schon)
- `DELETE /api/absences/:id` → nur Marker-Einträge (**403** bei manuellen ChurchTools-Einträgen, 404 unbekannt)
- `GET  /api/absences/events?weeks=` → kommende Termine (1–26 Wochen, Standard 10) als Schnellauswahl
- Die Personen-ID kommt **immer** aus der Sitzung; Grund = `CHURCHTOOLS_ABSENCE_REASON_ID` (Standard 1). Kein Excel-Bezug – der Sync ist ein eigener Dienst.

## Admin (nur mit Admin-Recht)

- `GET  /api/groups` → ChurchTools-Gruppen (Dropdown „Gruppen-Zuweisung" für Team-Notizen)
- `GET  /api/groups/:id/roles` → Rollen einer Gruppe (Rollen-Zuweisung)
