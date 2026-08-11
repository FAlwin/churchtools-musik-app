# Umsetzungsplan – Liedverwaltung in der App (#321, #322)

> Status: **Entwurf, 11.08.2026. Noch nichts umgesetzt.**
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

## 5. Teil 2 – Lieder anlegen und Stammdaten (#322)

Machbarkeit ist geklärt (07.08.2026 gegen die **Test-Instanz**, CT 3.135.1). **Erst nach Teil 1**,
weil ein neu angelegtes Lied als Erstes eine Datei braucht — der Weg dorthin entsteht in Teil 1.

### 5.1 Vor dem Bau zu klären (Fragen an Alwin, wenn Teil 1 steht)

1. **Wo entsteht ein neues Lied?** Nur in der Bibliothek, oder direkt in den Ablauf des gewählten
   Termins? Das entscheidet, wo der Einstieg sitzt.
2. **Welche Kategorie** bekommt ein neues Lied? Kategorie 0 heißt „Aktive Songs" — eine inhaltliche
   Entscheidung des Teams, keine technische.
3. **Doppelanlagen:** vor dem Anlegen nach gleichem Namen suchen und darauf hinweisen — oder
   zulassen?

### 5.2 Was der Umsetzung vorausgeht

- **Die Kategorie fehlt in unserem Typ.** `SongLibraryEntry` trägt heute nur
  `songId, name, author, key, arrangementId`. Für die Auswahl muss die Kategorie mitgeliefert
  werden — einen eigenen Endpunkt dafür gibt es in ChurchTools nicht (alle geratenen Pfade 404).
- **Das Recht ist heute ein Ja/Nein.** `canEditSongs` fasst `edit songcategory` zu einem Bool
  zusammen; das Recht nennt aber die **erlaubten Kategorie-IDs** (bei Alwin `[0,1]`). Für #322 muss
  die Liste durchgereicht werden, sonst bietet die App Kategorien an, die ChurchTools ablehnt.
- **Beim Anlegen entsteht sofort ein Arrangement mit** — ohne eines ist das Lied unbrauchbar. Das
  sind zwei Schreibvorgänge, und der zweite kann scheitern: Dann existiert ein Lied ohne
  Arrangement. Der Fall muss benannt werden, statt still zu bleiben.

### 5.3 Nicht machbar, bewusst weggelassen

Der SongSelect-Import (CCLI) bleibt außen vor — die Datenbank gibt CCLI nur zertifizierten Partnern
frei. Lieder holt man weiter über die ChurchTools-Oberfläche; danach stehen sie der App zur
Verfügung.

## 6. Reihenfolge der Umsetzung

| Schritt | Inhalt                                                          | Issue |
| ------- | --------------------------------------------------------------- | ----- |
| 1       | `uploadFile` verallgemeinern, `uploadChordpro` darauf umstellen | #321  |
| 2       | Drei Endpunkte + Rechteprüfung serverseitig, mit Tests          | #321  |
| 3       | Blatt „Dateien …" im Lied-Menü, Liste + Herunterladen           | #321  |
| 4       | Hochladen und Löschen samt Rückfrage und Fehlerfällen           | #321  |
| 5       | Auf Staging prüfen, im Browser durchklicken, dann Release       | #321  |
| 6       | Die drei Fragen aus §5.1 klären                                 | #322  |
| 7       | Kategorie + Kategorie-IDs durchreichen                          | #322  |
| 8       | Lied anlegen (Lied + Arrangement), Stammdaten ändern            | #322  |

Schritt 1 ist bewusst zuerst: Er ist die Stelle, an der eine Kopie entstehen würde.

## 7. Verifikation

- `format:check`, `lint`, `doc-check`, `build`, `test`, `test:e2e` — jeweils am **Exit-Code**, nie
  per grep auf die Ausgabe.
- **Schreibende Erkundung nur gegen die Test-Instanz.** `probe-songwrite.ts` weigert sich, gegen die
  Gemeinde-Instanz zu laufen; das bleibt so.
- **Im Browser durchgeklickt** (#283): Eine grüne Testsuite hat in diesem Projekt schon einmal eine
  kaputte Bedienung überdeckt. Für Datei-Upload und -Löschen gilt das besonders — sie ändern echte
  Daten in ChurchTools.
- Ein E2E-Fall für die Liste über den vorhandenen Stub (`e2e/ct-stub.mjs`).
- **Nach jedem Fix per grep die zweite Stelle suchen**, und beim Verallgemeinern von `uploadChordpro`
  prüfen, welche Stellen den neuen Baustein hätten nutzen können — sonst ist er nur die nächste
  Kopie. (Die Lehre vom 11.08.2026: Beim Zusammenlegen der Ebenen-Benennung wurden zwei von drei
  Stellen erwischt; die dritte fand erst der grep beim Aufräumen.)
