# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier festgehalten.
Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [SemVer](https://semver.org/lang/de/):
`MAJOR.MINOR.PATCH` – z. B. `v2.1.0` = Feature, `v2.1.1` = Bugfix, `v3.0.0` = größere Umstellung.

## [Unreleased]

### Neu

- **Bei der Liedsuche stehen Titel-Treffer zuerst.** Gesucht wird in Titel **und** Autor; bisher stand
  die Liste rein alphabetisch, ein Lied mit dem Wort nur im Autor konnte also vor dem stehen, das es im
  Titel hat. Wer ein Wort eintippt, meint fast immer den Titel.

  Bei **Häufigkeit** und **Zuletzt** gewinnen weiter die Zahlen – sonst wäre der Umschalter wirkungslos.
  Dort entscheidet die Trefferart nur bei Gleichstand.

- **Man kann jetzt im Liedtext suchen (#322).** Wer nur eine Zeile im Kopf hat, aber nicht den Titel,
  tippt sie ins Suchfeld im Liederheft und wählt darunter **„Auch im Liedtext nach … suchen"**. Die
  Treffer erscheinen mit der **Fundstelle**, sodass man sieht, warum ein Lied dabei ist.

  Beim ersten Mal dauert es einen Moment: Die App holt dafür jeden Liedtext einmal von ChurchTools.
  Danach ist es sofort da – der Bestand wird eine Stunde vorgehalten.

  **Warum es nicht einfach mitläuft:** Weder ChurchTools noch CCLI können im Liedtext suchen – gemessen
  am 13.08.2026: Ein Wort aus dem Text ergab bei ChurchTools 0 Treffer, dasselbe Wort aus dem Titel 1.
  Die Texte liegen dort als Datei am Arrangement. Unsere App durchsucht sie deshalb selbst, und das
  kostet einmal einen Durchgang durch alle Lieder. Ein Angebot auf Knopfdruck statt bei jedem
  Tastendruck ist der schonende Weg – auch gegenüber ChurchTools, das uns bei zu vielen Anfragen
  bremst.

- **Die Stammdaten eines Liedes lassen sich in der App ändern (#322).** Im Lied-Menü steht unter
  „Dateien …" nun **„Stammdaten …"**, und im Liederheft gibt es je Zeile einen Stift. Dort ändert man
  **Name, Kategorie, Autor, CCLI-Nummer und Copyright** – ohne den Umweg über ChurchTools.

  **Gespeichert wird nur, was du geändert hast.** Ein Feld, das du leerst, wird auch in ChurchTools
  leer; alles andere bleibt unangetastet. Das ist kein Selbstläufer: ChurchTools ersetzt beim
  Speichern den **ganzen** Datensatz, und alles, was nicht mitgeschickt wird, ist danach weg. Die App
  liest deshalb vor jedem Speichern den aktuellen Stand und legt nur deine Änderung darüber – wer
  einen Liednamen korrigiert, verliert dabei nicht den Autor.

  **Ein Lied kann hier auch gelöscht werden** – mit einer Rückfrage, die sagt, was mitgeht:
  Arrangements, Notenblätter und Dateien, und im Ablauf fehlt es danach. Über die App ist das nicht
  rückholbar. Nach dem Löschen aus einem geöffneten Lied heraus schließt sich die Ansicht.

  Zur Wahl stehen wieder nur die Kategorien, in denen ChurchTools dich arbeiten lässt – und zwar für
  **beide** Seiten: Du kannst nur Lieder ändern, die in einer deiner Kategorien liegen, und nur in
  eine deiner Kategorien verschieben. Eine CCLI-Nummer, die ein **anderes** Lied schon hat, wird
  abgelehnt; die eigene Nummer bleibt selbstverständlich erlaubt.

  **Ein Notiz-Feld gibt es bewusst nicht:** ChurchTools speichert die Lied-Notiz über diesen Weg gar
  nicht (gemessen) und hat sie selbst als veraltet markiert. Ein Feld, das nichts behält, wäre eine
  Falle.

- **Lieder lassen sich in der App anlegen (#322).** Im Liederheft steht rechts unter der Suche
  **„Neues Lied"**, und
  beim Bearbeiten eines Ablaufs gibt es unter „Hinzufügen → Lied" den Punkt **„Neues Lied anlegen …"**.
  Beides sieht nur, wer in ChurchTools Lieder bearbeiten darf.

  **Gesucht wird beim Tippen.** Ein Knopfdruck ist nicht mehr nötig; die App wartet kurz, bis man
  aufhört zu tippen, und sucht dann. Der Knopf bleibt daneben – er löst sofort aus.

  **Suchen geht mit dem Titel ODER mit der CCLI-Nummer** – im selben Feld. Text landet in der Suche
  nach dem Namen, reine Ziffern gehen direkt an die Nummer: Das ergibt genau einen Treffer statt einer
  langen Liste, denn die Titelsuche von SongSelect ist unscharf (147 Treffer für „Wo ich auch stehe"). Der
  Knopf heißt dann „Abfragen" statt „Suchen", und findet SongSelect zu der Nummer nichts, nennt der Hinweis
  den anderen Weg. Beim Tippen wird eine Nummer erst abgefragt, wenn sie **sieben Stellen** hat – so
  lang sind alle 46 Nummern im Bestand (nachgezählt). Sonst stünde viermal „nicht gefunden" da, während
  man noch tippt. Kürzere Nummern gehen weiter über den Knopf.

  **Zwei gleichrangige Wege.** Entweder **bei SongSelect suchen** – dann kommen Titel, Autoren, Nummer,
  Copyright und Tonart mit, und nach dem Anlegen holt die App auch gleich **das Notenblatt**, sodass
  das Lied sofort Akkorde hat. Oder **selbst eintippen**, für eigene Lieder, Übersetzungen und alles,
  was nicht bei CCLI steht. Ohne SongSelect-Lizenz gibt es nur den zweiten Weg – und keinen Knopf,
  der ins Leere führt.

  **Die Kategorie ist ein Pflichtfeld ohne Vorbelegung.** Zur Wahl stehen genau die Kategorien, in
  denen ChurchTools dich arbeiten lässt. Ist dir keine freigegeben, sagt die App das, statt ein
  Formular anzubieten, das am Ende abgelehnt würde.

  **Gleiche Namen sind erlaubt, gleiche CCLI-Nummern nicht.** Ein Lied darf so heißen wie ein
  vorhandenes – Übersetzungen und zweite Fassungen sind normal, es kommt nur eine Warnung. Eine
  CCLI-Nummer, die es schon gibt, lehnt die App ab und nennt das Lied, das sie hat.

  Nach dem Anlegen entscheidest du, wie es weitergeht: **Lied öffnen**, **noch ein Lied anlegen** oder
  **fertig**.

  **Was nicht glattgebügelt wird:** Ein Lied entsteht in ChurchTools in mehreren Schritten, und
  ChurchTools kennt dafür keine Transaktion. Klappt der Ablauf-Eintrag nicht oder kommt das Notenblatt
  nicht, steht das Lied trotzdem da – und die App sagt genau, was fehlt, statt einen Fehler zu melden,
  der wie „nichts passiert" aussieht. Nach einem unklaren Fehlschlag heißt der Knopf „Trotzdem erneut
  anlegen": Ein beiläufiger zweiter Versuch würde das Lied doppelt anlegen.

- **Das Notenblatt lässt sich aus CCLI SongSelect holen (#322).** Hat ein Lied eine CCLI-Nummer und
  eure Gemeinde die SongSelect-Integration, steht in „Dateien …" ein zweiter Knopf:
  **„Notenblatt aus SongSelect holen …"**. ChurchTools holt es dann bei CCLI – **in der Tonart des
  Arrangements**, denn CCLI transponiert beim Herunterladen.

  **Der Knopf erscheint nur, wenn das Arrangement noch kein Notenblatt hat.** Ist schon eines da,
  gäbe es nichts zu holen – er würde es durch dasselbe ersetzen. Zum Auffrischen bleibt der Weg über
  ChurchTools.

  Zum Transponieren braucht man ihn übrigens **nicht**: Die App rechnet die Tonart selbst um, sofort
  und ohne Netz. Verschiedene Tonarten gehören in **verschiedene Arrangements** – dort holt jedes
  seine eigene Fassung.

- **Die Dateien eines Liedes lassen sich in der App verwalten (#321).** Im Lied-Menü gibt es
  **„Dateien …"** – dort stehen alle Dateien des Arrangements: das Notenblatt als ChordPro, die
  Versionen, PDFs und Bilder. **Auch Dateien, die die App bisher gar nicht zeigte** (z. B. eine
  Aufnahme als MP3), sind dort zu sehen.

  Die Liste nennt jede Datei bei ihrem sprechenden Namen – **„Notenblatt (ChordPro)"** oder
  **„Version „Akustik""** –, den technischen Dateinamen klein darunter, damit man sie in ChurchTools
  wiederfindet. Die Größe steht nur dort, wo ChurchTools sie mitliefert.

  Antippen lädt eine Datei aufs Gerät (auf dem iPad über das Teilen-Menü). Über **„Datei
  hinzufügen …"** kommt eine neue hinein – ein neues PDF steht danach sofort im Menü unter
  „Anzeige" zur Auswahl. Der Papierkorb rechts löscht, **immer mit Rückfrage**, und die Rückfrage
  sagt, was danach fehlt: Beim ChordPro etwa, dass die App für dieses Arrangement keine Akkorde mehr
  zeigt.

  Sichtbar ist das nur, wer in ChurchTools Lieder bearbeiten darf. Zu große Dateien (über 50 MB)
  werden **vor** dem Hochladen abgelehnt, und bei einem Namen, den es schon gibt, kommt eine
  Warnung: ChurchTools ersetzt nicht, die Datei läge danach zweimal da.

### Behoben

- **Auch beim Speichern wird eine Drosselung jetzt als solche gemeldet.** Bremste ChurchTools einen
  Schreibvorgang aus (Lied anlegen, Datei hochladen, Tempo speichern), stand da „fehlgeschlagen" – statt
  „ChurchTools bremst uns gerade aus, bitte einen Moment warten". Das eine klingt nach einem Fehler, den
  man nicht lösen kann, das andere nach „gleich nochmal". Damit gilt die Regel an allen drei Stellen:
  beim Lesen, beim Datei-Download und beim Schreiben.

- **Datei-Downloads erkannten eine Drosselung durch ChurchTools nicht.** Aufgefallen beim Bau der
  Textsuche: Ein `429` („zu viele Anfragen") wurde im Datei-Pfad wie ein normaler Serverfehler
  behandelt. Damit konnte ein Vorgang, der viele Dateien lädt, die Bremse nicht erkennen und schickte
  weiter Anfragen in ein erschöpftes Limit – genau das Muster, das im Juli die ganze App lahmgelegt hat.
  Die Regel gilt jetzt für Dateien genauso wie für alle anderen Abfragen.

- **Die Kopfzeile zeigte eine andere Überschrift als das Blatt** (gemeldet von Alwin). Sichtbar wurde
  es an einer überzähligen Klammer: „Die Schöpfung singt (Grosser Gott)**]**" oben, aber korrekt auf dem
  Blatt. Die Klammer steht tatsächlich im Original-ChordPro, das von CCLI kommt
  (`{title: … (Grosser Gott)]}`); die von der App gepflegte Version hat sie nicht.

  Der Fehler war, dass es **zwei Wege zur Überschrift** gab: Das Blatt las sie aus dem gerade
  angezeigten Text, die Kopfzeile aus dem Original. Bei einem Lied mit eigener Version standen damit
  zwei verschiedene Titel übereinander. Jetzt gehen beide durch dieselbe Funktion – wie es der
  Kommentar an dieser Funktion ohnehin versprach.

  **Die Klammer selbst bleibt sichtbar, wenn man das Original ansieht** – sie steht in der Datei, und
  die App zeigt, was drinsteht. Korrigieren lässt sie sich in ChurchTools oder in der Version.

- **„Neues Lied" sieht im Ablauf jetzt genauso aus wie im Liederheft**: eine ruhige Textaktion oben
  rechts statt einer breiten Karte, die neben der Liedliste wie ein eigener Menüpunkt wirkte. Der Stil
  liegt als gemeinsamer Baustein an einer Stelle.

- **Die Kopfzeilen waren unterschiedlich hoch** (gemeldet von Alwin). Bis auf 52 Pixel schrumpfte eine
  Leiste ohne Aktions-Knopf, während eine mit Knopf 63 Pixel hoch war – beim Wechsel zwischen
  „Termine", „Lieder" und „Mehr" sprang die Leiste sichtbar. Grund: Der Inhalt bestimmte die Höhe, und
  ein Knopf ist höher als eine Zeile Text.

  Jetzt hat die Kopfzeile eine feste Inhaltshöhe – gemessen mit dem echten CSS: **63 Pixel in allen
  Fällen**, mit Aktion, ohne Aktion und mit Untertitel. Aufgefallen ist es, als das Liederheft seine
  erste Kopfzeilen-Aktion bekam; betroffen war aber die ganze App.

- **„Neues Lied" sitzt nicht mehr in der Kopfzeile**, sondern im Listenkopf – **auf einer Höhe mit der
  Liedanzahl**, links „49 Lieder", rechts „Neues Lied". Die Zeile steht über dem Bereich, der beim
  Aktualisieren nach unten gezogen wird, und bleibt deshalb sichtbar: beim Blättern und auch dann, wenn
  die Suche **keinen Treffer** hat – also genau in dem Moment, in dem ein Lied fehlt.

- **Die CCLI-Suche stürzte beim ersten Treffer ab** (`e.map is not a function`, #322). Der Client
  erwartete eine Liste, der Server liefert `{treffer, gesamt, vollstaendig}` – und über die
  HTTP-Grenze prüft TypeScript nichts nach, `apiFetch<T>` ist dort nur eine Behauptung. Der Typ steht
  jetzt in `@shared/types` (`SongSelectSuchergebnis`), also nutzen Server und Oberfläche dieselbe
  Definition.

  Der Test hat es nicht gefunden, weil sein Mock **dieselbe falsche Annahme** hatte wie der Code.
  Die Testdaten sind jetzt gegen den geteilten Typ typisiert – so kann ein Mock die Form nicht mehr
  erfinden. Dazu drei Tests, die die Trefferliste wirklich rendern.

  Nebenbei aufgefallen: Der Hinweis „Liste unvollständig" rechnete mit einem geratenen
  `treffer.length >= 100`, obwohl der Server `vollstaendig` und `gesamt` mitliefert. Jetzt nennt der
  Hinweis die echte Zahl („CCLI hat 147 Treffer, angezeigt werden 100").

### Intern

- **Die Lied-Kategorien stehen der App zur Verfügung (#322, Schritt 7).** Grundlage für das Anlegen
  von Liedern: Der Server kennt die Kategorien der Instanz **mit Namen** und weiß, in welchen davon
  der Anmeldete arbeiten darf. Zu sehen ist das in der Kategorie-Auswahl des Anlege-Formulars.

  Bemerkenswert daran ist, wo die Namen herkommen: Einen `/api`-Endpunkt für Lied-Kategorien gibt es
  **nicht** (fünf Pfade geprüft, alle 404). Sie stecken in `getMasterData` der alten
  ChurchTools-Schnittstelle. Fällt die aus, werden die Kategorien aus den vorhandenen Liedern
  gebildet – das zeigt allerdings nur, was auch benutzt wird: Bei der ECG liegen alle 49 Lieder in
  „Aktive Songs", die Kategorie „Inaktive Songs" käme dort nicht vor.

- **`ctAjax.ts` ist die einzige Stelle, die die alte ChurchTools-Schnittstelle anspricht.** Sie stand
  privat in `ctSongSelect.ts`; mit den Kategorien kam ein zweiter Nutzer. Die Fehlermeldungen bleiben
  beim Aufrufer, damit ein Fehler beim Liedersuchen weiter anders klingt als einer beim Laden der
  Kategorien.

- **Der Server legt Lieder an (#322, Schritt 10a).** `POST /api/songs` legt ein Lied **samt
  Arrangement** an und trägt es auf Wunsch gleich in den Ablauf eines Termins ein.

  Die Sorgfalt steckt in den halben Durchläufen: ChurchTools kennt keine Transaktion. Scheitert das
  Arrangement, liegt dort ein Lied ohne eines – die Meldung sagt genau das und warnt vor einem
  zweiten Versuch, der es doppeln würde. Scheitert nur der Ablauf-Eintrag, ist das kein Fehler: Das
  Lied existiert, und die Antwort sagt beides. Doppelte CCLI-Nummern und fremde Kategorien lehnt der
  Server selbst ab, nicht erst das Formular.

- **Die Stammdaten-Felder gibt es genau einmal** (`SongFields`) – „Neues Lied" und „Stammdaten ändern"
  zeigen dieselben fünf Angaben. Als zwei Formulare nebeneinander wäre jede Korrektur an einem davon
  gelandet. Die Regeln beider Formulare liegen zusammen in `utils/liedFormular.ts`, der Schreibweg in
  `services/songVerwaltung.ts` (vorher `songErstellen.ts` – der Name stimmte nicht mehr).

- **`songWritePayload` baut den Lied-`PUT` aus dem gelesenen Ist-Zustand** – die dritte riskante reine
  Funktion des Projekts nach `agendaItemWritePayload` und `arrangementWritePayload`. Gemessen an der
  ChurchTools-Test-Instanz: Ein `PUT {name, categoryId}` setzte Autor, CCLI-Nummer und Copyright auf
  `null` und `shouldPractice` auf `false`.

  Beim Messen ist mir die Frage zuerst **falsch** geraten: Der erste Versuch schickte nur `{name}` und
  bekam 400, weil `categoryId` Pflicht ist – dass danach alle Felder noch standen, sah nach
  „ungefährlich" aus, obwohl gar nicht geschrieben worden war. Ein Messaufbau, der den geprüften
  Vorgang nicht auslöst, belegt nichts.

- **Auftrag, Ergebnis und Feldgrenzen des Anlegens stehen an EINER Stelle** (`@shared/types`:
  `LiedStammdaten`, `LiedAnlegenAuftrag`, `LiedAngelegt`, `LIED_GRENZEN`). Vorher hätte das Formular
  seine `maxLength` und der Server sein Zod-Schema je eigene Zahlen gehabt – zwei Listen über dieselben
  ChurchTools-Grenzen, von denen die zweite bei einer Änderung vergessen wird. `ctWrite.NeuesLied` ist
  jetzt nur ein anderer Name für `LiedStammdaten`.

- **Ein Lied aus dem Liederheft zu öffnen, passiert nur noch an einer Stelle** (`openLibrarySong` in
  `App.tsx`). Beim Antippen in der Liste und nach dem Anlegen sind es dieselben zwei Zustände; als
  zwei Kopien wäre die nächste Änderung an genau einer davon gelandet.

- **Die geführte Einführung nennt beide neuen Einstiege** (`termine-v3`, `setlist-edit-v2`).
  Nebenbefund dabei, gemessen im ausgelieferten Bundle: Produktiv läuft **v2.20.0**, nicht das in
  Doku und Code-Kommentaren behauptete v2.16.3. Damit ist `chart-v4` sehr wohl draußen – die nächste
  Textänderung an den Chart-Schritten braucht also `chart-v5`. Der irreführende Kommentar in
  `onboarding.ts` ist berichtigt.

## [2.21.0] – 2026-08-11

### Neu

- **Beim Ansehen fremder Notizen lässt sich das Arrangement direkt umschalten.** In der Leiste unten
  steht neben dem Personen-Knopf ein zweiter mit einem Notensymbol: Er führt sofort zur Auswahl der
  Arrangements und Versionen **derselben** Person. Bisher ging das nur über „Andere Person" – man
  musste dieselbe Person noch einmal antippen, obwohl man sie gar nicht wechseln wollte.

### Geändert

- **In „Notizen von …" sagt jetzt jede Angabe, was sie ist.** Eine Zeile hieß „Version „Original" ·
  Akkorde & Text" – drei Begriffe, durch Punkte getrennt, und keiner sagte, wofür er steht. Bei einem
  Lied mit zwei Arrangements sahen zwei verschiedene Zeilen dadurch **völlig gleich** aus.

  Jetzt steht das Arrangement oben, Version und Anzeige darunter – mit denselben Wörtern wie im
  Lied-Menü:

  > **Arrangement: Test**
  > Version: Original · Anzeige: Akkorde & Text

  Bei Liedern mit nur einem Arrangement bleibt die Zeile kurz; dort unterscheidet der Name nichts.
  Notizen aus der Zeit vor den Arrangements stehen unter **„Standard"**.

  Der blaue Streifen während des Ansehens und die Meldung nach dem Übernehmen benutzen **dieselben
  Wörter** – alle drei holen sie aus einer gemeinsamen Stelle, statt sie getrennt zu formulieren.

## [2.20.0] – 2026-08-11

### Behoben

- **Team-Notizen: Die Striche eines Kollegen sind auch dann zu finden, wenn er ein anderes
  Arrangement gewählt hat (#320).** Seit v2.19.0 gehören Anmerkungen zum Arrangement – beim Ansehen
  fremder Notizen fehlte diese Angabe aber noch, und man suchte unter einem Schlüssel, den es beim
  Kollegen nicht gab. In der Ebenen-Auswahl stehen zwei Arrangements mit gleichnamigen Versionen
  jetzt getrennt, statt zu einer Ebene zu verschmelzen.

  Betroffen war auch das **Übernehmen**: „Zusammenführen" und „Ersetzen" taten nichts, weil sie
  unter demselben unvollständigen Schlüssel lasen und schrieben.

- **Der Stift-Marker im Lied-Menü war verschwunden.** Neben einer Version zeigt ein kleiner Stift,
  dass du dort Notizen hast – seit v2.19.0 suchte er unter dem alten Schlüssel, während gespeichert
  längst mit Arrangement wird. Er erschien deshalb nie mehr, ohne Fehlermeldung.

## [2.19.0] – 2026-08-11

### Behoben

- **Das Vollbild behält jetzt die Vergrößerung (#319).** Wer hineingezoomt hat und in die Mitte
  tippt, bekommt die Leisten ausgeblendet und die Seite bildschirmfüllend – **die Vergrößerung
  bleibt, wie sie ist.** Bisher wurde sie dabei zurückgesetzt.

  Das war ein Missverständnis von mir: Der ursprüngliche Bericht („Text wird verdeckt") führte zu
  einem automatischen Einpassen beim Umschalten. Nötig war davon nur die eine Hälfte – dass die
  Seite ihren Rahmen nicht mehr überragt. Die erledigt eine andere Stelle; das Einpassen war
  überflüssig und ist entfallen.

### Neu

- **Das Arrangement lässt sich umschalten (#320).** Hat ein Lied mehrere, stehen sie im Lied-Menü
  unter **Arrangement** – über der Version, weil die Versionen ChordPro-Dateien _innerhalb_ eines
  Arrangements sind. Mit dem Wechsel gelten Tonart, Tempo und Dateien des neuen.

  **Der Wechsel gilt nur für dich.** In ChurchTools wird nichts geändert – ein Tippen im
  Gottesdienst stellt nicht den Ablauf des ganzen Teams um. Wer die andere Fassung für alle
  festlegen will, tut das beim Bearbeiten des Ablaufs. Die Wahl bleibt erhalten und folgt dir aufs
  zweite Gerät; die Wahl zurück auf das Arrangement aus dem Ablauf wird als „keine eigene Wahl"
  gemerkt – ändert das Team den Ablauf später, folgt die App wieder.

  **Der Wechsel geht flott.** Sobald das Lied-Menü offen ist, holt die App die anderen Arrangements
  im Hintergrund – meist ist das neue Blatt dann schon da, wenn man tippt. Dauert es doch, sagt eine
  Leiste „Arrangement wird geladen …"; das alte Blatt bleibt bis dahin stehen, denn ein leeres Blatt
  ist im Gottesdienst das Letzte, was man braucht.

  **Deine Anmerkungen gehören ab jetzt zum Arrangement.** Zwei Arrangements können je eine Version
  „Akustik" haben – gleicher Name, anderes Notenblatt. Bestehende Notizen wurden dem Arrangement
  zugeschlagen, das beim ersten Öffnen gilt; **kopiert, nicht verschoben**, der alte Stand bleibt
  als Sicherung liegen.

- **Das Arrangement steht in der Info-Zeile (#320).** Hat ein Lied in ChurchTools mehrere
  Arrangements („Band", „Akustik" …), sieht man jetzt im Liederheft, welches gerade gilt – neben
  Tonart und Tempo. Bei genau einem erscheint **nichts**: Der Name unterscheidet dann nichts und
  wäre nur Lärm auf einem Blatt, das im Gottesdienst gelesen wird.

  Am Arrangement hängen Tonart, Tempo, Taktart und die Dateien – es ist also nicht bloß ein
  Etikett. Bisher war es in der App unsichtbar. Das **Umschalten** kommt als nächster Schritt.

### Behoben

- **Zeigte ein Ablaufpunkt auf ein gelöschtes Arrangement, passte die gemeldete Nummer nicht zum
  gezeigten Blatt.** Der Server fällt in diesem Fall auf das erste Arrangement zurück, meldete aber
  weiter die Nummer aus dem Ablauf. Bisher kosmetisch – seit die Anmerkungs-Schlüssel diese Nummer
  tragen, hätten die Notizen unter einer falschen gelegen.

- **Die Zählweise folgte nicht aufs zweite Gerät.** Neu in v2.18.0 – und dabei war sie die einzige
  Lied-Einstellung, die nicht mit dem Konto wanderte: Tonart, Kapo, Spalten und Schriftgröße tun es
  längst. Gespeichert war sie, beim Abrufen fiel sie still heraus. Ursache war eine
  **Positivliste der Einstellungs-Namen, die zweimal im Code stand** – beim Hinzufügen wurde keine
  von beiden nachgezogen. Jetzt gibt es sie einmal, und ein Test läuft über die Liste selbst: Ein
  künftiger Name ist damit automatisch mitgeprüft.

## [2.18.0] – 2026-08-10

### Neu

- **Ein Menü für alles rund ums Tempo (#145).** Der Knopf oben rechts – jetzt ein **Metronom**
  statt einer Note – öffnet ein Menü statt nur den Puls zu schalten. Darin:
  - **Das Tempo einstellen** – eine Zahl, vier Wege dorthin: **−** und **+**, direkt **eintippen**
    oder im Takt **mittippen**. „Zurücksetzen" führt zurück auf das Tempo aus ChurchTools.
  - **Sichtbarer Puls** – der lautlose Punkt neben der Tempo-Angabe.
  - **Klick** – ein hörbares Ticken. **▶︎** startet und wird zu **⏸**, „Einzählen" klickt **zwei
    Takte** und hört von selbst auf. Die Eins ist höher und lauter. Der Takt kommt von der
    Audio-Uhr, nicht vom Bildtakt: Ein verspäteter Bildaufbau fällt dem Auge nicht auf, dem Ohr
    sofort.
  - **In ChurchTools speichern** – wer darf, legt das eingestellte Tempo dort ab; dann sehen es
    alle, die das Lied öffnen.

  **Puls und Klick laufen mit dem eingestellten Wert**, nicht mit dem gespeicherten. So hört man ein
  angetipptes Tempo erst und speichert es dann. Beim Blättern zum nächsten Lied gilt wieder dessen
  Tempo.

  **Wie viele Schläge je Takt gezählt werden, lässt sich einstellen.** Ein 6/8-Stück zählt man in
  Zweien und nicht als sechs Achtel; ein schnelles 4/4 zählt man in Zweien statt in Vieren. Im Menü
  steht dafür eine Reihe, und auf den Knöpfen steht die Zahl, die dabei herauskommt: bei 6/8 also
  **6 · 3 · 2**, bei 4/4 nur **4 · 2**. „Auto" fasst bei 6/8, 9/8 und 12/8 je drei Achtel zusammen
  (also 2, 3 bzw. 4 Schläge je Takt), sonst zählt es jeden Schlag. Was in der Taktart nicht aufgeht, trägt einen Strich und ist gesperrt.
  Darunter steht immer, wie schnell es dann tickt („klickt 40 ×/min"). Die Einstellung gilt **pro
  Lied und je Version** – wie Tonart und Spaltenzahl – und bleibt erhalten.

  Die Zahl im Tempo-Feld bleibt davon unberührt – sie geht so nach ChurchTools und bedeutet dort
  für jeden dasselbe, egal wie er zählt. Wer gröber mitzählt und mittippt, muss nichts umrechnen:
  Die App tut es.

  **Beide teilen sich einen Takt.** Wer den Puls laufen lässt und den Klick dazuschaltet, bekommt
  Blitz und Ton auf demselben Schlag – und die betonte Eins an derselben Stelle. Der Klick steigt
  dafür in das laufende Raster ein, statt bei sich selbst anzufangen; „Einzählen" wartet dabei auf
  den nächsten Taktanfang, weil „eins, zwei, drei, vier" nur ab einer Eins Sinn ergibt. Auch der
  **sichtbare Puls markiert jetzt die Eins** – ein deutlich weiterer Blitz zu Beginn jedes Takts.
  Ohne ihn sagt er nur, wie schnell es geht, nicht wo der Takt anfängt.

  Beides ist bewusst **nicht gemerkt**: Beim Öffnen des Liederhefts sind Puls und Klick aus. Ein
  Gerät, das im Gottesdienst von selbst losklickt, wäre eine Panne. Der Metronom-Knopf erscheint
  jetzt auch bei Liedern **ohne** hinterlegtes Tempo – genau dort will man eins nachtragen.

  Am iPhone kann der physische Stummschalter den Klick verstummen lassen; das ist eine Eigenheit
  von iOS und lässt sich aus der App heraus nicht umgehen. Der sichtbare Puls läuft weiter.

- **Tempo-Anzeige und Puls erscheinen auch ohne gespeichertes Tempo.** Bislang hing beides an dem,
  was in ChurchTools stand: Bei einem Lied ohne Tempo konnte man zwar eines antippen und der Klick
  lief damit – zu sehen war aber nichts, bis man gespeichert hatte.

### Behoben

- **Vollbild: Text wurde verdeckt (#319).** Beim Aus- und Einblenden der Leisten ändert sich die
  Höhe der Anzeigefläche – die Seite behielt aber ihre alte Größe und ragte dann hinter die
  Fußzeile. Sie wird jetzt neu eingepasst, auch wenn man direkt nach dem Zoomen tippt. Ein bewusst
  gesetzter Zoom geht dabei **nicht** verloren: Er kommt zurück, sobald man wieder auf die Seite
  blättert. Am deutlichsten war das in einem hohen Fenster am großen Bildschirm; am Handy im
  Hochformat begrenzt die Breite und der Fehler blieb unsichtbar. (Gemeldet direkt nach v2.17.0;
  zwei Anläufe davor griffen nicht, weil die Ursache eine dreifache war und nicht nur der Zoom.)

## [2.17.0] – 2026-08-07

### Behoben

- **Beim Abmelden werden jetzt alle Daten der Sitzung verworfen.** Der Server merkt sich zu jeder
  Anmeldung drei Dinge kurzzeitig: Konto-Nummer, Berechtigungen und ein Sicherheits-Token. Beim
  Abmelden wurde bisher nur das erste weggeworfen – die Berechtigungen blieben bis zu fünf Minuten
  stehen. Im Alltag fiel das nicht auf, weil die App-Sitzung beim Abmelden ohnehin endet; sauber war
  es nicht.

### Neu

- **Ein Tipp in die Mitte blendet die Leisten aus (#319).** Kopf- und Fußzeile verschwinden, das
  Liedblatt bekommt die ganze Fläche – nützlich auf dem Notenständer. Ein weiterer Tipp holt sie
  zurück; beim ersten Mal sagt ein kurzer Hinweis, wie. Die Ränder blättern weiter wie bisher, und
  im Anmerkungsmodus passiert nichts – dort gehört der Finger dem Stift. Beim Öffnen des
  Liederhefts sind die Leisten immer da.
- **Tempo-Puls zum Einzählen (#145).** Neben der Tempo-Angabe im Kopf pulst auf Wunsch ein kleiner
  Punkt im Takt des Lieds – lautlos, zum Einzählen, wenn kein Schlagzeuger da ist. Der Schalter `♩`
  sitzt oben rechts und erscheint nur, wenn im Lied ein Tempo hinterlegt ist. Beim Öffnen des
  Liederhefts ist er immer aus, damit im Gottesdienst nichts unerwartet blinkt. Bei sehr schnellen
  Liedern (über 180 Schläge) pulst jeder zweite Schlag – schneller zu blinken gilt als Auslöser für
  photosensitive Anfälle. Wer am Gerät „Bewegung reduzieren" eingestellt hat, bekommt denselben
  Takt ohne das Größerwerden.

### Intern

- **Der letzte Monolith ist aufgeteilt (#280).** `churchtools.ts` vereinte auf 1137 Zeilen das
  HTTP-Fundament, die Anmeldung, die Rechte-Policy, alle Rohdaten-Typen und zehn
  Schreiboperationen. Jetzt neun Module, deren Abhängigkeiten nur in eine Richtung zeigen; das
  größte hat 244 Zeilen. Dabei kam heraus, dass **sieben Schreibfunktionen dasselbe Ritual
  wortgleich enthielten** (Token holen, mitschicken, Ablehnung melden) – das steht jetzt einmal,
  und ein Test prüft die Regel für jede der sieben einzeln.
- **Sieben verwaiste Beschreibungen im Quelltext richtiggestellt** – Kommentare, die über einer
  Funktion standen, die sie gar nicht beschreiben (entsteht, wenn jemand später einen Block
  dazwischenschiebt). Neu `npm run doc-check`, jetzt Teil der CI: Zwei Doc-Kommentare direkt
  hintereinander lassen die Prüfung fehlschlagen.
- Drei weitere handgeschriebene Zwischenspeicher auf den gemeinsamen Baustein `ttlMemo` umgestellt
  (Konto-ID, Rechte, CSRF-Token). Dieselbe Map, dieselbe Ablaufprüfung, dasselbe Aufräumen stand
  viermal im Code – ein Kommentar verwies sogar ausdrücklich auf die Vorlage. Zwei der drei hatten
  **keinerlei Tests**; die gibt es jetzt (`churchtools.sessionMemos.test.ts`).
- **Auch der letzte Monolith im Client ist aufgeteilt (#314).** `ChordChart.tsx` hatte 860 Zeilen
  und **keinen einzigen Test** – und enthielt dabei die Entscheidung, auf welcher Ebene ein
  gezeichneter Strich landet. Ein Fehler dort heißt: Notizen am falschen Lied, an der falschen
  Version oder in der falschen Darstellungsart, bemerkt erst im Gottesdienst; genau das waren #199
  und #250. Jetzt 503 Zeilen – mit dem Vollbild oben aus demselben Release 547 –, und diese
  Entscheidung steht als reine, geprüfte Funktion in
  `utils/chartPageKeys.ts`. Dazu neu: `utils/activeSongView.ts`, die Hooks `useChartSync`,
  `useChartStream`, `useAppLogo` und die Komponenten `ChartHeader`, `ChartFooter`, `ChartOverlays`,
  `ChartTeamNotesBars`. Am Verhalten ändert sich nichts – im Browser durchgeklickt.
- **Die drei bereits ausgelagerten Chart-Hooks haben jetzt Tests** (`useChartNavigation`,
  `useChartEditor`, `useTeamNotesImport`). Sie waren seit Längerem eigene Dateien, aber ohne Netz –
  darunter die Querformat-Grenze („die letzte Seite darf nie allein links stehen") und die einzige
  Stelle der App, die fremde Daten in die eigenen schreibt.
- **Beim Aufteilen fiel auf, dass das App-Logo an drei Stellen vorgeladen wurde** – obwohl es dafür
  längst `loadAppLogo` gab, und nur diese Fassung den Fehlerfall behandelt. Jetzt gehen alle
  darüber.
- **Gerenderte Komponenten werden nach jedem Test wieder abgebaut.** Ohne das blieben sie samt
  ihrer Ereignis-Listener am Leben und mischten sich in spätere Tests derselben Datei ein – ein
  Test zählte dadurch acht Aufrufe statt einem. Betraf **jede** Datei mit `renderHook`, deshalb
  einmal zentral in `src/test-setup.ts` statt in jeder einzelnen.
- **Die Härtung der Test-Instanz ist jetzt wirklich angewendet (#196).** Die Änderungen lagen seit
  Anfang August im Repo, auf dem NAS lief aber noch die alte Fassung – die Test-Instanz lauschte
  weiter im ganzen WLAN, und das Sitzungs-Cookie mit der ChurchTools-Anmeldung lief dabei
  unverschlüsselt. Sie ist jetzt nur noch über eine eigene HTTPS-Adresse erreichbar. Für den
  Selbstbetrieb ist der Weg dorthin in `docs/betrieb/DEPLOYMENT.md` (Abschnitt 6) beschrieben,
  samt vier Prüfungen, mit denen sich nachweisen lässt, dass die Härtung wirklich greift.
- **Lücke in `.gitignore` geschlossen.** Bisher waren die Namen einzeln aufgezählt (`.env`,
  `.env.local`, `.env.*.local`). Eine neue Variante – etwa eine zweite Zugangsdatei – fiel durchs
  Raster und wäre samt Zugangsdaten im Repo gelandet. Jetzt greift die Regel für alle `.env.*`
  außer den Vorlagen. Betrifft alle, die den Quellcode selbst betreiben.
- **Tests: Client 565 · Server 347 · 5 E2E** (vorher 433 · 311 · 5).

## [2.16.3] – 2026-08-06

**Korrektur-Release zu v2.16.2.** v2.16.2 wurde getaggt, aber nie ausgeliefert – die Release-Prüfung
fand danach einen Rückschritt, den v2.16.2 selbst eingebaut hatte. Wer von v2.16.1 kommt, springt
direkt hierher; alles aus v2.16.2 ist enthalten.

### Behoben

- **Die Terminliste ist beim Zurückwechseln wieder sofort aktuell.** v2.16.2 hatte den
  Minutentakt pausiert, solange man die Liste nicht sieht – aber nicht dafür gesorgt, dass beim
  Zurückkommen nachgeladen wird. Nach zehn Minuten im Liederheft hätte man zehn Minuten alte Termine
  gesehen, und das noch bis zu einer Minute lang. Jetzt wird beim Wechsel zurück **einmal sofort**
  neu geladen – man wartet also höchstens eine Netzrunde statt bis zu zehn Minuten, bei deutlich
  weniger Anfragen als vor v2.16.2. (#306)

### Intern

- **Skripte werden jetzt mitgeprüft.** `server/scripts/` stand nicht in der TypeScript-Prüfung und war
  darum still verrottet: `test-pipeline.ts` (12 Fehler) und `test-editor.ts` (2) riefen längst
  gelöschte Funktionen auf. Sie sind entfernt, der Ordner wird geprüft – mit Gegenprobe, dass die
  Prüfung auch wirklich fehlschlagen kann.
- Ein doppeltes Erkundungs-Skript entfernt, das dieselbe Frage beantwortete wie ein bereits
  ausgeführtes und nie gelaufen war.
- Mehrere Falschaussagen in der Doku berichtigt: Skript-Zuordnung und Testzahlen im CHANGELOG, ein
  Selbstwiderspruch in `CLAUDE.md` (eine „wirksamste offene Optimierung", die wenige Absätze weiter
  bereits bewusst verworfen war), die OpenAPI-Aussage jetzt korrekt als Spezifikation **und**
  empirischer Lauf ausgewiesen, `api-referenz.md` von Stand v2.15.0 auf v2.16.3.
- **Tests: Client 433 · Server 311 · 5 E2E** (vorher 428 · 294 · 5).

## [2.16.2] – 2026-08-06

> ⚠️ **Getaggt, aber nie ausgeliefert.** Enthielt den unter v2.16.3 behobenen Rückschritt bei der
> Frische der Terminliste. Produktion ging von v2.16.1 direkt auf v2.16.3.

Kleines Nachfass-Release zu v2.16.1: Es senkt die **Dauerlast** auf ChurchTools deutlich – den Posten,
der sich nach dem letzten Release als der größere herausgestellt hat.

### Geändert

- **Die App fragt ChurchTools deutlich seltener.** Die Terminliste holte bei jeder Aktualisierung für
  jeden Termin **zwei** Dinge – den Ablauf und den Untertitel –, und das im Minutentakt, auch wenn man
  die Liste gar nicht ansah (etwa im Liederheft). Jetzt wird der Untertitel zehn Minuten
  zwischengespeichert, und der Takt läuft nur noch, wenn die Terminliste sichtbar ist. Für ein Gerät
  im Liederheft entfallen damit rund 17 ChurchTools-Anfragen pro Minute. (#306)

### Intern

- **Die Protokollzeile der Lied-Statistik zählt richtig.** Termine ohne Ablaufplan – im
  Vier-Jahres-Fenster der Normalfall – galten als „übersprungen" und ließen dauerhaft
  `vollständig=false` im Protokoll stehen. Eine Warnung, die immer leuchtet, wird ignoriert; und
  dieselbe Zahl sollte später einmal anzeigen, wenn die Statistik wirklich unvollständig ist. (#304)
- Zwei Bausteine zusammengeführt, bevor eine dritte Kopie entstand: der Zwischenspeicher mit
  Verfallszeit (`ttlMemo`, vorher handgeschrieben in `versionMemo`) und die Konto-Kennung für
  Speicher-Schlüssel (`accountKey`, stand wortgleich an zwei Stellen).
- Ein Erkundungs-Skript, das misst, wie viele Termine überhaupt einen Ablaufplan haben (nur lesend).
  Es hat die Zahlen geliefert, mit denen der Merker für „Termine ohne Lieder" bewusst verworfen wurde.

## [2.16.1] – 2026-08-06

Wartungs-Release: **elf Fehler behoben** – dazu die Codeprüfung deutlich verschärft.

Der wichtigste Fund kam beim Testen: **Die App hat ChurchTools selbst überlastet.** Die Statistik „wie
oft wurde dieses Lied gespielt" fragte für jeden Gottesdienst der letzten vier Jahre einzeln nach –
rund 250 Anfragen auf einen Schlag. ChurchTools bremste daraufhin **alles** aus, und plötzlich
scheiterten Anmelden, Berechtigungen und Speichern, obwohl ChurchTools einwandfrei lief. Genau das
waren die roten Meldungen, die im Test aufgetaucht sind.

Das rote Band durch fast alle übrigen Fehler: Ein **vorübergehendes** Problem (ChurchTools antwortet
nicht, Netz weg, Datei nicht lesbar) wurde als **endgültig** behandelt – Daten galten als leer, Erfolg
wurde gemeldet, wo nichts gespeichert war, und eine im Drosselungs-Sturm halb geladene Statistik galt
eine Stunde als Wahrheit.

An der Bedienung ändert sich nichts – die geführte Einführung bleibt unverändert. Neu sind nur
Meldungen, die man hoffentlich nie sieht.

### Behoben

- **Die App überlastet ChurchTools nicht mehr – und das war die Ursache fast aller Aussetzer.** Die
  Statistik „wie oft wurde dieses Lied gespielt" fragte für **jeden** Gottesdienst der letzten vier
  Jahre einzeln bei ChurchTools nach: rund **250 Anfragen auf einen Schlag**, bei fünf Geräten
  gleichzeitig über tausend. ChurchTools bremste daraufhin **alles** aus – Anmelden, Berechtigungen und
  Speichern bekamen Fehler, obwohl ChurchTools selbst einwandfrei lief. Behoben:
  - Bremst ChurchTools, **hört die Statistik sofort auf** statt weiter zu fragen.
  - Öffnen mehrere Geräte gleichzeitig die Liederliste, wird die Statistik **einmal** geholt statt für
    jedes Gerät neu.
  - **Das Vorbereiten des nächsten Gottesdienstes wirft die Statistik nicht mehr weg.** Vorher löste
    schon das Umbenennen eines Ablaufpunkts beim nächsten Blick in die Liederliste einen neuen
    250-Anfragen-Lauf aus – genau diese Schleife hat die Bremse ausgelöst.
  - Kam die Statistik nur halb an, wurde sie bisher **eine Stunde lang als Wahrheit angezeigt** (mit zu
    niedrigen Zahlen). Jetzt wird ein solcher Stand verworfen: Es bleibt der zuletzt bekannte stehen,
    und wenn es keinen gibt, sagt die App „–" statt „0× gespielt". Die Liederliste bleibt dabei
    vollständig. ⚠️ Fällt ein einzelner Termin mit einem anderen Fehler aus (kein Drosseln), sind die
    Zahlen wie bisher bis zu eine Stunde leicht zu niedrig – das bleibt offen. (#300)
- **Speichern belastet ChurchTools deutlich weniger.** Vor jedem Schreibvorgang holte die App ein
  Sicherheits-Token bei ChurchTools – bei **jedem** Speichern neu, beim Umsortieren mehrfach in Folge.
  Genau dieser Aufruf war es, der beim Testen zu mehreren reproduzierbar abgelehnt wurde. Das Token
  gilt jetzt eine Minute und wird bei gleichzeitigen Vorgängen nur einmal geholt. Lehnt ChurchTools
  einen Schreibvorgang ab, wird es sofort verworfen – es kann also kein altes Token hängen bleiben.
  (#298)
- **Ein einzelner ChurchTools-Zicker legt nicht mehr die ganze App lahm.** Schlug ein einzelner
  ChurchTools-Aufruf fehl (das Sicherheits-Token beim Speichern, eine Zeitüberschreitung), zeigte die
  App danach den Vollbild-Hinweis „ChurchTools antwortet gerade nicht" und teils den Login – obwohl
  der eigene Server lief und alles andere ging. Jetzt bleibt ein solcher Fehler auf die betroffene
  Aktion beschränkt. Die Speichern-Meldung nennt außerdem den ChurchTools-Statuscode, damit sich die
  Ursache einordnen lässt. (#296)
- **Das Speichern eines Ablaufeintrags gibt bei einem kurzen Aussetzer nicht mehr sofort auf.** Vor
  jedem Speichern holt die App ein Sicherheits-Token von ChurchTools. Ging das eine Mal daneben (ein
  kurzer ChurchTools-Schluckauf), erschien „CSRF-Token konnte nicht geholt werden." und man musste
  selbst noch einmal auf Speichern tippen. Jetzt versucht die App es einmal automatisch erneut. Das
  gilt für alle Schreibaktionen (Ablauf speichern und umsortieren, Eintrag ändern, Version
  hochladen). (#294)
- **Eine ohne Netz geänderte Einstellung übersteht jetzt auch das Schließen der App.** Wer im
  Flugmodus die Tonart oder den Kapo eines Lieds änderte und die App danach beendete (was iOS im
  Hintergrund von selbst tut), fand beim nächsten Öffnen den alten Wert vor – der Abgleich holte den
  älteren Stand vom Konto zurück. Die Anmerkungen hatten diesen Schutz seit v2.16.0, die
  Einstellungen nicht. Dazu behebt es zwei kleinere Wege zum selben Verlust: eine Änderung, die genau
  während des laufenden Uploads abgeglichen wurde, und eine Änderung direkt vor dem Weg-Wischen der
  App. (#275)
- **Eine nicht ladbare Akkord-Datei ergibt kein leeres Blatt mehr.** Antwortete ChurchTools beim Laden
  nicht (Zeitüberschreitung, Serverfehler), zeigte die App ein **leeres Blatt ohne ein Wort** – und in
  der Sammel-PDF fehlte das Lied ganz. Jetzt wird es gemeldet, und beim Teilen kommt eine Rückfrage.
  Ein Lied, dessen Datei in ChurchTools wirklich gelöscht wurde, bleibt wie bisher einfach leer. (#274)
- **Ein Lesefehler kann keine Kontodaten mehr vernichten.** Konnte der Server die Datei mit den
  Anmerkungen oder Einstellungen nicht lesen (Rechteproblem, beschädigter Inhalt), behandelte er sie
  als **leer** – und der nächste Speichervorgang schrieb diesen leeren Stand zurück. Damit waren alle
  Anmerkungen bzw. alle Lied-Einstellungen des Kontos weg. Umgestellt wurden vier Ablagen (zwei reine Zwischenspeicher bleiben bewusst tolerant), darunter die
  Teilen-Tabelle (die für **alle** gilt) und die Gemeinde-Einstellungen. (#273)
- **„Für offline speichern" meldet Erfolg nur noch, wenn wirklich alles geladen wurde.** Konnte ein
  Dokument nicht geladen werden (Serverfehler, ChurchTools-Aussetzer), wurde der Gottesdienst
  trotzdem als vollständig gespeichert eingetragen – wer sich darauf verließ, stand im Saal ohne
  Dokumente. Jetzt steht dort, wie viele Dokumente fehlen, und das Offline-Häkchen bleibt aus, bis es
  vollständig ist. Die schon geladenen Dateien bleiben erhalten; ein erneuter Versuch holt nur das
  Fehlende nach. (#277)
- **Ein unbrauchbares Anmelde-Cookie wird jetzt in allen Fällen entsorgt.** Nachtrag zu v2.16.0: Ein
  Sonderfall (unsigniertes Cookie) blieb liegen und wurde bis zu 30 Tage weiter mitgeschickt. (#281)
- **Entzogene Team-Notizen-Berechtigung wirkt sofort.** Der Rechte-Puffer, der kurze
  ChurchTools-Aussetzer überbrückt, hielt auch das Recht „fremde Notizen ansehen" bis zu 12 Stunden
  aufrecht. Wer aus der Musiker-Gruppe entfernt wurde, hätte in dieser Zeit weiter fremde Anmerkungen
  lesen können. Wie beim Admin-Recht (v2.16.0) wird es jetzt nicht mehr überbrückt. (#282)

- **„Teilen abschalten" meldet keinen Erfolg mehr, wenn nichts gespeichert wurde.** Scheiterte das
  Speichern, sagte die App „gespeichert" und der Schalter blieb aus – nach dem nächsten Neustart des
  Servers waren die Anmerkungen aber weiter für das Team sichtbar. Jetzt steht dort, dass es nicht
  geklappt hat, und dass weiter geteilt wird. (#276)

### Intern

- **Kleinere Aufräumarbeiten** (#283): Die fünf Auswahl-Overlays der Chart-Ansicht teilen jetzt EINEN
  Zustand statt fünf unabhängiger Schalter – zwei gleichzeitig offene Menüs sind damit nicht mehr
  darstellbar. **Dabei fiel ein Fehler auf, den nur das Durchklicken im Browser zeigte:** Das
  Lied-Menü rief erst die Aktion und dann sein Schließen auf; mit dem gemeinsamen Zustand hätte
  „Transponieren" das Menü geschlossen, **ohne** die Tonart-Auswahl zu öffnen. Reihenfolge korrigiert
  und mit einem Test festgehalten. Außerdem: Der gespeicherte Zoom wird beim Löschen jetzt auch unter
  dem alten Schlüssel vom Konto entfernt (vorher kam er beim nächsten Abgleich zurück), das
  Liederheft-PDF nimmt nur noch die Felder, die es wirklich braucht (ein Doppel-Cast weniger), toter
  Code entfernt und der Kurz-Puffer des Ablauf-Abgleichs erstmals getestet.

- **Die Codeprüfung erkennt jetzt Typ-Zusammenhänge** (`recommended-type-checked`). Damit greifen
  Regeln, die vorher nicht greifen konnten – vor allem „nicht abgewartetes Versprechen": Die Disziplin
  dafür wurde bisher überall von Hand gefahren. 114 Funde, davon **68 im Code behoben**; die restlichen
  waren React-Idiome (`onClick={async …}`) bzw. der normale Umgang mit fremden Daten in Tests und sind
  begründet abgeschaltet. Ein echter Fund dabei: `?songs=…` wurde an **drei** Stellen als String
  behandelt, obwohl Express dort auch ein Array oder Objekt liefert – jetzt EINE geprüfte Stelle
  (`utils/songIdsQuery.ts`). (#279)
- **ESLint 8 → 9, und aus vier Konfigurationen wurde eine** (`eslint.config.mjs` im
  Wurzelverzeichnis). ESLint 8 war am Ende des Supports. Vorher lag in jedem Paket eine fast
  identische Regelliste – `no-explicit-any` stand viermal da, und ob beim Ergänzen alle vier
  angefasst wurden, war Disziplin. `npm run lint` prüft jetzt in einem Lauf auch `scripts/`, das
  bisher niemand geprüft hatte (dort steckten sieben Fehler). Dabei kam heraus, dass fünf
  `eslint-disable no-console` im Server wirkungslos waren, weil die Regel nie aktiv war – sie ist es
  jetzt. Außerdem sind die beiden bekannten Schwachstellen in der Build-Kette (`brace-expansion`,
  `fast-uri`) mit dem Update verschwunden: `npm audit` meldet **0**. (#279)
- **`shared/` und `e2e/` werden jetzt mitgeprüft.** Beide fielen aus dem Lint heraus – `shared/` ohne
  `lint`-Skript (der Workspace wurde stillschweigend übersprungen) und ohne ESLint-Konfiguration, `e2e/`
  weil Client und Server nur ihr eigenes `src` prüfen. Betroffen war damit genau das Paket, das seit
  v2.16.0 Laufzeit-Code über die Prozessgrenze teilt. Zusätzlich deckt `shared`s eigene Typprüfung jetzt
  auch `keys/` ab. (#278)

## [2.16.0] – 2026-08-03

Aufräum- und Härtungs-Release nach dem Code-Check: **neun Fehler behoben, bei denen Daten still
verschwanden, die Anmeldung wegflog oder die App ausfallen konnte**, dazu die Verschlüsselung des
Sitzungs-Cookies und ein neuer automatischer Test für den ganzen Weg vom Anmelden bis zur
gespeicherten Anmerkung.

Zwei der Fehler fielen erst beim Prüfen auf der Test-Instanz auf (#270, #268) – der wichtigere davon
hätte bei einem kurzen ChurchTools-Aussetzer **alle gleichzeitig zum Neu-Anmelden gezwungen**.

An der Bedienung ändert sich nichts – die geführte Einführung bleibt deshalb unverändert. Neu ist nur
eine Meldung, die man hoffentlich nie sieht: „ChurchTools antwortet gerade nicht."

### Behoben

- **Eine Anmerkung übersteht jetzt auch das Schließen der App.** Zeichnete jemand ohne Netz und wurde
  die App danach beendet (was iOS im Hintergrund von selbst tut), war beim nächsten Start nicht mehr
  bekannt, dass der Strich noch nicht auf dem Konto liegt – der erste Abgleich holte den älteren Stand
  und der Strich war weg. Die offenen Uploads werden jetzt auf dem Gerät vermerkt und beim nächsten
  Öffnen nachgeholt. (#256)
- **Ein Netzaussetzer beim Zeichnen kostet keine Anmerkung mehr.** Scheiterte der Upload eines Strichs
  (kurzer WLAN-Aussetzer, Serverneustart), wurde er nicht wiederholt – und der nächste Abgleich holte
  den älteren Stand vom Server zurück, wodurch der Strich **sichtbar verschwand**. Jetzt wird der
  Stand zurückgelegt und erneut versucht, sobald der Server erreichbar ist; ein neuerer Strich gewinnt
  dabei gegen den zurückgelegten. Ist das Konto voll, erscheint jetzt ein Hinweis, statt die Anmerkung
  stillschweigend fallen zu lassen. (Der Fall „App wird zwischendurch geschlossen" kam mit #256 dazu.)
  (#245)
- **Ein kurzer ChurchTools-Aussetzer meldet nicht mehr alle ab.** Antwortete ChurchTools bei der
  Statusabfrage nicht (Zeitüberschreitung, Serverfehler, Netz-Schluckauf), verwarf der Server die
  Anmeldung – und weil das Cookie dabei weg war, half auch Warten nicht mehr: Im Gottesdienst hätten
  damit alle mitten im Lied ihre ChurchTools-Zugangsdaten neu eingeben müssen. Nur ein ausdrückliches
  „Sitzung ungültig" von ChurchTools beendet die Anmeldung jetzt noch; bei einem Aussetzer erscheint
  eine Meldung mit „Erneut versuchen", und die Anmeldung bleibt bestehen. Der Fehler steckte schon in
  v2.15.0, wurde durch die neuen Zeitgrenzen (#248) aber wahrscheinlicher. Die Offline-Reserve war
  dabei nie in Gefahr – die wird nur beim ausdrücklichen Abmelden geräumt. (#270)
- **Entzogene Admin-Rechte wirken sofort.** Der Rechte-Cache, der kurze ChurchTools-Aussetzer
  überbrückt, hielt seinen Stand bis zu **30 Tage** – und überbrückte dabei auch das Admin-Recht. Wem
  in ChurchTools die Verwaltung entzogen wurde, dessen Sitzung aber noch lief, hätte damit weiter
  Einstellungen ändern können. Das Fenster liegt jetzt bei 12 Stunden (der Zweck sind Aussetzer von
  Sekunden), und das **Admin-Recht wird grundsätzlich nicht mehr überbrückt**. (#249)

- **Ein Dokument, das nicht geladen werden kann, wird nicht mehr verschwiegen.** Wählte man zu einem
  Lied ein hochgeladenes PDF oder Bild und dessen Laden scheiterte, zeigte die App **ohne ein Wort**
  die Akkorde. Der Rückfall bleibt (lieber Akkorde als eine leere Seite), aber jetzt mit Hinweis. (#251)
- **Ein voller Gerätespeicher wird nicht mehr verschwiegen.** Passt eine Anmerkung nicht mehr in den
  Gerätespeicher, sagt die App das jetzt – einmal pro Sitzung, nicht bei jedem Strich. Die Anmerkung
  selbst ist nicht verloren: Sie geht weiter aufs Konto und kommt beim nächsten Abgleich zurück; nur
  der Offline-Vorrat funktioniert dann nicht. (#251)

- **Eine übergroße Datei in ChurchTools legt die App nicht mehr lahm.** Der Server hielt jede
  durchgereichte Datei vollständig im Speicher – ohne Obergrenze. Ein versehentlich hochgeladener
  Scan von einigen hundert MB hätte den Container umgelegt und damit die App für **alle
  gleichzeitig**. Jetzt ist bei 50 MB Schluss (weit über jedem realen Notenblatt), und wer so eine
  Datei öffnet, bekommt eine Meldung statt eines Ausfalls. Außerdem haben alle ChurchTools-Aufrufe
  jetzt eine Zeitgrenze: Antwortet ChurchTools nicht, endet die Anfrage nach 15 Sekunden (Dateien 60)
  mit einem verständlichen Hinweis, statt den Server mit hängenden Anfragen zu füllen. (#248)
- **„Notizen von …" zeigt wieder die Ansicht des Kollegen, nicht Standardwerte.** Hatte die andere
  Person ihre Spalten-/Schriftgröße noch unter einem älteren Schlüssel gespeichert, wurden diese Werte
  beim Ansehen ignoriert – man sah ihre Anmerkungen in der falschen Darstellung, wodurch sie
  verrutscht wirken konnten. Ursache: Die Umrechnung der Einstellungen gab es ein zweites Mal, ohne
  die Rückfälle auf die alten Schlüssel und ohne den Schutz gegen unsinnige Werte. Es gibt sie jetzt
  nur noch einmal. (#247)
- **Die einmalige Übernahme bestehender Anmerkungen aufs Konto verpasst sich nicht mehr.** Lief sie
  bei schlechtem Netz ins Leere, galt sie trotzdem als erledigt – die auf dem Gerät gesammelten
  Anmerkungen landeten damit **nie** auf dem Konto, still und ohne Meldung. Sie läuft genau einmal pro
  Gerät, es gab also keine zweite Chance. Jetzt wird der Merker nur gesetzt, wenn nichts
  netzbedingt gescheitert ist; ein einzelner zu großer Eintrag hält den Vorgang dagegen nicht auf
  (er würde auch beim nächsten Mal scheitern) und wird gemeldet. (#246)

### Geändert

- **Das ChurchTools-Cookie liegt nicht mehr lesbar im App-Cookie.** Wer das Sitzungs-Cookie in die
  Hände bekam – aus einem Backup, einem Proxy-Log oder einem verlorenen iPad –, konnte daraus die
  ChurchTools-Anmeldung herauslesen und damit **direkt in ChurchTools** arbeiten, also weit mehr als
  in der App möglich ist. Der Anteil ist jetzt verschlüsselt. **Niemand wird dadurch abgemeldet:**
  Bestehende Anmeldungen werden weiter gelesen und beim nächsten Aufruf automatisch umgestellt.
  ⚠️ Beim Deploy muss `SESSION_SECRET` unverändert bleiben – der Schlüssel wird daraus abgeleitet. (#194)
- **Eine unbrauchbare Anmeldung wird auf dem Gerät auch gelöscht, nicht nur ignoriert.** Ließ sich das
  Sitzungs-Cookie nicht mehr lesen (gewechseltes `SESSION_SECRET`, beschädigter Inhalt), behandelte
  der Server das als „nicht angemeldet" – ließ das tote Cookie aber liegen, sodass der Browser es bis
  zu 30 Tage bei jeder Anfrage weiter mitschickte. Kein Datenverlust, aber unnötiger Ballast; jetzt
  ist es nach dem ersten Aufruf weg. (#268)
- **Die Test-Instanz ist gehärtet** (betrifft nur die Einrichtung auf dem NAS, nicht die App): Ihr Port
  lauscht nur noch lokal statt im ganzen LAN, `COOKIE_SECURE` ist standardmäßig an, und der
  Auto-Update-Dienst ist auf eine feste Image-Fassung gepinnt. Vorher lief das Sitzungs-Cookie dort
  unverschlüsselt über HTTP durchs Netz. **Zum Anwenden ist ein Reverse Proxy auf die Test-Domain
  nötig** – die Anleitung in der Compose-Datei sagt, was zu tun ist. (#196)
- **Der Server beendet sich beim Neustart geordnet.** Bisher gab es kein Signal-Handling: Beim
  `docker stop` brach Node sofort ab, laufende Anfragen (z. B. ein gerade hochgeladener Strich)
  einfach mitten durch. Jetzt darf Laufendes fertig werden, untätige Verbindungen werden geschlossen,
  und nach 8 Sekunden greift eine Notbremse – in der Praxis ist er in rund einer Sekunde unten.
  Unbehandelte Promise-Fehler landen außerdem im Log statt still zu verpuffen. (#251)

### Intern

- **Die Schlüssel-Grammatik der Anmerkungen und Einstellungen liegt jetzt an EINER Stelle**
  (`shared/keys`), die Client und Server gemeinsam nutzen. Vorher wurden die Schlüssel an fünf Stellen
  von Hand zusammengesetzt und die Prüfmuster standen zweimal wortgleich über die Prozessgrenze – eine
  Abweichung hätte den Abgleich still lahmgelegt, wie es beim Querformat-Zoom schon einmal passiert
  ist. Für Mitspielende ändert sich nichts. (#250)
- **Der wichtigste Weg der App läuft jetzt automatisch durch:** Anmelden → Termin → Ablauf → Chart →
  Anmerkung → Abgleich, gegen einen kleinen ChurchTools-Ersatz (`e2e/ct-stub.mjs`), aber mit dem
  **echten** Server samt Sitzungs-, Rechte- und Proxy-Logik. Genau dort lagen die Fehler, die diese
  App am häufigsten getroffen haben (#186, #211, #245/#256) – geprüft wurde bisher nur das Rendern
  der Chart-Ansicht ohne Backend. (#174)
- **Tests: Client 383 · Server 205 · 5 E2E** (vorher 319 · 168 · 1). Neu abgedeckt: das
  Wiederholen fehlgeschlagener Uploads, die Dateigrenze und die Zeitgrenzen zu ChurchTools, die
  Cookie-Verschlüsselung samt Bestandsformaten, der Seitenstrom aus Akkorden und Dokumenten sowie die
  Zeichen-Werkzeugleiste. Vier Testfälle in `docs/tests/` ergänzt (58 insgesamt).
- **Aus den Funden dieses Releases wurden Regeln gemacht** statt nur Notizen: Nach jedem Fix wird per
  `grep` nach der **zweiten Stelle** derselben Regel gesucht, jeder neue Test wird durch Zurücknehmen
  des Fixes gegengeprüft, und Build/Lint/Tests werden am **Exit-Code** geprüft (ein `grep` auf die
  Ausgabe meldete einmal „0 Fehler", während die CI rot war).

## [2.15.0] – 2026-07-31

Sammel-Release: vier nutzersichtbare Korrekturen und eine große Aufräumrunde (#198 abgeschlossen).
Für Mitspielende ändert sich nichts an der Bedienung – die geführte Einführung bleibt deshalb
bewusst unverändert.

### Behoben

- **Eine eigene Überschrift über `{title: …}` wird jetzt übernommen.** Wer im Editor die Titelzeile
  änderte, sah den neuen Titel nur in der Vorschau rechts – auf dem fertigen Blatt stand weiter der
  Liedname aus ChurchTools. Tonart und Taktart aus der Datei hatten längst Vorrang, Titel und Autor
  waren dabei vergessen worden. Gilt nun auf dem Blatt, in der Kopfzeile, im Ablaufplan und im
  PDF-Export; eine Version mit eigener Überschrift trägt sie auch auf ihrem Blatt. Unter **Alle
  Lieder** bleibt bewusst der ChurchTools-Name, weil die Liste die Liedtexte nicht lädt. (#236)
- **Querformat wird auch erkannt, wenn die App aus dem Hintergrund zurückkommt.** Drehte man das
  iPad, während die App weggelegt war, kam kein `resize` – die Chart-Anzeige merkte es trotzdem, das
  Blättern aber nicht. Anzeige und Blättern waren dann unterschiedlicher Meinung darüber, ob eine
  oder zwei Seiten zu sehen sind. Alle drei Stellen nutzen jetzt dieselbe Erkennung. (#215)
- **Derselbe Ablauf-Titel wird überall gleich dargestellt.** Bei einem Punkt ohne verknüpftes Lied
  wurden führende/folgende Leerzeichen nicht entfernt, mit Lied schon – derselbe Titel sah dadurch
  je nach Stelle anders aus. (#215)
- **„Als PDF teilen" rechnet den Kapo mit.** Bei gesetztem Kapo war das geteilte PDF anders
  transponiert als der Bildschirm – bei Kapo 2 standen die Akkorde zwei Halbtöne zu hoch. Ursache
  waren drei Fassungen derselben Rechnung; einer fehlte der Kapo-Abzug. Es gibt sie jetzt nur noch
  einmal. Bei Kapo 0 war nichts zu sehen, deshalb fiel es lange nicht auf. (#239)

### Geändert

- **Einheitliche Code-Formatierung**, die auch geprüft wird: `npm run format:check` läuft in der CI
  vor dem Lint. Nötig, weil ESLint hier bewusst **nicht** greift (`eslint-config-prettier` schaltet
  alle Formatregeln ab) – der Stil war darum unbemerkt auseinandergelaufen (86 Dateien). Ändert nur
  Formatierung; gegengeprüft, indem alle geänderten Code-Dateien vor und nach dem Formatieren auf
  ihren Zeichen-Kern reduziert und verglichen wurden. (#233)

### Intern

- **Seiten-Engine aufgeteilt** (`PageDeck`: 1161 → 713 Zeilen). Die Anzeige verhält sich
  unverändert – am Gerät geprüft (Stift, Handballen, Zwei-Finger-Abbruch, Pinch-Zoom, Blättern,
  Querformat, Text). Herausgelöst: das Malen der Seiten, die Zoom-Steuerung, das Blättern, die
  Text-Ebene, der Blätter-Streifen und die Werkzeugleiste. Die abgeschalteten Hook-Prüfungen sind
  von 13 auf 1 gesunken; dabei kam eine stille Lücke ans Licht: Wechselte der Anmerkungs-Schlüssel
  einer Seite, ohne dass Seitenzahl oder Sync sich bewegten, blieb der alte Strich-Stand stehen.
  40 neue Tests. (#193)
- **Testmanagement für die Tests, die nur von Hand gehen** (`docs/tests/`): 56 Testfälle als
  Klickanleitung, aus den geschlossenen Fehler-Issues und der Doku rekonstruiert, jeder mit der
  Issue-Nummer, bei der es schon einmal wehgetan hat. Der Kern ist die Auswahl: `npm run testplan`
  vergleicht die Änderungen seit dem letzten Tag mit dem Feld **Betrifft** und trennt „immer prüfen"
  (12), „betroffen" und „übrige" – letztere nur als Zahl, damit sichtbar bleibt, was ausgelassen
  wurde. `--pruefen` findet Verweise auf verschobene Dateien; ohne das würde ein Fall nie wieder
  vorgeschlagen, ohne jede Fehlermeldung. (#234)
- **Ablauf-Ansicht aufgeteilt** (`Setlist`: 672 → 357 Zeilen): Zeilen-Bestandteile, der „poof"-Zerfall
  entfernter Punkte, die volle Ansicht und die sortierbare Zeile sind eigene Komponenten. +18 Tests,
  darunter zwei für die Stellen, die im Gottesdienst wehtun: Die Lied-Nummer beim Antippen zählt nur
  **Lieder**, nicht alle Ablaufpunkte, und ein gelöschter Punkt zerfällt dort, wo er stand. Dazu ein
  Test gegen den stillen Fehler dieser Art Umzug: Wäre der Pfad zum SCSS-Modul falsch, gäbe es keinen
  Fehler – die Zeilen ständen einfach ohne Layout da. (#232)
- **Persistenz raus aus den Komponenten** (#198): `useSongSettings` hält und speichert die
  Anzeige-Einstellungen; die Schlüsselbildung liegt an genau einer Stelle. Vorher wurden
  `worship_view_<id>`/`worship_ver_<id>` an je **zwei** Stellen zusammengesetzt – beim Lesen und beim
  Schreiben; ein Tippfehler auf einer Seite hätte die Einstellung still ins Leere laufen lassen. In
  `components/` und `pages/` steht jetzt kein einziger `localStorage`-Zugriff mehr. +12 Tests für die
  Regel, die man leicht verwechselt: Tonart, Kapo, Spalten, Schrift, Nur-Text und
  Abschnitts-Transponierung gelten **pro Version**, die gewählte Version selbst **pro Lied**. (#231)
- **Serverseitig aufgeteilt** (`setlistBuilder`: 660 → 447 Zeilen) in vier reine Module ohne
  Netzzugriff: Ablauf-Diff, Arrangement-Dateien, ChordPro-Kopfangaben, Ablauf-Formatierung. Die vier
  prozesslokalen Caches liegen jetzt beieinander statt zwischen Routing-Code, mit der Folge
  aufgeschrieben: Mit einer zweiten Instanz hinter einem Lastverteiler würde der Ablauf zwischen
  „geändert" und „unverändert" flackern. (#230)
- **Chart-Ansicht entlastet** (`ChordChart`: 1053 → 812 Zeilen) – der letzte offene Punkt von #198.
  Drei Komponenten heraus: Lied-Menü, Aussehen-Menü und der „Notizen von …"-Wähler. Das Lied-Menü
  schließt sich jetzt **selbst** nach jeder Auswahl; vorher stand derselbe Aufruf elf Mal in den
  Klick-Handlern. Die Schriftgrößen-Regel ist eine reine, geprüfte Funktion. +33 Tests. Dabei kam
  der Kapo-Fehler (#239) ans Licht: Die Aufteilung machte sichtbar, dass die PDF-Optionen an drei
  Stellen gerechnet wurden. `songPdfOpts` ist nun eine dünne Hülle über `loadSettings` +
  `pdfOptionsForSong`, samt zweiter Kopie von `loadSecShift` weniger. Beim Zusammenführen galt
  jeweils die robustere Fassung – dadurch macht Unsinn im Speicher (`capo: "kaputt"`) nun auch in
  der **Anzeige** keinen `NaN`-Versatz mehr. (#198, #239)
- **Kleinkram aus den Sammel-Issues**, zwölf Punkte, +36 Tests. Zusammengeführt statt kopiert
  (Querformat-Erkennung, Textstil-Regel, der letzte rohe `fetch` außerhalb von `services/`). Härter
  geworden: Der Rate-Limit-Schlüssel erkennt IPv4-mapped in jeder Schreibweise – vorher hätte ein
  Client über die ausgeschriebene Form **zwei** Kontingente gehabt; der Schlüssel-Filter der
  Lied-Einstellungen bekam einen End-Anker (bewusst nicht `_\d+$`, das hätte die versionsbezogenen
  Schlüssel still verworfen und Einstellungen geräteübergreifend gelöscht); die Tastatur-Aussparung
  nutzt einen Callback-Ref, sonst hätte ein zusätzlicher Wrapper sie still abgeschaltet. Endlich
  getestet: die einmalige Übernahme lokaler Anmerkungen ins Konto (Rest von #192) – der Merker darf
  nach einem 401 **nicht** gesetzt werden, sonst ist die Übernahme für immer verpasst. (#229, #215,
  #199, #192)

## [2.14.2] – 2026-07-26

### Behoben

- **Ein falsch getipptes Passwort löscht nicht mehr die Offline-Reserve.** Die App hielt einen
  fehlgeschlagenen Anmeldeversuch für eine abgelaufene Sitzung und räumte dabei alles vom Gerät –
  auch die für den Gottesdienst gespeicherten Lieder. Genau im schlechtesten Moment (im Saal, ohne
  Netz, einmal vertippt) waren die Charts damit weg. (#210)
- **Anmerkungen und Einstellungen werden nach einer erneuten Anmeldung wieder gespeichert.** Hatte
  die App zwischendurch automatisch abgemeldet, landeten sie bis zum Neustart nur noch auf dem Gerät
  und fehlten auf anderen Geräten – ohne jeden Hinweis. (#211)
- **Nach einer Offline-Phase findet die App von selbst zurück.** Bisher blieb der Hinweis „Keine
  Verbindung" stehen, und die Anmeldung scheiterte mit „Bitte E-Mail und Passwort prüfen", obwohl
  das Passwort stimmte – nur ein kompletter Neustart half. Die App prüft die Verbindung jetzt aktiv
  nach (auch beim Zurückkehren in die App), und die Meldung benennt die echte Ursache:
  Verbindungsproblem, falsche Zugangsdaten oder zu viele Versuche. (#218)
- **Das Liederheft blockiert die Bedienung nicht mehr.** Beim Ändern von Tonart, Spalten oder
  Schriftgröße wurde es mitten im Bildaufbau neu erzeugt – auf älteren Geräten stand die App
  solange. Jetzt reagiert die Oberfläche sofort, die bisherigen Seiten bleiben sichtbar, bis die
  neuen fertig sind. (#197)
- **Lied-Einstellungen: Aufräumen ist immer möglich**, auch wenn die Speichergrenze schon
  überschritten war (vorher kam man aus der Sackgasse nicht mehr heraus). Und wenn eine Einstellung
  nicht gespeichert werden kann, sagt die App das jetzt, statt sie stillschweigend zu verwerfen.
  (#213)

### Sicherheit

- **Schutz gegen Passwort-Rateversuche gehärtet:** Die Erkennung des Anschlusses hinter dem
  Reverse-Proxy hing an einer ungeprüften Annahme; sie ist jetzt korrekt und durch einen Test
  abgesichert. (#214)
- Abhängigkeiten aktualisiert – im ausgelieferten Stand sind **keine bekannten Schwachstellen**
  mehr offen. (#215)

### Intern

- **Tests an den Hotspots** (#192, #212): Der Schreibpfad, der eine Lied-Verknüpfung unwiderruflich
  zerstören könnte, ist jetzt abgesichert (11 Tests); die PDF-Erzeugung ging von 0 % auf 88 %
  Abdeckung, die Anmerkungs-Synchronisierung von 13 % auf 54 %.
- Nachschliff aus den Code-Checks (#198, #215): einheitlicher Sitzungs-Zugriff im Server statt 29
  stiller Typ-Zusicherungen, kein Session-Cookie mehr als Cache-Schlüssel, weniger Log-Rauschen,
  toter Code entfernt, eindeutigere Hook-Namen.
- Tests: Client 129 → 185, Server 133 → 150.

## [2.14.1] – 2026-07-26

### Behoben

- **Die Ansicht verrutscht nicht mehr, wenn die Tastatur aufgeht:** Beim Verknüpfen eines Lieds lagen
  die Suchtreffer hinter der Tastatur – man musste erst hochwischen, um das gefundene Lied antippen zu
  können. Und nach dem Speichern blieb die obere Leiste verschoben („Termine" und das Häkchen klebten
  oben, darunter eine Lücke). Die Dialoge sparen die Tastatur jetzt aus, und die Ansicht sitzt nach dem
  Schließen wieder normal. Betrifft alle Dialoge mit Eingabefeldern (Hinzufügen, Bearbeiten,
  Einstellungen). (#207)

## [2.14.0] – 2026-07-26

### Neu

- **Titel eines Lied-Punkts ist änderbar und wird immer angezeigt:** In ChurchTools hat ein
  Lied-Punkt im Ablauf einen eigenen Titel (bei uns meist schlicht „Lied") **und** ein verknüpftes
  Lied – und CT zeigt beides: „Lied – Du großer Gott". Die App zeigte bisher nur den Liednamen, und
  das Titelfeld war bei Liedern gesperrt. Jetzt lässt sich der Titel auch bei Liedern bearbeiten
  (z. B. „Lobpreis 1"), und der Ablauf zeigt Titel und Liedname gemeinsam. Fügt der Titel nichts
  hinzu (leer oder gleich dem Liednamen), bleibt es bei einer Angabe – keine Dopplung. (#200)

### Sicherheit

- **Lied-Einstellungen haben jetzt eine Obergrenze pro Konto** (20.000 Einträge / 5 MB, wie die
  Anmerkungen seit v2.11.0). Ohne Grenze hätte ein angemeldetes Gemeindeglied den Speicher des
  Servers mit beliebig vielen Einstellungen füllen können. Aufräumen bleibt immer möglich, auch
  wenn die Grenze erreicht ist. (#195)
- **Der Schutz gegen Passwort-Rateversuche greift jetzt auch bei IPv6.** Die Bremse am Login zählte
  pro IP-Adresse – bei IPv6 hat ein Anschluss aber Milliarden Adressen, sodass sie umgangen werden
  konnte. Gezählt wird jetzt pro Anschluss (IPv6-/64-Netz). (#146)
- **Datei-Abrufe folgen keinen Weiterleitungen mehr,** damit die ChurchTools-Anmeldung die eigene
  Instanz nicht verlassen kann. (Geprüft: ChurchTools liefert Dateien direkt aus – die
  Dokumenten-Anzeige bleibt unverändert.) (#199)

### Intern

- **Kleinkram aus dem Code-Check (#199):** Anmerkungen ermitteln die Konto-ID aus der eigenen
  Sitzung statt sie bei jedem Speichern erneut bei ChurchTools zu erfragen; der kurze Zwischen-
  speicher des Ablauf-Fingerabdrucks ist kontobezogen (vorher konnte ein Nicht-Berechtigter statt
  einer Absage einen Prüfwert erhalten); Fehlermeldungen verraten keine internen ChurchTools-Pfade
  mehr; `clearSession` spiegelt die Cookie-Attribute.
- Tests: Client 115 → 123, Server 116 → 133 (+25).

## [2.13.6] – 2026-07-26

### Behoben

- **Abgelaufene Anmeldung führt jetzt sauber zum Login statt in eine Sackgasse:** Wenn die
  ChurchTools-Sitzung im Hintergrund ablief, ließ sich der Ablauf nicht mehr laden („Ablauf konnte
  nicht geladen werden") bzw. das Speichern schlug mit einer technischen Meldung fehl
  („CSRF-Token konnte nicht geholt werden") – und „Erneut versuchen" half nicht weiter, nur
  Abmelden und neu Anmelden. Die App erkennt eine abgelaufene Sitzung jetzt an **jeder** Stelle
  und führt automatisch zur Anmeldung; danach ist alles wieder da. (#186)
- **Die Kopfleiste springt nicht mehr:** Auf iPhones mit Notch/Dynamic Island ruckte die obere
  Leiste kurz nach oben und zurück, wenn ein Dialog geschlossen wurde – etwa nach dem Verknüpfen
  eines Lieds und Speichern. Der Abstand nach oben bleibt jetzt stabil. (#187)

### Intern

- **Nachschliff aus dem Delta-Check zu v2.10.0 (#152):** Ein vorübergehendes „Kein Zugriff" von
  ChurchTools (403) löst keine Zwangs-Abmeldung mehr aus (wichtig zusammen mit #186); der
  Hinweis „Sitzung abgelaufen" bietet einen „Abmelden"-Knopf, falls das automatische Abmelden
  scheitert; die Team-Notiz-Endpunkte nutzen die Konto-ID aus der eigenen Sitzung statt sie jedes
  Mal bei ChurchTools zu erfragen (fallen bei einem CT-Aussetzer nicht mehr unnötig aus).
  Dazu 10 neue Wachtests (Beschneidung der öffentlichen Konfiguration, Update-Check-Cache,
  Weitertragen der Konto-ID) – Server-Tests 106 → 116.

## [2.13.5] – 2026-07-16

### Intern

- **Code-Check-Nachschliff (Note 1, 0 Sicherheitsfunde):** Zoom-Wiederherstellung in PageDeck
  entdupliziert (`restoreVisibleZoom`), localStorage-Schlüssel-Grammatik zentralisiert
  (`utils/annotationKeys` + Tests), Zeichen-Engine in `usePointerStrokes` ausgelagert
  (PageDeck 1355→1161 Z.), Redraw-Effekt entschärft, alle react-refresh-Lint-Warnungen beseitigt
  (Lint 0). Kein Verhaltensunterschied.

## [2.13.4] – 2026-07-16

### Behoben

- **Gelöschte Ablaufpunkte lösen sich jetzt immer sichtbar auf:** Ein Punkt, der erst nach dem
  Öffnen des Ablaufs hinzukam und dann wieder gelöscht wurde, verschwand bisher kommentarlos
  (er stand noch in keiner „gesehen"-Basislinie, daher kam kein Auflöse-Platzhalter vom Server).
  Die Ablauf-Ansicht erkennt solche Löschungen jetzt selbst und zeigt auch dafür die
  durchgestrichene Zeile mit Zerfalls-Effekt – nahtlos, ohne Aufblitzen. (#178)
- **Start-Fehlerschirm heilt sich selbst und ist diagnostizierbar:** Der Auffang-Schirm „Die App
  konnte nicht richtig starten" lädt bei einem Chunk-Ladefehler (typisch direkt nach einem Deploy)
  jetzt einmalig still neu, statt stehen zu bleiben; bei echten Fehlern zeigt er zusätzlich die
  Fehlermeldung an (ein Screenshot reicht zur Ferndiagnose). (#176)

### Intern

- **UI-Monolithen aufgeteilt (#140):** `PageDeck.tsx` (1552→1355 Z.) und `ChordChart.tsx`
  (1292→1093 Z.) – Zoom-Persistenz, iOS-Tastatur, Slide-Übergang und Team-Notizen-Import in eigene
  Hooks (`useZoomPersistence`/`useKeyboardInsets`/`useSlideTransition`/`useTeamNotesImport`),
  `mergeStrokes` nach `utils/strokes.ts`. Kein Verhaltensunterschied.
- **Interaktionskern getestet (#141):** Tests für `usePageDraw` (Undo/Redo, Push-Dedup, Key-Wechsel)
  und `Coachmarks`; Playwright-Render-Smoke (`?demo=chart`) als eigener CI-Job `e2e`; Coverage auch
  über `hooks/` + `services/`. Voller Auth-Flow-E2E bleibt offen (#174).

## [2.13.3] – 2026-07-15

### Behoben

- **Hinweis-Balken und Menüs sitzen im Browser wieder unter der Kopfleiste:** Nach dem
  Kopfleisten-Fix (2.13.1) konnten der „Ablauf wurde geändert"-Balken und die beiden
  Chart-Menüs (Aussehen/Modus) im Safari-Tab leicht in die höhere Kopfleiste hineinragen –
  sie halten jetzt denselben Mindestabstand. Installiert unverändert.

## [2.13.2] – 2026-07-15

### Geändert

- **Offline-Anzeige verständlicher:** Statt der technischen Zählung („X Datensätze · Y Dateien")
  zeigt der Mehr-Tab jetzt schlicht „Offline bereit ✓ · zuletzt gespeichert am <Datum, Uhrzeit>".

## [2.13.1] – 2026-07-15

### Behoben

- **Obere Leiste im Browser nicht mehr abgeschnitten:** Im Safari-Tab (nicht installiert) wurde der
  Titel oben von der Adress-/Statusleiste angeschnitten. Die Kopfleisten (Termine/Lieder-Titel,
  Chart-Ansicht, Akkord-Editor) halten jetzt einen ausreichenden Mindestabstand nach oben – im
  installierten Modus unverändert.

## [2.13.0] – 2026-07-15

### Hinzugefügt

- **Zeitfilter für Lied-Statistik (#158):** In der Lieder-Bibliothek lässt sich bei den
  Sortierungen „Häufigkeit" und „Zuletzt" jetzt ein Zeitraum wählen (Von–Bis oder „Alle"). Dann
  zählen und erscheinen nur die Lieder, die in diesem Zeitraum tatsächlich gespielt wurden – so
  siehst du z. B. „was lief in den letzten 3 Monaten am häufigsten". Die Sortierung „A–Z" bleibt
  davon unberührt und zeigt weiter alle Lieder. Nebenbei: „Zuletzt" bezieht sich jetzt auf das
  letzte tatsächlich gespielte Datum (geplante Zukunftstermine zählen nicht mehr als „gespielt").
- **Volle Lied-Auswahl beim Hinzufügen & Verknüpfen (#157):** Beim „Lied hinzufügen" und beim
  Verknüpfen eines Lieds an einen Ablaufpunkt werden jetzt sofort alle Lieder gezeigt (statt einer
  leeren Suche) – mit denselben Möglichkeiten wie in der Bibliothek: durchsuchen, sortieren nach
  A–Z / Häufigkeit / Zuletzt und Zeitfilter. So sieht man beim Planen direkt, was lange nicht dran
  war oder oft läuft. Ein Lied = eine Zeile (Standard-Arrangement); Start alphabetisch.

### Geändert

- **Eintrag bearbeiten – alles in einem Schwung:** Änderungen an einem Ablaufpunkt (Titel, Dauer,
  Zuständige, Bemerkung, Lied verknüpfen/aufheben) werden jetzt in einem einzigen Speichervorgang
  geschrieben statt Schritt für Schritt – schneller und ohne halb gespeicherte Zwischenstände.
  Ein geleertes Dauer-Feld entfernt die Dauer; ein versehentlicher Tipp neben den Dialog verwirft
  vorgemerkte Änderungen nicht mehr.
- **Intern:** Die Nutzungsstatistik liefert je Lied die vergangenen Spieltermine (bis zu 4 Jahre
  zurück); Häufigkeit und „zuletzt" für den gewählten Zeitraum rechnet die App daraus direkt aus –
  ohne erneute Server-Abfrage beim Verstellen des Zeitraums.

### Behoben

- **„Geändert"-Markierungen bleiben nach Updates erhalten:** Der zuletzt gesehene Ablauf-Stand
  wurde in der produktiven Installation nicht dauerhaft gespeichert und ging nach jedem Update
  verloren (der „geändert"-Punkt wäre danach fälschlich überall erschienen). Jetzt liegt er
  zuverlässig auf dem Daten-Volume.

### Sicherheit

- **Ablauf-Abgleich ohne Klartext:** Der Live-Abgleich des Ablaufs überträgt nur noch eine
  Prüfsumme statt der eigentlichen Inhalte (Titel/Notizen/Verantwortliche).
- **Dateien nur von der eigenen ChurchTools-Instanz:** Beim Laden von Datei-Anhängen wird die
  Anmelde-Sitzung ausschließlich an die eigene ChurchTools-Adresse gesendet, nie an fremde Ziele.

## [2.12.0] – 2026-07-14

### Hinzugefügt

- **Live-Aktualisierung:** Änderungen am Ablauf erscheinen jetzt fast sofort bei allen – egal ob
  sie in ChurchTools oder in der App gemacht wurden. Die sichtbare Terminliste aktualisiert sich
  jede Minute von selbst (der „geändert"-Punkt taucht ohne Zutun auf), ein geöffneter Ablauf
  gleicht sich alle paar Sekunden ab und sortiert sich bei Änderungen sofort um. Im geöffneten
  Liederheft springt dagegen nichts von selbst: Dort erscheint ein dezenter Hinweis „Ablauf wurde
  geändert" mit „Neu laden"-Knopf – mitten im Spielen bewegen sich die Seiten nie ungefragt.
- **Im Ablauf sichtbar, was sich geändert hat (#161):** Öffnest du einen Ablauf, in dem sich seit
  deinem letzten Blick etwas getan hat, leuchten die betroffenen Punkte kurz auf – neue, inhaltlich
  geänderte (Tonart, Verantwortliche, Dauer, Notiz) und verschobene Punkte pulsen dreimal in der
  Akzentfarbe. Entfernte Punkte erscheinen noch einen Moment durchgestrichen und lösen sich dann in
  vielen kleinen Teilchen auf („poof", wie beim Löschen einer Nachricht auf dem iPhone). So siehst
  du auf einen Blick, was passiert ist. Wer im Gerät „Bewegung reduzieren" aktiviert hat, bekommt
  eine ruhige, bleibende Hervorhebung statt der Animation.

## [2.11.0] – 2026-07-14

### Hinzugefügt

- **Hinweis, wenn sich ein Ablauf geändert hat (#143):** An der Termin-Karte erscheint ein
  dezenter blauer Punkt, sobald sich der Ablauf geändert hat, seit du den Termin zuletzt geöffnet
  hast – ähnlich wie bei ungelesenen Nachrichten. Er verschwindet, sobald du wieder reinschaust.
  Erfasst wird die ganze Ablauf-Struktur (Lieder, Reihenfolge, Tonart, aber auch verschobene oder
  umbenannte Punkte, Verantwortliche, Dauer, Notiz). Der Hinweis ist persönlich und gilt
  geräteübergreifend (einmal angeschaut, überall weg).

### Geändert

- **ChurchTools-Änderungen erscheinen zeitnah (#159):** Verschobene Ablaufpunkte oder geänderte
  Setlists waren bis zu 5 Minuten lang nicht sichtbar. Jetzt lädt die App die aktuellen Daten beim
  nächsten Öffnen / Zurückkehren nach; die Offline-Verfügbarkeit bleibt unverändert.

### Behoben

- **Update während geöffneter App führt nicht mehr zum Fehler-Bildschirm (#151):** Wird ein neues
  Release eingespielt, während die App gerade offen ist, konnte das erste Öffnen einer noch nicht
  geladenen Seite fehlschlagen (die alte Version verwies auf inzwischen ersetzte Dateien) – es
  erschien die Meldung „Die App konnte nicht richtig starten". Jetzt lädt die App in diesem Fall
  einmal automatisch neu und holt sich die aktuelle Version; ein zweites Fehlschlagen führt weiter
  zur verständlichen Meldung (kein endloses Neuladen). Dauert ein Nachladen ungewöhnlich lange,
  erscheint zusätzlich nach einigen Sekunden ein „Neu laden"-Knopf.

### Sicherheit

- **Datei-Proxy gehärtet (#138):** Aus ChurchTools durchgereichte Dateien werden nur noch als
  sichere Typen (PDF, Bilder, Klartext) direkt angezeigt; alles andere wird heruntergeladen statt
  ausgeführt. Verhindert, dass eine hochgeladene HTML-/Skript-Datei im App-Kontext läuft.
- **Speicher-Obergrenzen für Anmerkungen (#139):** Pro Konto gelten jetzt großzügige Höchstgrenzen
  (Anzahl + Gesamtgröße), und der Server-Zwischenspeicher ist gedeckelt – schützt Server-Speicher
  vor Missbrauch. Im Alltag nicht spürbar.

## [2.10.0] – 2026-07-13

### Geändert

- **Deutlich schnellerer Erststart (#142):** Die App lädt beim Start nur noch das Nötigste
  (Anmeldung + Terminliste, ~69 kB statt ~863 kB komprimiert). Die schweren Teile – v. a. die
  Chart-Anzeige mit dem PDF-Renderer – kommen erst beim ersten Öffnen nach (kurzer Lade-Moment,
  einmalig). Alle nachgeladenen Teile stecken weiter im Offline-Vorrat der installierten App:
  Einmal online geöffnet, funktioniert alles wie gehabt auch ohne Netz. Spürbar vor allem im
  langsamen Kirchen-WLAN.
- **Intern: Anmerkungs-Typen zu einer Quelle zusammengeführt (#137):** Die Datenform der
  Anmerkungen (Striche/Texte/Zoom) war an vier Stellen getrennt definiert und auf dem Server
  bereits veraltet (Format-Felder fehlten). Jetzt gibt es genau eine Definition in `shared/types`,
  und ein Compile-Wächter bricht den Build, falls Server-Prüfung und Typ je wieder
  auseinanderlaufen – Anmerkungsfelder können damit nicht mehr stillschweigend beim Speichern
  verloren gehen (die Bug-Klasse hinter #115). Keine sichtbare Änderung in der App.

### Behoben

- **Hängende ChurchTools-Anmeldung führt nicht mehr in die „Erneut versuchen"-Sackgasse (#149):**
  Liefert ChurchTools minutenlang leere Berechtigungen (realer Vorfall am 13.07.), überbrückt der
  Rechte-Speicher das jetzt zuverlässig – er kennt das Konto neuerdings direkt aus der Anmeldung
  und ist nicht mehr auf eine zweite ChurchTools-Abfrage angewiesen. Ist die ChurchTools-Sitzung
  wirklich unbrauchbar, führt die App automatisch zur Anmeldung, statt vergebliche „Erneut
  versuchen"-Knöpfe zu zeigen. Greift vollständig ab der ersten Neuanmeldung nach dem Update.

### Sicherheit

- **Feinschliff (#146, Teil 1):** Anmeldefelder längenbegrenzt; die öffentliche Konfigurations-
  Abfrage (Login-Screen) verrät keine internen Gruppen-/Rollen-Zuordnungen mehr; die
  Update-Prüfung fragt GitHub bei Netzwerkfehlern nicht mehr ungebremst an.

## [2.9.1] – 2026-07-10

### Behoben

- **Rechte-Änderungen greifen ohne Ab-/Neuanmelden:** Die Berechtigungen wurden auf dem Gerät bis
  zu 30 Minuten zwischengespeichert. Gab der Admin z. B. die Team-Notizen frei, sahen die anderen
  das erst nach langem Warten oder erst nach Abmelden/Neuanmelden. Jetzt wird der gespeicherte Stand
  zwar sofort angezeigt (kein Flackern), aber bei jedem App-Start frisch geprüft – geänderte Rechte
  erscheinen damit schon beim nächsten Neuladen.

## [2.9.0] – 2026-07-10

### Hinzugefügt

- **Team-Notizen (#124):** Anmerkungen bleiben persönlich – aber wer mag, **teilt** sie mit dem
  Team („Mehr → Team-Notizen → Meine Anmerkungen teilen"). Berechtigte wählen im Lied über den
  Personen-Knopf **„Notizen von …"** eine Person und dann eine ihrer Ebenen (Version +
  Darstellungsart, nur solche mit Anmerkungen) und sehen sie **schreibgeschützt in der Ansicht
  dieser Person** (Spalten, Schrift, Version), damit alles an der richtigen Stelle sitzt. Eine
  Leiste bietet **Ansehen / Zusammenführen / Ersetzen** mit **Live-Vorschau** direkt im Chart;
  erst **„Übernehmen"** kopiert die Anmerkungen in die eigenen (bei „Zusammenführen" zusätzlich zu
  den vorhandenen), zusammen mit der Ansicht dieser Ebene – die eigene Tonart bleibt. Wer
  Team-Notizen nutzen darf, legt der Admin unter „Mehr → Verwaltung → Anmerkungen" fest:
  **Gruppen-Zuweisung** (ChurchTools-Gruppen) + **Rollen-Zuweisung** (freigegebene Rollen je
  Gruppe; nichts angehakt = niemand). Die geführte Einführung der Chart-Ansicht wurde um den
  Schritt „Notizen von anderen" ergänzt.
- **Eigene Anmerkungen je Darstellungsart:** „Akkorde & Text" und „Nur Text" haben jetzt getrennte
  Anmerkungen (und eigenen Zoom) – beim Umschalten verrutscht nichts mehr. Bestehende Anmerkungen
  gelten als „Akkorde & Text". Im Lied-Menü zeigt ein kleines Stift-Symbol, welche Versionen und
  Darstellungsarten eigene Anmerkungen haben.
- **Anmerkungsleiste beweglich:** Die Werkzeugleiste lässt sich am Griff senkrecht verschieben und
  über den Pfeil zu einem kleinen Rand-Knopf einklappen (Position und Zustand bleiben pro Gerät
  erhalten).

### Behoben

- **Zoom bleibt nicht mehr in einer Hälfte stecken** beim Wechsel Hochformat ↔ Querformat oder nach
  dem Zurückkehren aus einer anderen App.
- **Anmerkungen auf der inaktiven Chart-Hälfte** (Querformat) lassen sich nicht mehr versehentlich
  auswählen oder bearbeiten – ein Tipp aktiviert dort nur die Seite.

## [2.8.1] – 2026-07-09

### Behoben

- **Kein fälschliches „keine Berechtigung" mehr bei ChurchTools-Aussetzern:** ChurchTools liefert
  gelegentlich für ein paar Sekunden leere Rechte zurück (während es die Berechtigungen einer
  Sitzung neu berechnet), obwohl der Nutzer normal berechtigt ist. Bisher sah man in diesem Moment
  den Hinweis „keine Berechtigung" bzw. musste die Seite mehrfach neu laden. Der Server merkt sich
  jetzt pro Konto die zuletzt gültigen Rechte und liefert sie während eines solchen Aussetzers aus –
  der Nutzer merkt nichts mehr davon. Ein dauerhaftes „keine Berechtigung" wird bewusst nie gemerkt,
  damit tatsächlich Nicht-Berechtigte weiterhin korrekt den Hinweis sehen. Die Rechte werden auf dem
  Daten-Volume abgelegt (überstehen Updates) und gelten bis zu 30 Tage als vertrauenswürdig.

## [2.8.0] – 2026-07-08

### Hinzugefügt

- **Hilfe „Als App installieren":** Der Mehr-Tab erklärt jetzt passend zum Gerät, wie man die App
  auf den Startbildschirm legt – auf iPhone/iPad („Teilen → Zum Home-Bildschirm"), auf dem Mac
  („Teilen → Zum Dock hinzufügen") und auf Android; unter Chrome/Edge erscheint ein echter
  „Installieren"-Knopf. Der Hinweis verschwindet, sobald die App bereits installiert läuft.

### Geändert

- **Deploy robuster gegen Datenverlust:** Die Compose-Dateien setzen den Projektnamen jetzt fest
  (`name:`). Damit bleibt das Daten-Volume (Gemeindename, Links, Anmerkungen) auch dann erhalten,
  wenn beim Aktualisieren im Container Manager versehentlich ein abweichender Projektname entsteht.
  (Hintergrund: Ein einmalig falsch benanntes Projekt hatte am 08.07. dazu geführt, dass die App
  ein leeres Volume einhängte und Werkseinstellungen zeigte – die Daten waren nie verloren.)

## [2.7.2] – 2026-07-08

### Sicherheit

- **Session-Cookie in Produktion nur über HTTPS:** In der Produktiv-Konfiguration trägt das
  Anmelde-Cookie jetzt das `Secure`-Flag und geht damit nie über eine unverschlüsselte Verbindung.
  (#45)
- **Restriktive Content-Security-Policy in Produktion:** Statt die CSP komplett abzuschalten gilt
  jetzt eine enge Richtlinie (nur eigene Quellen, kein eingeschleustes Fremd-Script; pdf.js-Worker
  und Anmerkungs-Bilder ausdrücklich erlaubt). Im reinen LAN-HTTP-Betrieb bleibt die App voll
  nutzbar. Zusätzliche Schutzschicht gegen Cross-Site-Scripting. (#47)

### Behoben

- **Neutraler Marker für bearbeitete Lieder:** Von der App gespeicherte Songversionen tragen jetzt
  den Zusatz „(App)" statt des gemeindespezifischen „(ECG)". Bestehende „(ECG)"-Dateien (und die
  ganz alten „— Bearbeitet"/„— ECG") werden weiterhin erkannt – es geht nichts verloren. (#34)
- **Einseitige Lieder mittig:** Ein Lied/Ablauf mit nur einer Seite wird im Querformat jetzt über
  die volle Breite zentriert statt links neben einer leeren Fläche angezeigt. (#128)

### Geändert

- **Direkt nachnutzbar für andere Gemeinden:** Die Produktiv- und Test-Compose-Dateien wurden von
  gemeindespezifischen Namen befreit (generische Container-/Watchtower-Namen), und die
  Installationsanleitung erklärt jetzt die drei Betriebs-Varianten (Basis / Produktiv / Test).
  Bestehende Instanzen behalten ihr Daten-Volume ohne Migration. (#35)

## [2.7.1] – 2026-07-07

### Sicherheit

- **Abmelden räumt jetzt vollständig auf:** Beim Logout wird auch die dahinterliegende
  ChurchTools-Sitzung serverseitig beendet (vorher blieb sie bis zu ihrem eigenen Ablauf gültig),
  und alle auf dem Gerät zwischengespeicherten Konto-Daten werden entfernt – Offline-Vorrat
  (Abläufe, Lieder, PDFs), lokale Anmerkungs-/Einstellungs-Caches. Wichtig für geteilte
  Gemeinde-Geräte: Der nächste Nutzer sieht keine Daten des vorherigen. Geräte-Einstellungen
  (z. B. „Einführung gesehen") bleiben erhalten.
- **Anmeldung läuft nach spätestens 90 Tagen ab:** Die automatische Verlängerung bei Nutzung
  verlängert nicht mehr unbegrenzt – 90 Tage nach dem Login ist eine Neuanmeldung nötig.
  Bestehende Anmeldungen bleiben beim Update erhalten (Frist zählt ab jetzt).

## [2.7.0] – 2026-07-07

### Hinzugefügt

- **Geführte Einführung für neue Nutzer:** Beim ersten Mal erklären kleine Hinweisblasen direkt am
  jeweiligen Knopf, was wofür da ist – in den Terminen (Terminliste, Liedblätter öffnen,
  Offline-Symbol, Bereiche), in der Ablauf-Ansicht (Lied öffnen, als PDF teilen, bearbeiten) samt
  Bearbeiten-Modus (Sortieren, Punkt bearbeiten, Hinzufügen) und in der Liedansicht (Blättern &
  Zoomen, Lied-Optionen, Darstellung, Anmerkungen). Jederzeit „Überspringen"; im Mehr-Tab lässt
  sich die Einführung erneut starten.

### Geändert

- **Termine-Ansicht aufgeräumt:** Die Liederanzahl steht jetzt als kleine Zahl am Noten-Knopf
  (vorher in der Textzeile abgeschnitten). Das Symbol zum Offline-Speichern ist eine Wolke mit
  Pfeil (statt eines Geräte-Download-Pfeils), passend zur „Wolke mit Haken" für „liegt offline vor".
- **„Vergangene" ohne Netz ausgegraut:** Vergangene Gottesdienste werden live geladen und sind
  offline nicht verfügbar – der Umschalter ist dann ausgegraut und erklärt das per kurzem Hinweis.

## [2.6.0] – 2026-07-06

### Hinzugefügt

- **Offline-Reserve (#32):** Gottesdienste sind im Saal auch ohne Netz verfügbar. Der **nächste**
  Gottesdienst wird automatisch komplett vorgehalten (Ablauf, Charts, PDFs/Bilder – Schalter im
  Mehr-Tab); weitere kommende Gottesdienste lassen sich per **Download-Knopf direkt am Termin**
  offline speichern und werden danach automatisch aktuell gehalten. Ein **Wolken-Symbol am Termin**
  zeigt dauerhaft, was offline bereitliegt. Ohne Netz werden nicht verfügbare Termine und die
  Liedersammlung **ausgegraut** (Tipp erklärt es kurz). Technik: React-Query-Persistenz in
  IndexedDB, Datei-Cache im Service Worker, PDF-Renderer komplett im App-Bundle; Dokumente werden
  als Ganzes geladen statt gestreamt – dadurch öffnen Lieder offline ohne die früheren ~10-Sekunden-
  Hänger. Das App-Logo in der Ecke der Akkord-Blätter ist jetzt fest eingebettet und erscheint
  daher auch offline (vorher fehlte es dort). Grenze: Ohne Netz kein neues Anmelden.
- **Verlässliche Offline-Erkennung & keine Sackgassen (#32):** Die App erkennt „offline" jetzt am
  tatsächlichen Server-Kontakt statt nur an der Netz-Anzeige des Geräts – so greift das Ausgrauen
  auch im Gemeinde-WLAN ohne Internet-/Server-Zugang. Beim Neustart wartet die App, bis der
  Offline-Speicher geladen ist (kein kurzer Anmelde-Bildschirm mehr, der gemerkte Gottesdienst
  bleibt erhalten). Lade- und Fehleransichten haben immer einen Rückweg, und der Anmelde-Bildschirm
  erklärt offline, dass eine Verbindung nötig ist – man bleibt nicht mehr in einer Schleife hängen.
- **Weißer Bildschirm beim Öffnen ohne Netz behoben (#32):** Nach dem kompletten Schließen blieb die
  App beim Wieder-Öffnen ohne Netz manchmal weiß. Ursache war ein „wartender" Hintergrund-Prozess
  (Service Worker), der auf iPad/iPhone beim Kaltstart die App-Hülle nicht auslieferte. Der neue
  Stand aktiviert sich jetzt sofort und zuverlässig – **ohne** die laufende App mitten im
  Gottesdienst neu zu laden. Zusätzliches Sicherheitsnetz: Startet die App einmal nicht, erscheint
  statt eines weißen Bildschirms eine Meldung mit „Neu laden".

### Geändert

- **„Aktualisieren"-Knopf im Lied entfernt:** Der Inhalt (Ablauf/Liedtexte) aktualisiert sich jetzt
  alle 60 Sekunden von selbst – auch wenn das Gerät dauerhaft offen im Lied bleibt. Neu gezeichnet
  wird nur bei echten Änderungen; ohne Netz scheitert das Nachladen lautlos.

## [2.5.2] – 2026-07-06

### Geändert

- **„Nach Updates suchen"-Knopf entfernt:** Er war überflüssig – beim (kompletten) Neu-Öffnen der App
  wird ohnehin automatisch die neueste Version geladen. Die stille Auto-Aktualisierung und der
  Versions-Hinweis bleiben.

### Behoben

- **Normaler Anmerkungs-Text wurde nach kurzer Zeit fett (#115):** Beim Server-Abgleich gingen die
  Format-Angaben (fett/kursiv/unterstrichen/Ausrichtung) verloren, weil sie serverseitig nicht
  gespeichert wurden – beim nächsten Laden wurde normaler Text fälschlich wieder fett. Die Formate
  werden jetzt vollständig mitgespeichert.
- **Gestrichelter Text-Rahmen blieb stehen (#114):** Beim Verlassen des Anmerkungsmodus wird die
  Text-Auswahl jetzt sofort aufgehoben – der Rahmen bleibt nicht mehr bis zum Seitenwechsel sichtbar.
- **Text-Anmerkungen blinkten beim Weiterwischen (#113):** Die Blätter-Animation nutzte einen
  doppelt breiten Schiebe-Streifen, der auf dem iPad (Retina) die maximale GPU-Texturbreite
  überschritt – WebKit zeichnete den Anmerkungs-Text dadurch verzögert (Striche/Seiten sind eigene
  Texturen und waren nicht betroffen), und vorwärts endete die Animation auf einer krummen Position.
  Jetzt werden alte und neue Seite als zwei getrennte, je bildschirmbreite Ebenen geschoben; beide
  Richtungen enden exakt deckungsgleich mit der Live-Ansicht. Zusätzlich: Text-Formatierung im
  Übergang exakt wie live (fett/normal/kursiv/…), Textebene wird beim Seitenwechsel synchron
  zurückgesetzt, Abdeckung steht garantiert vor dem ersten Frame.
- **Altes Lied blitzte bei sehr schnellem Blättern auf:** Startete ein neuer Übergang, während der
  vorherige noch lief (z. B. schnelles Tastatur-Blättern), blieb die alte Seiten-Grafik über der
  neuen liegen. Die Übergangs-Ebenen werden jetzt pro Blättern frisch aufgebaut.

## [2.5.1] – 2026-07-05

### Behoben

- **„Too many requests" im Gemeinde-WLAN behoben:** Das Anfrage-Limit galt versehentlich auch für
  statische Dateien und zählte pro IP – da im Gemeinde-WLAN alle Geräte über eine öffentliche IP
  laufen, teilte sich das ganze Team ein Kontingent und lief beim gemeinsamen Nutzen sofort voll.
  Das Limit greift jetzt nur noch für echte Aktionen und zählt **pro angemeldetem Nutzer**;
  Grenzwerte großzügiger.

## [2.5.0] – 2026-07-05

### Hinzugefügt

- **Update-Hinweis in der App:** Liegt eine neue Version bereit, erscheint ein dezenter Balken
  „Neue Version verfügbar" mit **Jetzt laden** (übernimmt sie sofort) und **Später**. Die App
  sucht dafür aktiv nach Updates – beim Start, bei Rückkehr in den Vordergrund und stündlich.
  Bisher blieben Geräte (v. a. iPhone/iPad-PWA) unbemerkt auf altem Stand hängen; so erreichte
  z. B. der Fix für das „keine Berechtigung"-Schloss die Geräte nie von selbst. Es wird weiterhin
  **nie ungefragt** mitten in der Nutzung neu geladen.
- **„Nach Updates suchen" im Mehr-Tab:** Ein Knopf unter der Versionszeile prüft sofort auf eine
  neue Version und **lädt sie direkt** (kurz „Aktualisiere…", dann neu geladen) bzw. meldet „Du bist
  auf dem neuesten Stand". Verlässlicher Hebel gerade auf dem iPhone, wo die automatische Suche
  beim App-Wechsel manchmal nicht anschlägt.

### Behoben

- **Kopfleiste rutschte beim Sortieren weg (iPhone):** Beim Ziehen eines Ablauf-Punkts mit
  Auto-Scroll verschwand die obere Leiste („‹ Termine" / „✓ Fertig") nach oben und war nur durch
  Drehen des Geräts zurückzuholen. Der Auto-Scroll bleibt jetzt auf die Liste begrenzt und die
  Ansicht wird nach dem Ziehen automatisch zurechtgerückt. (#56)
- **Abgelaufene Sitzung führt jetzt zum Login statt in eine Sackgasse:** War die App-Anmeldung noch
  gültig, die ChurchTools-Sitzung dahinter aber abgelaufen, zeigte die App „Berechtigungen konnten
  nicht geladen werden – Erneut versuchen" – was zwecklos war (nur Neu-Anmelden half). Jetzt erkennt
  die App die abgelaufene Sitzung, meldet automatisch ab und führt direkt zum Login. (#104)

## [2.4.1] – 2026-07-04

### Geändert

- **Spalten & Textgröße geräteübergreifend:** Diese Einstellungen sind jetzt auf allen Geräten
  gleich (über das Konto synchronisiert). Nur der **Zoom** bleibt bewusst pro Gerät getrennt
  (iPad/PC vs. iPhone).
- **Eintrag hinzufügen (Text):** zeigt jetzt dieselben Feld-Überschriften wie das Bearbeiten
  (Titel · Dauer · Zuständig · Bemerkung).
- **Verknüpfung aufheben:** entfernt jetzt auch den Titel (kein zurückbleibender Liedtitel), und
  der Bearbeiten-Dialog bleibt offen – so kann man den Punkt direkt neu benennen.
- **Ladekringel** ist ein weich auslaufender Ring statt eines harten Segments.

### Behoben

- **Sporadisches „keine Berechtigung"-Schloss:** Liefert ChurchTools kurzzeitig leere Rechte
  (ein bekannter Aussetzer, z. B. beim Neu-Laden), versucht die App es jetzt automatisch erneut,
  statt sofort das Schloss zu zeigen. Ein **Admin** bekommt zudem immer Zugriff.

## [2.4.0] – 2026-07-03

### Neu

- **PDFs mitten im Ablauf:** Hochgeladene Lied-PDFs/Bilder sind jetzt Teil des **durchgehenden
  Ablaufs** – man wischt nahtlos über alle Lieder (Akkorde und PDFs gemischt), und im Querformat
  stehen zwei Seiten nebeneinander (auch über Lied-Grenzen). Vorher war eine PDF eine isolierte
  Einzelansicht.
- **Weiche Blätter-Animation:** Beim Blättern schiebt sich die neue Seite horizontal herein (wie
  im Foto-Viewer) – ruhiger Übergang statt hartem Umschalten.
- **Anmerkungen im 2-Seiten-Modus:** Nur die **aktive** Seite ist beschreibbar und hervorgehoben,
  die andere ist ausgegraut und gesperrt; ein Tipp wechselt die aktive Seite (kein versehentliches
  Kritzeln auf der falschen Seite mehr).
- **Text-Anmerkungen direkt auf der Seite:** Antippen setzt einen Cursor genau an der Stelle
  (wie in Word) – lostippen, außerhalb tippen legt den Text fest. Zeilenumbrüche möglich;
  ausgewählten Text verschieben, Größe über einen Ziehknopf ändern (Anzeige in vertrauten „pt");
  ein Tipp auf einen bestehenden Text öffnet ihn direkt zum Bearbeiten.
- **Text formatieren:** Fett, Kursiv, Unterstrichen sowie linksbündig/zentriert/rechtsbündig –
  je Textblock, wirkt live auf den ausgewählten Text bzw. auf den nächsten neuen.
- **Dickere Strichstärken:** Stift, Marker und Radierer bieten zusätzliche, deutlich dickere
  Stufen (Radierer bis „Flächen-Format").
- **Akkorde per 1-Tipp:** Im Editor fügt ein Tipp auf den Grundton den Akkord sofort ein; Zusätze
  (m, 7, maj7, sus4 …) und Bass (Slash-Akkorde wie A/C#) hängen sich direkt an.
- **Staging-Version sichtbar:** Auf der Test-Instanz zeigt der „Mehr"-Tab den Build-Stand
  (`staging-<commit>`), damit man den geladenen Stand erkennt.

### Geändert

- **Zoom-/Blätter-Gesten neu:** **ein Finger blättert, zwei Finger zoomen und verschieben** – auch
  im Zeichenmodus (Zoomen/Verschieben kritzelt nicht mehr ins Dokument; beim Apple Pencil zeichnet
  der Stift, die Finger zoomen). Die „Zurück/Fertig"-Leiste entfällt – ein Pinch zoomt und speichert
  automatisch, Zurücksetzen über den Knopf in der Kopfleiste.
- **Anmerkungs-Werkzeugleiste** aufgeräumt: klare, einheitliche Icons, größere Knöpfe, ein
  Farbknopf mit aufklappender Farbreihe. Vier Farben (Rot, Blau, Grün, Orange) + eigener Farbwähler.
  Alle Werkzeuge einheitlich bedienbar: erster Tipp wählt, zweiter Tipp klappt die Einstellungen
  auf (Strichstärke bzw. Text-Einstellungen als eigener Balken), ein dezenter Punkt-Hinweis am
  aktiven Werkzeug zeigt das an. Die Einstellungen klappen jeweils auf Höhe ihres Werkzeugs auf.
- **Editor** aufgeräumt: kompakter Kopf, moderner Text-Look (proportional statt „Schreibmaschine",
  Akkorde farbig), mehrseitige und scharfe Vorschau.
- Die Fußzeilen-Punkte markieren im Querformat beide sichtbaren Lieder.

### Behoben

- **Zoom bleibt zuverlässig erhalten** – lokal wie serverseitig, über App-Wechsel/Neustart,
  Lied-/Seitenwechsel, Hochformat↔Querformat und das Öffnen/Schließen des Editors; kein
  Zurückspringen zur Mitte mehr, gleiche Seite links wie rechts.
- **Editor-Tastatur** schiebt nicht mehr die ganze Ansicht hoch – nur der Textbereich scrollt.
- **Text-Anmerkung auf dem iPad:** Die Bildschirmtastatur öffnet jetzt zuverlässig und schiebt
  die Ansicht nicht mehr weg – nur der Notenbereich hebt sich so weit, dass der Cursor sichtbar
  bleibt; kein hängender Balken beim Schließen der Tastatur mehr.
- **Sporadisches „keine Berechtigung"-Schloss behoben:** Eine kurzzeitig leere Rechte-Antwort von
  ChurchTools wird jetzt als Aussetzer erkannt und automatisch erneut versucht, statt fälschlich
  „keine Berechtigung für Lieder oder Abläufe" anzuzeigen.
- Einseitige PDF steht im Querformat an der richtigen Stelle (rechts neben dem Vorgänger).

## [2.3.2] – 2026-07-02

### Geändert

- **Länger angemeldet bleiben:** Die Anmeldung gilt jetzt **30 Tage** statt nur 12 Stunden und
  verlängert sich bei jeder Nutzung automatisch (gleitendes Ablaufdatum) – das ständige
  Neu-Anmelden entfällt bei regelmäßiger Nutzung. Hinweis: ChurchTools kann seine eigene Sitzung
  unabhängig davon früher beenden; auf dem iPhone/iPad (Web-App vom Home-Bildschirm) löscht iOS
  Cookies nach etwa 7 Tagen ohne Nutzung – beides liegt außerhalb der App.

## [2.3.1] – 2026-07-02

### Neu

- **Mehr Einstellungen beim Hinzufügen:** Das Fenster „Eintrag hinzufügen" hat für Text-Punkte
  jetzt ein Feld **Dauer (Minuten)** – vorher fehlte es hier.
- **Direkt weiterbearbeiten nach Lied-Hinzufügen:** Sobald ein Lied zum Ablauf hinzugefügt wurde,
  öffnet sich automatisch dessen Bearbeiten-Dialog, sodass Dauer, Zuständige, Bemerkung und die
  Uhrzeit-Anzeige gleich gesetzt werden können.

### Behoben

- **Überschriften im Bearbeiten-Modus wieder bearbeitbar:** Eine Überschrift lässt sich jetzt per
  Antippen (bzw. über den Stift) umbenennen; bisher war sie nur verschiebbar.

### Geändert

- **Optik im Bearbeiten-Modus:** Das unsauber dargestellte Zeichen „⠿" ist durch ein sauberes
  6-Punkte-Griff-Icon ersetzt; die Ziehgriffe sind kräftiger und der Bearbeiten-Stift in
  Akzent-Blau hervorgehoben.

## [2.3.0] – 2026-07-01

### Neu

- **Komfortabler ChordPro-Editor (neu gebaut):** Der Lied-Editor basiert jetzt auf CodeMirror und
  bietet Syntax-Farben (Akkorde blau, Direktiven teal), echtes **Rückgängig/Wiederholen**, sauberes
  Einfügen an der Cursorposition, **Auswahl-Menüs** für Akkorde (Dur/Moll/7) und Formate (deutsch
  beschriftet mit Erklärung), zuletzt genutzte Akkorde, Transponier-Regler und eine **echte
  PDF-Vorschau** („wie gedruckt") mit Umschalter **Editor · Beide · Vorschau** (je nach Fenstergröße). (#37)

### Geändert

- **Editor besser lesbar:** In den Info-Zeilen (`{title: …}`, `{artist: …}`, `{key: …}`) wird nur
  noch das Label dezent teal eingefärbt – der eigentliche Wert (Titel/Artist/Tonart) steht jetzt
  kräftig und gut lesbar in normaler Textfarbe. Liedtext etwas größer und luftiger.
- **Ablauf-Bearbeiten an die Ansicht angeglichen:** Der Bearbeiten-Modus sieht jetzt genauso aus wie
  die normale Ablauf-Ansicht (gleiche Positionen und Höhen) – kein Springen mehr beim Umschalten;
  Ziehgriff in der Zeit-Spalte, Bearbeiten per Stift.
- **Lied-Menü leichter auffindbar:** In der Akkord-Ansicht öffnet jetzt der gesamte Kopf-Bereich
  (Titel samt Tonart/Capo/Version/Tempo) das Lied-Menü – mit deutlich sichtbarem Auslöser, nicht
  mehr nur über den Titel. (#42)
- **Ablauf-Bearbeiten an die Ansicht angeglichen:** Beim Umschalten in den Bearbeiten-Modus bleiben
  Zeilenhöhe und Position gleich (die Uhrzeit-Spalte wird zum Ziehen-Griff, Dauer und Zuständige
  bleiben sichtbar). Lieder sind deutlich hervorgehoben, die Minutenangaben stehen auf einer Linie,
  ein Stift zeigt die Bearbeitbarkeit; Überschriften ohne Uhrzeit.

### Behoben

- Termine am gleichen Tag werden nach Uhrzeit sortiert. (#36)
- Manuell (als Freitext) zugeordnete Zuständige werden im Ablauf angezeigt. (#38)
- Beim Wechsel des Zeichenwerkzeugs schließt eine offene Textbearbeitung. (#39)
- Pinch-Zoom in der Akkord-Ansicht bleibt erhalten und friert beim Drehen (Hoch-/Querformat)
  nicht mehr ein. (#33)

### Behoben

- **Festhängender Zoom in der Akkord-Ansicht (iPad):** Ein reingezoomter Ausschnitt konnte beim
  Drehen bzw. über mehrere Lieder hinweg „kleben" bleiben oder fälschlich für alle Lieder gelten.
  Der Zoom wird jetzt pro Ausrichtung (Hoch-/Querformat) und pro Lied-Seite getrennt gemerkt. (#33)
- **Reihenfolge gleichzeitiger Termine:** Termine bzw. Einträge mit derselben Uhrzeit werden jetzt
  stabil und nachvollziehbar sortiert. (#36)
- **Zuständige als Freitext:** Frei eingetragene Namen (ohne Dienst-Klammern) werden im Ablauf jetzt
  mit angezeigt – nicht nur die über den Dienstplan zugewiesenen Personen. (#38)
- **Textfeld-Werkzeug:** Das Wechseln des Werkzeugs bzw. ein Tipp ins Leere schließt ein offenes
  Textfeld jetzt sauber und legt kein ungewolltes neues Feld an. (#39)

### Intern

- Anzeige- und Zustandslogik von `App` und `ChordChart` in eigene Hooks ausgelagert
  (`useAppNav`/`navStorage`, `useChartNavigation`, `useChartEditor`), tote Kopf-Styles entfernt –
  reine Wartbarkeit, ohne Funktionsänderung.
- GitHub-Actions auf Node-24-fähige Versionen gehoben (beseitigt die Node-20-Abkündigungswarnung).
- Die geplante **Offline-Reserve** (Issue #32) wurde bewusst wieder aus `main` herausgetrennt und
  liegt separat auf einem eigenen Branch – auf iPad noch nicht zuverlässig; wird später fortgesetzt.

## [2.2.0] – 2026-06-30

Großes Aufräum-, Verteilungs- und Härtungs-Release.

### Neu

- **Setup per Doppelklick** für andere Gemeinden: `deploy/setup.command` (macOS/Linux) und
  `deploy/setup.bat` (Windows) – prüfen Docker, fragen die ChurchTools-URL ab, erzeugen das
  Session-Secret und starten die App.
- **Update per Doppelklick:** neue Skripte `deploy/update.command` / `deploy/update.bat`
  (Daten bleiben erhalten).
- **Hilfeseite** `docs/betrieb/troubleshooting.md` mit Schritt-für-Schritt-Lösungen für die
  häufigsten Stolpersteine.
- **Update-Hinweis in der App:** Im „Mehr"-Tab erscheint dezent ein Hinweis, sobald eine neuere
  Version verfügbar ist – mit Link zu „Was ist neu". Quelle ist die neueste GitHub-Release-Note
  (serverseitig gecacht); jeder Release-Tag erzeugt nun automatisch ein GitHub Release.

### Geändert

- **Dokumentation & Repo-Struktur aufgeräumt:** Der Projekt-Root enthält nur noch das Nötigste
  (`README`, `INSTALL`, `UPDATE`, `CHANGELOG`, `LICENSE`, `CLAUDE.md`); die übrige Doku ist jetzt
  nach `docs/betrieb/`, `docs/entwicklung/` und `docs/archiv/` einsortiert.
- **Veraltete Doku-Inhalte korrigiert:** öffentliches Repo + MIT-Lizenz (statt „privat/proprietär"),
  White-Label als verworfen markiert, Doppelungen entfernt (Changelog und Backend-API jeweils nur noch
  an einer Stelle) und tote Verweise (gelöschte `WHITE-LABEL.md`) bereinigt.
- **Installation robuster:** Setup-Skripte unterscheiden „Docker nicht installiert" vs. „nicht
  gestartet", prüfen Compose v2 und halten das Fenster bei Fehlern offen; `INSTALL.md` erklärt den
  Doppelklick-Weg inkl. macOS-Gatekeeper- und Windows-SmartScreen-Hinweis.
- **Update-Strategie überarbeitet:** Releases tragen jetzt auch einen Major-Tag (`:2`); Gemeinde- und
  Prod-Instanz sind auf `:2` gepinnt (sichere Updates, kein ungewollter v3-Sprung). Das veraltete
  `containrrr/watchtower` wurde abgelöst – die Test-Instanz nutzt den gepflegten Fork
  `nickfedor/watchtower`, die Prod-Instanz aktualisiert bewusst (Hinweis künftig über das In-App-Banner).
- **Container-Healthcheck** im Docker-Image: Docker/Container-Manager erkennt jetzt, ob die App
  wirklich antwortet (prüft `/api/health`).
- **Automatische Tests für die ChurchTools-Anbindung** ergänzt (39 zusätzliche Server-Tests):
  Versions-Erkennung, Uhrzeit-Ausblenden, Zuständige, Zeitzonen-Umrechnung u. a. – fängt Fehler
  bei künftigen Änderungen früh ab, statt erst im Gottesdienst.

### Sicherheit

- **App läuft im Container jetzt als unprivilegierter Benutzer** (statt als root): zusätzliche
  Schutzschicht. Ein Entrypoint übereignet das Daten-Volume beim Start automatisch – auch
  bestehende Instanzen funktionieren ohne manuellen Eingriff weiter.
- **`SESSION_SECRET` ist in Produktion jetzt Pflicht** – kein unsicherer Fallback mehr (sonst wären
  die signierten Login-Cookies fälschbar). In der Entwicklung bleibt ein Komfort-Default.
- **Neues Flag `COOKIE_SECURE`** (Standard aus): Wer ausschließlich über HTTPS läuft (Reverse
  Proxy/Cloudflare), setzt es auf `true` und liefert das Login-Cookie dann nur noch über HTTPS aus.
  Im reinen LAN-HTTP-Betrieb bleibt es aus (unverändertes Verhalten).

## [2.1.7] – 2026-06-26

### Geändert

- **Bearbeiten-Hinweis** im Ablauf-Bearbeiten-Modus präzisiert: „Ziehen zum Sortieren · Eintrag antippen zum Bearbeiten" (vorher „Punkt …").

## [2.1.6] – 2026-06-26

### Neu

- **Neue Ablauf-Ansicht** in der Setlist (ersetzt die reine Lied-Liste): zeigt den kompletten Gottesdienst-Ablauf wie in ChurchTools – aufgeräumt mit Uhrzeit, Dauer je Punkt, Notizen und Zuständigen, auch Nicht-Lied-Positionen. Lieder darin sind antippbar und führen direkt zu den Charts.
- **Liederheft direkt aus der Terminübersicht:** Jede Termin-Karte hat (wenn Lieder vorhanden) rechts einen Noten-Button, der sofort die Lieder-Charts des Gottesdienstes öffnet – ohne Umweg über den Ablauf.
- **Uhrzeit pro Punkt ausblenden** (mit Bearbeiten-Recht): über das Bearbeiten-Fenster eines Punkts lässt sich die Uhrzeit aus-/einblenden (z. B. bei Soundcheck oder wenn mehrere Dinge gleichzeitig laufen) – **echt mit ChurchTools synchronisiert** (das „Auge"), in beide Richtungen. Der Punkt selbst bleibt mit Titel und Dauer erhalten.
- **Dauer pro Punkt bearbeiten** (mit Bearbeiten-Recht): über das Aktionsmenü eines Punkts die Dauer in Minuten setzen – schreibt nach ChurchTools, die Uhrzeiten verschieben sich automatisch.
- **Bemerkung bearbeiten** (mit Bearbeiten-Recht): Notiz/Beschreibung eines Eintrags im Bearbeiten- und Hinzufügen-Fenster setzen (wie „Bemerkung" in ChurchTools); wird im Ablauf angezeigt.

### Geändert

- **Einheitliche Dialoge:** Eintrag bearbeiten/hinzufügen sowie die Einstellungs-Dialoge (Organisation, Links verwalten) erscheinen jetzt als zentrierte Fenster mit allen Feldern auf einen Blick – statt der von unten einfahrenden Schublade. Konsistent und näher an ChurchTools.

### Behoben

- **Versionsanzeige im Mehr-Tab** zeigte fest „v2.0" statt der echten Version. Sie wird jetzt zur Build-Zeit aus dem Git-Tag gesetzt (`VITE_APP_VERSION`, vom CI als Build-Arg) und veraltet damit nicht mehr.

## [2.1.5] – 2026-06-26

### Neu

- **„Kaffee spendieren"-Bereich** im Mehr-Tab **und auf der Login-Seite**: dezente, freiwillige Unterstützung für den ehrenamtlichen Entwickler über PayPal mit vorgewählten Beträgen (1/3/5 €) und freier Eingabe. Bewusst zurückhaltend ganz unten platziert.

## [2.1.4] – 2026-06-26

### Geändert

- **Button „Punkt hinzufügen" → „Eintrag hinzufügen"** im Ablauf-Bearbeiten-Modus (passt besser, da auch Überschriften und Texte hinzugefügt werden).

## [2.1.3] – 2026-06-26

### Behoben

- **Unnötige Lücken bei breiten Akkorden:** Steht ein Akkord über einer kurzen Silbe (z. B. `E/G#`
  über „ler", `C#m` über „An"), wurde bisher immer mindestens die Akkordbreite freigehalten – auch
  wenn das nächste Wort gar keinen Akkord hat. Das erzeugte sichtbare Lücken („An␣␣␣den",
  „Ich␣␣␣glaube"). Jetzt darf ein breiter Akkord über die folgenden akkordlosen Wörter ragen (wie
  in Lead-Sheets üblich); Extra-Platz wird nur erzwungen, wenn direkt danach wieder ein Akkord
  käme – Akkorde überlappen also nie.
- **Einheitlich linksbündige Zeilen:** Zeilen, die im Quelltext nach dem ersten Akkord mit
  Leerzeichen beginnen (`[A]   Ich…`), starteten eingerückt, während andere bündig am Rand
  standen. Jetzt beginnt jede Zeile bündig am linken Rand. Mehrfach-Leerzeichen innerhalb der
  Zeile bleiben unberührt.

## [2.1.2] – 2026-06-26

### Behoben

- **Lücken in der „Akkorde & Text"-Ansicht:** Akkorde, die im Quelltext mit Leerzeichen vor dem
  Wort notiert sind („[C] wort"), landeten auf einem reinen Leerzeichen und wurden auf Akkordbreite
  aufgezogen – das erzeugte eine Lücke, über der der Akkord schwebte. Jetzt sitzt der Akkord bündig
  über dem zugehörigen Wort. Reine Instrumental-Akkorde ohne Text behalten ihren Abstand.
- **„Nur Text"-Ansicht sauber dargestellt:** Bisher wurden nur die Akkorde ausgeblendet, sodass
  Silbentrenner („Va - ter"), akkordbedingte Lücken und Einrückungen stehen blieben. Jetzt wird der
  reine Liedtext als ordentlicher, linksbündiger Fließtext gerendert – Silben werden zusammengeführt
  („Vater"), Mehrfach-Leerzeichen reduziert und Einrückungen entfernt. Die Akkord-Ansicht bleibt
  unverändert.

### Geändert

- **Zoom-Notausgang in die Kopfleiste:** Der Knopf „Zoom zurücksetzen" sitzt jetzt oben in der
  Menüleiste neben „Aa" (statt schwebend über dem Liedtext) und erscheint nur, wenn eine Seite
  reingezoomt ist. Neues Symbol (Lupe mit Rahmen-Ecken) passt zum übrigen Icon-Stil.
- **Seitenzahl nur bei mehrseitigen Liedern:** Die Anzeige unten rechts erscheint in der
  Strom-/Mehrseiten-Ansicht nur noch, wenn das aktuelle Lied mehr als eine Seite hat, und zählt
  lied-bezogen (z. B. „Seite 1 / 2"). Bei einseitigen Liedern entfällt sie – die Pfeile genügen.

## [2.1.1] – 2026-06-25

### Behoben

- **Festhängender Zoom in der Strom-/Mehrseiten-Ansicht (iPad):** Eine reingezoomte Seite konnte
  „kleben" bleiben – besonders, wenn ein gespeicherter Zoom beim Öffnen wiederhergestellt wurde
  (dann gab es keinen sichtbaren Ausweg). Neu erscheint ein Knopf **„Zoom zurücksetzen"**, sobald
  eine Seite vergrößert ist; ein Tipp setzt die Seite auf Normalgröße zurück **und** löscht ihren
  gespeicherten Zoom dauerhaft. Pinch-Zoom und das bewusste Speichern eines Ausschnitts bleiben
  unverändert.

## [2.1.0] – 2026-06-25

### Neu

- **Mehrere benannte Lied-Versionen:** Statt nur „Original/Bearbeitet" lassen sich pro Lied
  beliebig viele benannte Versionen anlegen (z. B. „Akustik", „Jugend"), umschalten, umbenennen
  und löschen. Versionen liegen im ChurchTools-Arrangement und sind für das ganze Team sichtbar.
  Tonart, Kapo, Spalten, Schrift, Abschnitts-Transponierung **und Anmerkungen gelten je Version**.
- **Persönliches Setup pro Konto (geräteübergreifend):** Anmerkungen (Stift/Text), Zoom sowie die
  Lied-Einstellungen werden jetzt am ChurchTools-Konto auf dem Server gespeichert und synchronisiert
  (vorher nur lokal pro Gerät). **Musikalische Einstellungen** (Tonart, Kapo, Abschnitte, gewählte
  Version, Nur-Text, Anzeige) gelten auf allen Geräten gleich. **Display-abhängige Einstellungen**
  (Spalten, Schrift, Zoom) werden **pro Gerätetyp** geteilt – Handy und „Tablet/Computer" getrennt,
  damit z. B. 2 Spalten vom iPad nicht auf dem Handy landen. Aktualisiert sich automatisch (alle
  30 s bzw. beim Zurückkehren zur App); vorhandene Geräte-Daten werden beim ersten Start übernommen.
- **Akkord-Ansicht als PDF (SongSelect-Look):** Jedes Lied wird aus dem ChordPro-Text als
  sauberes PDF erzeugt und angezeigt. Komplett **schwarz** (saubere S/W-Ausdrucke), deutliche
  Abschnitts-Labels (Vers/Refrain), Kopfzeile mit Tonart/Taktart/BPM und dem
  **ChurchTools-Musik-App-Logo oben rechts**. Lange Zeilen werden umbrochen, Abschnitte bleiben
  zusammen, 2-spaltiger Satz ohne Überlappung.
- **Zoom als Modus:** Pinch zum Zoomen, dann **✓ (Fertig) / ✗ (Zurück)** zum Festsetzen der
  Ansicht – danach funktionieren Wischen und Tippen wieder normal. Der Zoom wird **pro Lied-Seite
  dauerhaft gespeichert** (kein blauer Aktiv-Balken im Live-Betrieb).
- **2-Seiten-Querformat-Strom:** Im Querformat laufen zwei Seiten nebeneinander als ein Strom
  über den ganzen Ablauf; jede Seite ist ein eigener Bereich mit eigenem Zoom. Seiten auf leicht
  grauem Grund mit Mittelstreifen (Seitenränder beim Zeichnen sichtbar); eine einzelne Seite ist
  linksbündig, das letzte Lied steht nie allein (rechts, vorheriges links).
- **Volle Anmerkungen pro Lied-Seite:** Stift, Marker (glatter Leuchtstrich), Radierer (Farben
  Schwarz/Rot/Gelb), Textfelder sowie **Rückgängig/Wiederholen** – pro Version gespeichert.
- **Ablauf-Export als PDF** (Teilen-Symbol) – exportiert die Lieder genau wie angezeigt.

### Geändert

- **Viewer-Hintergrund** der Akkord-Ansicht jetzt leicht grau (statt weiß) + dezenter Seitenschatten,
  damit beim Zeichnen die Seitenränder klar erkennbar sind.
- **App-Logo** im PDF eng in die obere rechte Ecke gesetzt (eigene, zugeschnittene Logo-Variante
  ohne transparenten Rand; das App-Icon bleibt unverändert).
- **Auslieferung Test-Instanz:** Auto-Deploy über ein `:staging`-Image (GitHub-CI) + Watchtower auf
  dem NAS – kein manueller Container-Neubau mehr (siehe `deploy/docker-compose.staging.yml`).
- **Wartung:** Build-Werkzeug **Vite auf 8** angehoben (inkl. Vitest 3, `@vitejs/plugin-react`,
  `vite-plugin-pwa`). Behebt die zurückgestellten `npm audit`-Findings in `esbuild` (betrafen nur
  den lokalen Dev-Server, kein Produktivrisiko): von 7 Hinweisen (u. a. „high"/„critical") auf 1
  „low" (Windows-only Dev-Server). Build/Tests (44)/Lint grün. Keine Änderung am App-Verhalten.
- Basis-Image und CI auf **Node 22** (Vite 8 setzt Node ≥ 20.19 voraus).
- Vitest: deprecated `environmentMatchGlobs` entfernt – Komponenten-Tests setzen ihre
  jsdom-Umgebung per `// @vitest-environment`-Docblock.

### Behoben

- **Anmerkungen zuverlässiger:** kein Festhängen mehr (Pointer-Capture, nur Primär-Finger,
  Abbruch-Behandlung); über Textfeldern kann nun mit Stift/Marker gezeichnet werden.
- **Marker** zeichnet wieder einen glatten, gleichmäßigen Leuchtstrich (kein „Gepunktel" mehr).
- **Textfelder:** ließen sich nicht platzieren (Text-Ebene war 0×0) – behoben. Nach dem Eintippen
  ist der Text ausgewählt (Bearbeiten-/Verschieben-Rahmen); ein Klick ins Leere schließt nur das
  Eingabefeld bzw. hebt die Auswahl auf, statt ein neues Feld anzulegen oder den Text zu verschieben.
- **Auto-Auffrischung** überschreibt keine gerade gemachten Anmerkungen/Einstellungen mehr, bevor
  sie hochgeladen sind (Text bleibt stehen, „Alles löschen" wird nicht wieder zurückgeholt).
- **Letztes Lied** im 2-up-Querformat steht jetzt rechts (vorheriges links) statt allein links.
- **„Link hinzufügen"** stürzt nicht mehr ab, wenn die App über HTTP läuft (`crypto.randomUUID`
  nur im sicheren Kontext – Fallback ergänzt).
- Akkord-Seiten füllen im **Hoch- und Querformat** korrekt die Höhe (kein zu kleines Dokument).
- Rand-Tippen überspringt keine zweite Seite mehr; nach Rückkehr in die App stimmt die
  Querformat-Ansicht wieder.
- Liederliste: runder **Hinzufügen-Knopf** statt eckigem Kasten, einheitliche Zeilenhöhen;
  keine ungewollte vertikale Scroll-Bewegung der ganzen WebApp mehr.

## [2.0.1] – 2026-06-22

### Behoben

- **iOS-PWA-Layout (Homescreen/Standalone):** App füllt jetzt zuverlässig den vollen Bildschirm
  in **beiden** Ausrichtungen. Ursachen behoben:
  - `100dvh` aktualisierte sich beim Drehen nicht (Tab-Leiste rutschte im Querformat unter den
    Bildschirm) → App-Höhe wird jetzt aus `window.innerHeight` gesetzt (`--app-h`, mehrfach
    nachgesetzt bei `load`/`pageshow`/rAF) **plus** der unteren Safe-Area, die `innerHeight` im
    Standalone-Modus ausschließt (sonst dunkler Streifen unter der Leiste).
  - Detailansichten (Setlist/Chart) richteten ihr `position:absolute`-Layout am Layout-Viewport
    aus (ohne untere Safe-Area) → `#root` ist jetzt Bezugsrahmen, die Ansichten füllen die volle
    Höhe (kein leerer Balken / dunkler Streifen mehr).
  - Scrollbereiche bekommen unten Platz, damit der letzte Eintrag über den Home-Strich hinaus
    scrollbar ist.
- **Chord-Chart-Footer** springt nicht mehr zwischen 1- und 2-zeiligen „Nächstes Lied"-Titeln
  (feste Mindesthöhe, max. 2 Zeilen) und sitzt mit stabilem Abstand über dem Home-Strich.
- Tab-Leiste: Abstand der Symbole über dem Home-Strich vereinheitlicht und feinjustiert.

## [2.0.0] – 2026-06-19

Erster **öffentlicher** Release, für die Verteilung an andere Gemeinden
(jede Gemeinde betreibt ihre eigene, autarke Instanz desselben Codes).

### Geändert

- **ChurchTools-Look** als feste App-Optik (Tab-Navigation, neue Farb-/Schrift-Tokens,
  Light/Dark). Die frühere White-Label-Idee (Theming pro Gemeinde) ist verworfen.
- **Von ECG entkoppelt:** `CHURCHTOOLS_BASE_URL` ist Pflichtfeld ohne Default (die App
  startet nicht ohne eigene URL), Gemeindename-Default neutral, Titel generisch.
- Feature „bearbeitete Songversion" intern neutral benannt (vorher überall „ECG"); der
  Datei-Suffix heißt jetzt `— Bearbeitet.chordpro`. Alte `— ECG.chordpro`-Dateien werden
  weiterhin erkannt und beim nächsten Speichern automatisch übernommen.

### Hinzugefügt

- **Verteilung per fertigem Image:** automatischer Build bei jedem Versions-Tag
  (`v*`) → Multi-Arch-Image (amd64 **und** arm64) nach GHCR.
- End-User-Verteilpaket unter `deploy/` (image-basiertes `docker-compose.yml` + `.env.example`).
- **Frei konfigurierbare Links** (Mehr-Tab + optional Login-Seite), pro Instanz anpassbar.
- **Dokumentation:** `README.md`, `INSTALL.md`, `UPDATE.md` und interne Onboarding-Checkliste.
- **MIT-Lizenz** + Disclaimer (inoffizielles Community-Projekt, nicht mit der ChurchTools GmbH verbunden).

## [1.0.0] – 2026-06-18

- Internes/privates Release der App (Setlist aus ChurchTools, Auto-Transponierung,
  ChordPro-Editor, Dokumenten-Viewer, rechtebewusste UI). Produktiv für die ECG Donrath.
