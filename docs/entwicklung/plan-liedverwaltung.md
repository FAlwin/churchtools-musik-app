# Umsetzungsplan – Liedverwaltung in der App (#321, #322)

> Status: **13.08.2026 – Teil 1 fertig; von Teil 2 stehen die Schritte 6–10b.
> Offen: nur noch 11 (Stammdaten ändern) und der Staging-Durchklick von 10b.**
> Die Neufassung von Teil 2 kommt aus einem Fund vom selben Tag: **SongSelect ist doch machbar**,
> über ChurchTools als Vermittler (siehe `churchtools-songselect.md`). Das ändert #322 grundlegend –
> aus „Formular zum Abtippen" wird „Lied aus CCLI holen".
> Ziel: Dateien eines Arrangements und die Stammdaten eines Lieds in der App pflegen – ohne den
> Umweg über die ChurchTools-Weboberfläche.
> Der Schreibweg zu ChurchTools ist **erprobt** (die ChordPro-Versionen laufen bereits darüber). Es
> fehlen im Wesentlichen eigene Endpunkte und Oberfläche.

## 1. Getroffene Entscheidungen

Mit Alwin am 11.08.2026 festgelegt:

| Thema       | Entscheidung                                                                |
| ----------- | --------------------------------------------------------------------------- |
| Reihenfolge | Erst dieser Plan, dann bauen – Teil 1 (Dateien) vor Teil 2 (Lieder anlegen) |
| Dateiliste  | **Flach, alles gleich behandeln** – jede Datei sichtbar, jede löschbar      |
| Einstieg    | **Lied-Menü im Liederheft**, neuer Punkt „Dateien …"                        |

**Zur flachen Liste:** Ich hatte eine geschützte Gruppierung empfohlen, weil das Original-ChordPro
die Quelle des Notenblatts ist – wer es löscht, nimmt dem Lied das Blatt. Alwin hat sich für die
flache Liste entschieden; das ist die Vorgabe. **Die Rückfrage vor dem Löschen nennt die Folge
deshalb ausdrücklich** (siehe §4). Sie steht ohnehin in den Kriterien von #321.

## 2. Ausgangslage: was es schon gibt

Verifiziert am 11.08.2026 im Code, nicht aus dem Gedächtnis:

| Baustein                | wo                                                        |
| ----------------------- | --------------------------------------------------------- |
| Schreibvorgang mit CSRF | `schreibe()` in `server/src/services/ctWrite.ts`          |
| Datei hochladen         | `uploadChordpro()` – heute auf ChordPro zugeschnitten     |
| Datei löschen           | `deleteFile()` – `DELETE /api/files/{id}`                 |
| Datei lesen             | `fetchFileBytes()`, `downloadFileText()` in `ctFiles.ts`  |
| URL-Prüfung (#199)      | `assertCtFileUrl()` – nur URLs der eigenen Instanz        |
| Größendeckel            | `MAX_FILE_BYTES` = 50 MB in `ctHttp.ts`                   |
| Recht                   | `canEditSongs` aus `edit songcategory` (`ctCapabilities`) |
| Eine Datei ausliefern   | `GET /api/songs/:songId/files/:fileId`                    |

**`schreibe()` ist der Grund, warum das überschaubar bleibt.** Wer eine Schreiboperation ergänzt,
bekommt Token, Kopfzeile und Ablehnungs-Behandlung, ohne daran zu denken (#280, #298). Alle neuen
Schreibwege in diesem Vorhaben laufen darüber – **keine zweite Fassung daneben.**

## 3. Die Dateien eines Arrangements sind heute VIER verschiedene Dinge

Das ist die inhaltliche Kernfrage von #321, geklärt in `server/src/services/arrangementFiles.ts`:

| Klasse             | erkannt an                      | heute sichtbar in         |
| ------------------ | ------------------------------- | ------------------------- |
| Original-ChordPro  | `.chordpro` ohne `(App)`-Marker | ergibt **das Notenblatt** |
| Verwaltete Version | `— <Name> (App).chordpro`       | Lied-Menü → Version       |
| Dokument           | `.pdf`, `.jpg/.png/.gif/.webp`  | Lied-Menü → Anzeige       |
| Alles andere       | z. B. `.docx`, `.mp3`, `.zip`   | **gar nicht**             |

Die vierte Klasse ist ein stiller Gewinn dieses Vorhabens: Solche Dateien liegen in ChurchTools und
sind in der App bisher unsichtbar.

**Folge der flachen Liste, klar benannt:** Löscht man das Original-ChordPro, hat das Lied kein Blatt
mehr (nur noch etwaige Versionen und Dokumente). Löscht man eine Versionsdatei, verschwindet die
Version aus dem Menü. Beides ist in ChurchTools wiederherstellbar nur durch erneutes Hochladen.

## 4. Teil 1 – Dateien am Arrangement (#321)

### 4.1 Server

Drei neue Endpunkte, alle unter dem vorhandenen `setlist`-Router:

| Methode  | Pfad                                           | Zweck                      |
| -------- | ---------------------------------------------- | -------------------------- |
| `GET`    | `/api/songs/:songId/arrangements/:arrId/files` | Liste mit Name, Art, Größe |
| `POST`   | `/api/songs/:songId/arrangements/:arrId/files` | Hochladen (multipart)      |
| `DELETE` | `/api/songs/:songId/files/:fileId`             | Löschen                    |

**`uploadChordpro` wird verallgemeinert, nicht kopiert.** Heute setzt sie Dateinamen und
`text/plain` selbst. Geplant: eine Funktion `uploadFile(cookie, arrangementId, datei)` mit Name,
Typ und Inhalt; `uploadChordpro` ruft sie mit ihren ChordPro-Vorgaben. Das ist die Auflage aus dem
Issue und die Fehlerklasse, die dieses Projekt am häufigsten getroffen hat — eine zweite
Upload-Fassung daneben wäre genau die nächste Kopie.

**Rechte serverseitig erzwingen**, nicht nur in der Oberfläche: dieselbe Prüfung wie beim
ChordPro-Schreiben. Nach jedem Fund per grep belegen, dass es keine zweite Stelle gibt, die Dateien
schreibt, ohne zu prüfen.

**Herunterladen** braucht keinen neuen Endpunkt: `GET /api/songs/:songId/files/:fileId` existiert und
prüft die URL bereits gegen die eigene Instanz (#199). Das bleibt so.

### 4.2 Oberfläche

Neuer Menüpunkt **„Dateien …"** im Lied-Menü, nur bei `canEditSong`. Er öffnet ein Blatt (`Sheet`,
wie `SharersSheet`) mit der flachen Liste:

```
Dateien – Arrangement „Test"

📄  Treu - E.pdf                      412 KB   ⤓  🗑
🎵  Treu.chordpro                       2 KB   ⤓  🗑
🎵  Treu — Akustik (App).chordpro       2 KB   ⤓  🗑

           [ Datei hinzufügen … ]
```

- **Herunterladen** über den vorhandenen Datei-Endpunkt.
- **Hinzufügen** über einen versteckten `<input type="file">`.
- **Löschen** mit Rückfrage über `ConfirmDialog`. Der Text nennt die Folge, statt nur „wirklich?" zu
  fragen — beim Original-ChordPro also, dass das Lied danach kein Notenblatt mehr hat.
- **Nach Erfolg** die Liste und den Chart neu laden (`invalidateQueries`), damit ein neues PDF
  sofort im Menü unter „Anzeige" steht.
- **Bei Fehlschlag bleibt die Auswahl stehen** und der Grund wird genannt (#270: vorübergehend ist
  nicht ungültig — ein Zeitfehler darf die Datei nicht verschlucken).

### 4.3 Was dabei schiefgehen kann

| Risiko              | Umgang                                                            |
| ------------------- | ----------------------------------------------------------------- |
| Zu große Datei      | Vor dem Senden gegen `MAX_FILE_BYTES` prüfen, verständlich melden |
| Gleicher Dateiname  | ChurchTools ersetzt **nicht** automatisch → vorher warnen         |
| Upload bricht ab    | Kein automatischer zweiter Versuch (nicht idempotent!), melden    |
| Datei war schon weg | `okBei404` – „schon gelöscht" ist kein Fehler                     |

## 5. Teil 2 – Lieder anlegen, mit SongSelect (#322)

**Diese Fassung ersetzt die vom Vormittag.** Dort stand: „SongSelect-Import nicht machbar – CCLI gibt
die Datenbank nur zertifizierten Partnern frei." Das war richtig und beantwortete trotzdem die
falsche Frage. Alwins Idee – **die App als Fernbedienung für ChurchTools** – umgeht sie: ChurchTools
ist der zertifizierte Partner, die Gemeinde hat das Abo, unsere App löst nur aus.

Gemessen am 11.08.2026, Einzelheiten in [`churchtools-songselect.md`](./churchtools-songselect.md):

| Was                      | Aufruf                          | Ändert etwas? |
| ------------------------ | ------------------------------- | ------------- |
| Nach Titel suchen        | `getCCLISongsMatchingTitle`     | nein          |
| Per CCLI-Nummer abfragen | `getCCLISongData`               | nein          |
| ChordPro holen           | `getCCLIChordPro` (mit Tonart!) | **ja**        |

Alle drei über `POST /index.php?q=churchservice/ajax` mit CSRF-Token und Sitzungs-Cookie – **beides
hat unser Server bereits.**

### 5.1 Was daraus für den Nutzer wird

Der Weg, den Alwin beschrieben hat, in einem Durchgang:

```
„Neues Lied"  →  Titel eintippen  →  Trefferliste aus CCLI
                                      (Titel · Autoren · Nummer · Text ✓ · Akkorde ✓)
              →  auswählen        →  Formular ist AUSGEFÜLLT
                                      (Titel, Autoren, Copyright, Tonart)
              →  Kategorie wählen →  anlegen
              →  ChordPro holen   →  fertig, das Lied hat ein Notenblatt
```

Dasselbe für ein **vorhandenes** Lied mit CCLI-Nummer: „Notenblatt aus SongSelect holen" in der
Dateiverwaltung aus Teil 1.

### 5.2 Entschieden mit Alwin am 13.08.2026 (Schritt 6 ✅)

| Frage                      | Entscheidung                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| Wo entsteht ein Lied?      | **Liederheft UND direkt im Ablauf** – beide Einstiege                                     |
| Welche Kategorie?          | **Pflichtfeld ohne Vorschlag** – keine wird vorbelegt                                     |
| Doppelanlagen?             | **Gleiche CCLI-Nummer → blockieren**; gleicher Name → nur warnen, Anlegen erlaubt         |
| „Inaktive Songs" anbieten? | **Ja** – die App bietet an, was das ChurchTools-Recht hergibt, und entscheidet nichts vor |

**Zum Ablauf-Einstieg:** Er kostet keinen neuen Schreibweg. `createAgendaItem(type: 'song')` in
`ctWrite.ts` ist erprobt (es steht hinter „Eintrag hinzufügen" und `AddToAgendaSheet`); nach dem
Anlegen wird es einfach aufgerufen. Es bleibt aber ein **dritter** Schreibvorgang, der eigenständig
scheitern kann – siehe §5.3.

**Zur Doppel-Blockade:** Sie ist an der CCLI-Nummer möglich, ohne ChurchTools zu belasten – `/api/songs`
liefert `ccli` mit (gemessen). Und sie widerspricht dem Bestand nicht: keine der 45 vergebenen Nummern
kommt doppelt vor. **Achtung für die Umsetzung:** Die Prüfung darf **nicht** auf `getSongLibrary`
aufsetzen – die Funktion wirft Lieder **ohne Arrangement** weg, und genau so eines entsteht bei einem
halb gescheiterten Anlegen. Der zweite Versuch fände es dann nicht. Sie muss auf `getAllSongs` gehen.

### 5.3 Was der Umsetzung vorausgeht

- ✅ **Kategorien und Rechte sind durchgereicht** (Schritt 7, 13.08.2026). Gemessen mit
  `probe-songmgmt.ts` gegen die echte Instanz (CT 3.135.2):
  - `/api/songs` liefert `category` **und** `ccli` mit. Beide stehen jetzt in `CtSongListEntry`; die
    Doppel-Erkennung braucht damit **keinen** Einzelabruf je Lied (das wären ~250 – genau #300).
    `ccli` ist eine **Zeichenkette** (`"5841527"`) – verglichen wird getrimmter Text, nie eine Zahl.
  - **Die Kategorie-Namen gibt es doch** – nur nicht unter `/api/` (fünf Pfade geprüft, alle 404),
    sondern über `getMasterData` der alten Schnittstelle. Dort ist `id` eine Zeichenkette und der
    Name heißt `bezeichnung`. Neu: `ctSongCategories.ts`, mit **Rückfall** auf die Kategorien der
    vorhandenen Lieder. Der Rückfall ist nötig, aber schwächer: Bei der ECG liegen alle 49 Lieder in
    Kategorie 0, „Inaktive Songs" (ID 1) käme dort gar nicht vor.
  - Das Recht wird an **einer** Stelle ausgewertet (`parseSongEditRight`); `canEditSongs` fragt sie,
    statt `edit songcategory` ein zweites Mal selbst zu lesen. Neuer Endpunkt
    `GET /api/song-categories` liefert die Liste **schon zugeschnitten** – die Oberfläche filtert
    nicht nach.
  - `SongLibraryEntry` bleibt bewusst **unverändert**: Solange kein Bildschirm die Kategorie eines
    Liedes anzeigt, wäre das ein Feld, das niemand liest. Es kommt mit Schritt 11 dazu.
- **Beim Anlegen entsteht sofort ein Arrangement mit** – ohne eines ist das Lied unbrauchbar. Das
  sind zwei Schreibvorgänge, und der zweite kann scheitern: Dann existiert ein Lied **ohne**
  Arrangement. Dieser Zwischenzustand muss benannt werden, statt still zu bleiben. Mit dem
  Ablauf-Eintrag (§5.2) sind es **drei**; jeder Fehlschlag wird einzeln gemeldet, und keiner wird
  automatisch wiederholt (`schreibe` ist bewusst ohne Wiederholung – ein doppeltes Anlegen wäre
  genau der Fall).

### 5.4 Was an SongSelect besonders zu beachten ist

- **Der Download ist NICHT idempotent.** Beim Erkunden entstanden drei gleichnamige `Treu.chordpro`.
  Vor dem Holen also prüfen, ob die Datei schon da ist – die Warnung aus Teil 1 lässt sich
  übernehmen.
- **`isAuthorized` vor `exists`.** Nur anbieten, was die Lizenz hergibt; sonst führt ein Knopf ins
  Leere.
- **Die Suche ist unscharf** (147 Treffer für „Wo ich auch stehe"). Die Trefferliste muss die
  Unterscheidungsmerkmale zeigen: Titel, Autoren, Nummer, verfügbare Formate.
- **Blättern ist ungeklärt** – ChurchTools holt 100 von 147 und zeigt keinen Weg weiter. Die App darf
  nicht so tun, als sei die Liste vollständig; besser zum Verfeinern der Suche raten.
- **Undokumentierte interne Schnittstelle.** Sie gehört hinter **eine** Stelle – seit Schritt 7 das
  eigene Modul `ctAjax.ts`, damit ein ChurchTools-Update genau einen Ort trifft. (Bis dahin stand sie
  privat in `ctSongSelect.ts`; mit den Lied-Kategorien kam ein zweiter Nutzer, und eine zweite Fassung
  daneben wäre genau die Fehlerklasse aus §7 gewesen.) Ein Fehlschlag wird verständlich gemeldet –
  die **Wortlaute bleiben beim Aufrufer**, denn ein Fehler beim Liedersuchen ist etwas anderes als
  einer beim Laden der Kategorien. Offen: Anfrage beim ChurchTools-Support nach einem offiziellen Weg.
- **Nur ChordPro ist gemessen.** Text, Akkord-PDF, Lead- und Vocal-Sheet haben vermutlich eigene
  Funktionen – **geraten, nicht belegt.** Wer sie ergänzt, misst sie vorher; blindes Ausprobieren
  gegen die Gemeinde-Instanz legt bei jedem Versuch eine Datei an.

## 6. Reihenfolge der Umsetzung

| Schritt | Inhalt                                                            | Issue | Stand                     |
| ------- | ----------------------------------------------------------------- | ----- | ------------------------- |
| 1       | `uploadFile` verallgemeinern, `uploadChordpro` darauf umstellen   | #321  | ✅                        |
| 2       | Drei Endpunkte + Zugehörigkeitsprüfung, mit Tests                 | #321  | ✅                        |
| 3       | Blatt „Dateien …" im Lied-Menü, Liste + Herunterladen             | #321  | ✅                        |
| 4       | Hochladen und Löschen samt Rückfrage und Fehlerfällen             | #321  | ✅                        |
| 5       | Auf Staging prüfen, im Browser durchklicken, dann Release         | #321  | ✅ geprüft, Release offen |
| 6       | Die drei Fragen aus §5.2 klären                                   | #322  | ✅ 13.08.2026             |
| 7       | Kategorie + erlaubte Kategorie-IDs durchreichen                   | #322  | ✅                        |
| 8       | `ctSongSelect.ts`: Suche + Abfrage, rein lesend, mit Tests        | #322  | ✅                        |
| 9       | „Notenblatt aus SongSelect holen" in der Dateiverwaltung (Teil 1) | #322  | ✅                        |
| 10a     | Lied anlegen – **Server** (`POST /api/songs`), mit Tests          | #322  | ✅ 13.08.2026 (PR #374)   |
| 10b     | Lied anlegen – **Oberfläche**, Formular aus CCLI vorausgefüllt    | #322  | ✅ 13.08.2026             |
| 11      | Stammdaten eines vorhandenen Lieds ändern                         | #322  | offen                     |

**Schritt 10b ist gebaut (13.08.2026).** `NewSongSheet` mit Wegwahl (CCLI-Suche / selbst eintippen),
Trefferliste mit Titel · Autoren · Nummer · Formaten und dem Hinweis auf die 100er-Grenze, Übernahme
füllt Titel/Autoren/Copyright/Tonart, Kategorie als Pflichtfeld ohne Vorbelegung, Namenswarnung im
Client, Einstiege im Liederheft (**+** in der Kopfzeile) und im Ablauf („Hinzufügen → Lied → Neues
Lied anlegen …"), Erfolgsansicht mit drei Wegen (öffnen / noch eins / fertig), Einführung auf
`termine-v3` und `setlist-edit-v2`, Testfall **TF-LIB-03**, CHANGELOG.

Die Regeln liegen bewusst **nicht** in der Komponente: `utils/neuesLied.ts` (Formularstand, Warnung,
Auftrag, Entscheidung über das Notenblatt) und `hooks/useNeuesLied.ts` (die Abfolge samt
Teilerfolgen). Beides ist geprüft, jede Regel einzeln per Gegenprobe – 46 neue Tests.

**Was noch fehlt: der Durchklick auf Staging** (#283 – eine grüne Testsuite hat hier schon einmal
eine kaputte Bedienung überdeckt). Er lässt sich nicht vorwegnehmen: Das Blatt braucht Anmeldung und
ChurchTools-Rechte, und **jeder Testlauf legt ein echtes Lied in ChurchTools an** (Staging und Prod
sprechen dieselbe Instanz). Es muss also jemand mit Konto durchklicken und die Testlieder danach in
ChurchTools wieder wegräumen – die App kann keine Lieder löschen.

**Bewusst NICHT gebaut:** ein dritter Einstieg in `ItemActionSheet` („Lied verknüpfen"). Dort wird
einem **vorhandenen** Ablaufpunkt ein Lied zugeordnet; der Auftrag legt mit `eventId` aber einen
**neuen** Punkt an. Das bräuchte einen anderen Schreibweg und fehlt nicht aus Versehen.

**Ohne SongSelect-Recht (`canUseCcli`) muss das Formular trotzdem benutzbar sein** – dann eben ohne
Suche, mit Titel von Hand. Ein Formular, das ohne fremde Lizenz gar nicht aufgeht, wäre für andere
Gemeinden wertlos.

**Zwei Meldungen, die die Oberfläche weiterreichen muss, statt sie zu „Fehler" zu verkürzen:**
Der Server antwortet bei einem gescheiterten Arrangement mit dem Hinweis, dass das Lied bereits
angelegt ist (ein zweiter Versuch würde es doppeln), und bei einem gescheiterten Ablauf-Eintrag mit
`201` + `imAblauf: false`. Beides ist Text für den Nutzer, kein Protokolleintrag.

**Erfahrung aus Schritt 9 (11.08.2026):** `getCCLIChordPro` **legt keine Datei an**, es liefert nur
den Text – die ChurchTools-Oberfläche lädt ihn selbst hoch. Weil ChurchTools trotzdem
`status: success` meldete, wurde ein vorhandenes Notenblatt gelöscht, ohne dass ein neues entstand.
**Ein Erfolgssignal ist kein Beleg dafür, dass etwas entstanden ist.** Jetzt laden wir den Text
selbst hoch (`uploadFile`) und löschen erst danach.

**Schritt 9 hat außerdem eine Entwurfsfrage geklärt:** Der Knopf erscheint nur, wenn das Arrangement
**kein** Notenblatt hat. Liegt schon eines da, ersetzt er es durch dasselbe – er tut nichts und lädt
trotzdem zum Drücken ein. Und zum **Transponieren** braucht man ihn nicht: Die App rechnet selbst um.

**Schritt 8 vor 9 und 10**, weil Suche und Abfrage **nichts ändern**: Sie lassen sich gefahrlos
gegen die echte Instanz prüfen. Erst danach kommt der Schritt, der Dateien anlegt.

**Schritt 9 vor 10**, weil er der kleinere ist und die Fernbedienung als Ganzes belegt – an einem
vorhandenen Lied mit CCLI-Nummer, ohne dass gleich ein neues Lied entsteht.

## 7. Verifikation

- `format:check`, `lint`, `doc-check`, `build`, `test`, `test:e2e` — jeweils am **Exit-Code**, nie
  per grep auf die Ausgabe.
- **Schreibende Erkundung nur gegen die Test-Instanz.** `probe-songwrite.ts` weigert sich, gegen die
  Gemeinde-Instanz zu laufen; das bleibt so.
- **SongSelect: lesende Aufrufe gefahrlos, der Download NICHT.** Suche und Abfrage ändern nichts und
  dürfen wiederholt werden. Jeder Download legt eine Datei an – beim Entwickeln also sparsam und
  hinterher aufräumen. (Beim Erkunden sind so drei gleichnamige Dateien entstanden.)
- **Im Browser durchgeklickt** (#283): Eine grüne Testsuite hat in diesem Projekt schon einmal eine
  kaputte Bedienung überdeckt. Für Datei-Upload und -Löschen gilt das besonders — sie ändern echte
  Daten in ChurchTools.
- Ein E2E-Fall für die Liste über den vorhandenen Stub (`e2e/ct-stub.mjs`).
- **Nach jedem Fix per grep die zweite Stelle suchen**, und beim Verallgemeinern von `uploadChordpro`
  prüfen, welche Stellen den neuen Baustein hätten nutzen können — sonst ist er nur die nächste
  Kopie. (Die Lehre vom 11.08.2026: Beim Zusammenlegen der Ebenen-Benennung wurden zwei von drei
  Stellen erwischt; die dritte fand erst der grep beim Aufräumen.)
