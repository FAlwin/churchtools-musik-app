# Team-Notizen, Lieder-Suche, eigene Versionen, Verwaltung

### TF-TEAM-01 · Notizen von anderen ansehen und übernehmen

**Das brauchst du:** Zwei Konten. Das zweite hat bei einem Lied seine Notizen geteilt (unter
**Mehr → Team-Notizen**). Dein Konto braucht das Recht, Team-Notizen zu sehen.

**Das muss passieren:** In Schritt 3 siehst du **deren** Notizen, deine eigenen sind ausgeblendet.
In Schritt 4 liegen beide übereinander. Nach Schritt 5 ist deren Version aktiv und deren Spalten
und Schriftgröße übernommen – **deine Tonart und dein Kapo bleiben aber deine**.

1. Das Lied öffnen.
2. Oben rechts auf das **Personen-Symbol** tippen („Notizen von anderen ansehen").
3. Die Person auswählen und hinschauen.
4. **Zusammenführen** einschalten und hinschauen.
5. **Übernehmen** tippen.
6. Oben auf den Liedtitel tippen und Tonart und Kapo prüfen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/useTeamNotesImport.ts`, `client/src/services/teamNotes.ts`, `client/src/components/PageTextLayer.tsx`, `client/src/utils/annotationKeys.ts`, `client/src/utils/strokes.ts`, `client/src/components/ChartTeamNotesBars.tsx`
- **Automatisiert:** teilweise – `client/src/services/annotations.keys.test.ts`, `client/src/utils/strokes.test.ts`
- **Historie:** #124

</details>

### TF-TEAM-02 · Ohne Berechtigung keine fremden Notizen

**Das brauchst du:** Ein Konto **ohne** das Team-Notizen-Recht.

**Das muss passieren:** Das Personen-Symbol ist **gar nicht da**. Keine Fehlermeldung, kein leeres
Menü.

1. Mit diesem Konto anmelden.
2. Ein Lied öffnen, bei dem jemand Notizen geteilt hat.
3. Die obere Leiste ansehen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `server/src/services/ctCapabilities.ts`, `server/src/controllers/teamNotesController.ts`, `client/src/pages/ChordChart.tsx`, `client/src/utils/chartPageKeys.ts`
- **Automatisiert:** teilweise – `server/src/services/churchtools.capabilities.test.ts`
- **Historie:** #149, #152

</details>

### TF-LIB-01 · Lieder suchen und filtern

**Das muss passieren:** Die Suche findet auch bei einem Wortteil. Der Filter macht die Liste kürzer.
Beim Lied stehen das letzte Spieldatum und wie oft es gespielt wurde – **künftige** Termine zählen
dabei nicht mit.

1. Unten auf **Lieder** tippen – über der Liste steht nur das Suchfeld (das ist der Anfang).
2. Oben einen Teil eines Liedtitels eintippen (drei, vier Buchstaben). Prüfen: Lieder, die das Wort im
   **Titel** haben, stehen **vor** denen, die es nur im Autor tragen (bei „A–Z").
3. Den Zeitraum-Filter umstellen, z. B. auf **letzte 12 Monate**.
4. Ein Lied antippen, das kürzlich im Gottesdienst war.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/pages/AllSongs.tsx`, `client/src/utils/songFilter.ts`, `client/src/components/SongStatsBar.tsx`, `server/src/services/setlistBuilder.ts`
- **Automatisiert:** teilweise – `client/src/utils/songFilter.test.ts`, `server/src/services/songUsage.test.ts`
- **Historie:** #157, #158

</details>

### TF-LIB-02 · Lied direkt zum Ablauf hinzufügen

**Das brauchst du:** Einen **Test-Termin**.

**Das muss passieren:** Der Punkt steht an der gewählten Stelle, und in ChurchTools ist es ein
richtiger **Lied-Punkt** mit Arrangement – kein reiner Text-Punkt.

1. Unten auf **Lieder** tippen und ein Lied suchen.
2. Das Lied antippen und **Zum Ablauf hinzufügen** wählen.
3. Den Test-Termin und eine Position auswählen.
4. Bestätigen.
5. In ChurchTools den Ablauf öffnen und den neuen Punkt ansehen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/AddToAgendaSheet.tsx`, `client/src/pages/AllSongs.tsx`, `server/src/services/agendaPayload.ts`
- **Automatisiert:** teilweise – `server/src/services/agendaPayload.test.ts`
- **Historie:** #15

</details>

### TF-LIB-05 · Im Liedtext suchen

**Das brauchst du:** Ein Wort, das du in einem Liedtext kennst und das **nicht** im Titel vorkommt.

**Das muss passieren:** Das Lied wird gefunden, und die Zeile mit dem Wort steht darunter. Beim ersten
Mal dauert es ein paar Sekunden (die App holt dafür jeden Liedtext einmal), danach ist es sofort da.

1. Unten auf **Lieder** tippen und das Wort eingeben – die Liste zeigt vermutlich keine Treffer.
2. Unter der leeren Liste **„Auch in den Liedtexten nach … suchen"** antippen. Das Angebot verschwindet,
   darunter erscheinen die Treffer als eigene Gruppe („N Lieder mit … im Text").
3. Warten: Es muss ein Hinweis erscheinen, dass die Liedtexte durchsucht werden.
4. Die Trefferliste ansehen: Liedname und darunter der **Textausschnitt** mit dem Wort.
5. Einen Treffer antippen – das Lied öffnet sich wie aus der normalen Liste.
6. Dasselbe Wort erneut suchen: Jetzt muss die Antwort **sofort** kommen (der Bestand ist vorgehalten).
7. Ein Wort suchen, das **nirgends** vorkommt: Es muss dastehen, dass es auch in den Texten nicht steht –
   nicht einfach eine leere Liste.
8. Das Feld **leeren** und nur **zwei** Zeichen eintippen: Das Angebot „Auch in den Liedtexten …" darf
   **nicht** erscheinen – und **nichts geladen werden.** Das ist der teure Fall: Erst ab dem dritten
   Zeichen gibt es das Angebot, und erst der Tipp darauf baut den Index.
9. Ein Zeichen im Suchfeld ändern, während Treffer zu sehen sind: Die Gruppe verschwindet, das Angebot
   ist wieder da – Treffer gelten nur für den Begriff, für den sie geholt wurden.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `server/src/services/songTextIndex.ts`, `server/src/services/gebuendelterLauf.ts`, `server/src/services/mapLimit.ts`, `client/src/components/LiedtextTrefferListe.tsx`, `client/src/hooks/useLiedSuche.ts`, `client/src/pages/AllSongs.tsx`, `client/src/hooks/useServices.ts`
- **Automatisiert:** teilweise – `server/src/services/songTextIndex.test.ts` (Akkorde ersatzlos entfernen, ein Aufbau bei fünf Suchen, Drosselung), `server/src/services/gebuendelterLauf.test.ts`, `client/src/hooks/useLiedSuche.test.ts` (Schwelle und dass ein Reiterwechsel allein nichts auslöst), `client/src/components/LiedtextTrefferListe.test.tsx`; von Hand bleibt das Zusammenspiel mit ChurchTools und die Wartezeit beim ersten Aufbau
- **Historie:** #322, #378

</details>

### TF-LIB-03 · Neues Lied anlegen (CCLI und selbst eingetippt)

**Das brauchst du:** Ein Konto, das in ChurchTools Lieder bearbeiten darf. **Achtung: Dieser Test
legt echte Lieder in ChurchTools an** – auch von der Test-Instanz aus, denn beide sprechen dieselbe
ChurchTools-Instanz. Räum sie hinterher in ChurchTools wieder weg; die App kann keine Lieder löschen.

**Das muss passieren:** Das Lied steht in ChurchTools mit Kategorie, Autor, CCLI-Nummer, Copyright
und einem **Standard-Arrangement** in der gewählten Tonart. Beim CCLI-Weg hängt am Arrangement auch
gleich das **Notenblatt** – die App zeigt danach Akkorde, ohne dass man etwas hochladen muss.

1. Test-Termin öffnen → **Bearbeiten** → **Hinzufügen** → **Lied**. SongSelect gibt es **nur hier**
   (und nur mit SongSelect-Lizenz) – nicht im Liederheft, nicht beim Verknüpfen.
2. Einen Titel eintippen, den es bei euch **nicht** gibt (mindestens drei Zeichen): Die Bibliothek zeigt
   „Keine Treffer", und kurz nachdem du aufhörst zu tippen, erscheint **von selbst** die Gruppe
   **„SongSelect · N Treffer zu …"** – ohne Knopfdruck. Achte darauf, dass sie nicht bei jedem Buchstaben
   neu lädt. Gibt es das Wort bei euch doch, steht stattdessen **„Bei SongSelect nach … suchen"** unter
   den Treffern – antippen. Dann dasselbe mit einer **CCLI-Nummer** (7 Ziffern): genau ein Treffer. Eine
   kürzere Nummer läuft nicht von selbst, nur über das Angebot. Eine erfundene Nummer muss den Hinweis
   bringen, dass man auch den Titel eintippen kann.
3. Einen Treffer antippen: erst die **Vorschau** mit dem Liedtext (TF-LIB-07), darin **„Als neues Lied
   anlegen …"**. **„Neues Lied" öffnet sich gefüllt:** Titel, Autoren, Nummer und Tonart stehen drin, das
   Copyright erscheint einen Moment später.
4. **Ohne Kategorie** prüfen, dass „Lied anlegen" **gesperrt** ist. Dann eine Kategorie antippen.
5. **Lied anlegen** – und in der Erfolgsansicht **Lied öffnen** wählen. Das Blatt muss Akkorde zeigen.
6. In ChurchTools nachsehen: Kategorie, Autor, CCLI, Copyright, Arrangement, Notenblatt.
7. Jetzt der Weg für **eigene** Lieder: im Listenkopf rechts auf **„Neues Lied"**. Es muss **direkt das
   leere Formular** kommen – keine Wahl zwischen zwei Wegen. Nur Name und Kategorie füllen, anlegen. Das
   Lied entsteht ohne Notenblatt – das ist richtig.
8. Einen Namen eintippen, den es schon gibt: Es muss eine **Warnung** erscheinen, das Anlegen aber
   erlaubt bleiben.
9. Dasselbe mit einer **CCLI-Nummer, die es schon gibt**: Hier muss der Server **ablehnen** und sagen,
   welches Lied sie schon hat.
10. Zum Schluss den Ablauf-Weg zu Ende: Nach dem Anlegen aus Schritt 1–5 muss das Lied **im Ablauf**
    stehen – genau einmal. (Das Formular hat vorher gesagt, dass es zusätzlich in den Ablauf eingetragen
    wird.)

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/NewSongSheet.tsx`, `client/src/components/SongPicker.tsx`, `client/src/hooks/useLiedSuche.ts`, `client/src/components/SongSelectTrefferListe.tsx`, `client/src/hooks/useNeuesLied.ts`, `client/src/utils/liedFormular.ts`, `client/src/pages/AllSongs.tsx`, `client/src/components/AddItemSheet.tsx`, `server/src/services/songVerwaltung.ts`, `server/src/services/ctSongCategories.ts`
- **Automatisiert:** teilweise – `client/src/utils/liedFormular.test.ts`, `client/src/hooks/useNeuesLied.test.tsx`, `client/src/components/NewSongSheet.test.tsx`, `client/src/components/SongSelectTrefferListe.test.tsx`, `server/src/services/songVerwaltung.test.ts`; von Hand bleibt das Zusammenspiel mit ChurchTools und CCLI
- **Historie:** #322, #378 (Wegwahl weg, Suche im Einfüge-Dialog)

</details>

### TF-LIB-06 · Ein Suchfeld beim Einfügen – Bibliothek zuerst, SongSelect und Liedtexte darunter

**Das brauchst du:** Einen **Test-Termin** und ein Konto **mit** dem Recht, Lieder zu bearbeiten – wenn
möglich zusätzlich eines **ohne**.

**Das muss passieren:** Es gibt **keinen Umschalter** über der Liste – nur ein Suchfeld. Die Bibliothek
filtert beim Tippen; **unter** den Treffern stehen die Angebote **„Auch in den Liedtexten nach … suchen"**
und **„Bei SongSelect nach … suchen"**. Findet die Bibliothek **nichts**, sucht SongSelect **von selbst**.

1. Test-Termin öffnen → **Bearbeiten** → **Hinzufügen** → **Lied**. Über der Liste steht **nur ein
   Suchfeld** – kein Bibliothek/Liedtexte/SongSelect.
2. Ein Wort tippen, das ein eigenes Lied trifft (z. B. den Anfang eines Titels): Die Bibliothek zeigt
   Treffer. **Darunter** stehen die beiden Angebote. Es darf **keine** SongSelect-Anfrage gelaufen sein –
   keine SongSelect-Treffer, kein Ladehinweis.
3. Auf **„Bei SongSelect nach … suchen"** tippen: Die Treffer erscheinen darunter mit der Überschrift
   **„SongSelect · N Treffer zu …"**. Ein Zeichen im Suchfeld ändern: Die SongSelect-Gruppe verschwindet,
   das Angebot ist wieder da.
4. Ein Wort tippen, das **kein** eigenes Lied trifft (z. B. „Wo ich auch stehe"): Unter „Keine Treffer"
   erscheint **ohne weiteren Tipp** die SongSelect-Gruppe – nach einem kurzen Moment (die Suche wartet, bis
   man aufhört zu tippen).
5. Auf **„Auch in den Liedtexten nach … suchen"** tippen: Die Treffer erscheinen mit dem Ausschnitt um die
   Fundstelle. Die Liedtextsuche läuft **nie** von selbst – auch nicht bei „Keine Treffer".
6. Jetzt der wichtige Unterschied: Im Ablauf einen **vorhandenen** Eintrag antippen → **Lied
   verknüpfen**. Dort gibt es **kein SongSelect** – weder als Angebot noch von selbst (ein neu angelegtes
   Lied könnte in einem vorhandenen Punkt nicht landen). Die Liedtexte gibt es.
7. Unten auf **Lieder** (Liederheft): dasselbe Suchfeld, dieselbe Sortierleiste, **kein SongSelect**.
   Unter einer leeren oder gefüllten Liste steht „Auch in den Liedtexten nach … suchen". Bei **einem**
   Lied muss im Listenkopf **„1 Lied"** stehen, nicht „1 Lieder".
8. Mit einem Konto **ohne** das Recht, Lieder zu bearbeiten: **SongSelect** fehlt überall, „Neues Lied"
   ebenso. **Liedtexte** bleibt – Suchen darf jeder.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/useLiedSuche.ts`, `client/src/components/LiedSucheKopf.tsx`, `client/src/components/SucheAngebot.tsx`, `client/src/components/SongPicker.tsx`, `client/src/pages/AllSongs.tsx`, `client/src/components/AddItemSheet.tsx`, `client/src/components/ItemActionSheet.tsx`
- **Automatisiert:** teilweise – `client/src/hooks/useLiedSuche.test.ts` (SongSelect fragt von selbst NUR bei leerer Bibliothek, nie unter drei Zeichen, nie ohne Lizenz/Anlege-Weg; Angebot schickt sofort; Treffer gelten nur, solange der Begriff steht; Liedtexte nie von selbst), `client/src/components/SongPicker.test.tsx` (Angebot statt Anfrage bei Treffern, automatische Suche bei leerer Bibliothek, kein SongSelect ohne Anlege-Weg, kein Umschalter), `client/src/components/LiedSucheKopf.test.tsx`, `client/src/components/SucheAngebot.test.tsx`, `client/src/utils/songFilter.test.ts` (die Einzahl); von Hand bleibt das Zusammenspiel gegen echtes SongSelect und dass im Liederheft und beim Verknüpfen wirklich kein SongSelect erscheint
- **Historie:** #378 (erster Anlauf Umschalter 14.08.2026, umgebaut nach Rückmeldung Alwin 03.09.2026)

</details>

### TF-LIB-04 · Stammdaten eines Liedes ändern und löschen

**Das brauchst du:** Ein Konto, das in ChurchTools Lieder bearbeiten darf, und ein **Testlied** aus
TF-LIB-03 – **nicht ein echtes Gemeindelied.** Dieser Test schreibt und löscht in ChurchTools.

**Das muss passieren:** Geänderte Felder stehen in ChurchTools – und **die nicht angefassten Felder
stehen unverändert daneben.** Das ist der eigentliche Prüfpunkt: ChurchTools ersetzt beim Speichern
den ganzen Datensatz, und die App muss den Rest bewahren.

1. Ein Lied öffnen, auf den Titel tippen, **„Stammdaten …"** wählen. Prüfen: Alle Felder sind mit dem
   gefüllt, was in ChurchTools steht.
2. **Speichern muss gesperrt sein**, solange nichts geändert ist.
3. Nur den **Namen** ändern und speichern. Danach in ChurchTools nachsehen: Der Name ist neu –
   **Autor, CCLI-Nummer und Copyright stehen unverändert da.**
4. Den **Autor leeren** und speichern. In ChurchTools muss das Feld nun leer sein, die übrigen
   unberührt.
5. Die **Kategorie** wechseln (z. B. auf „Inaktive Songs") und speichern; in ChurchTools prüfen.
6. Eine **CCLI-Nummer eintragen, die ein anderes Lied schon hat**: Das muss abgelehnt werden, mit
   Nennung des anderen Liedes. Die eigene Nummer erneut zu speichern muss dagegen gehen.
7. Zurück im **Liederheft**: den **Stift** in der Liedzeile antippen – dasselbe Blatt, gleicher Ablauf.
8. **Löschen:** unten „Lied löschen …". Die Rückfrage muss die **Folgen** nennen (Arrangements,
   Notenblätter, Dateien, Ablauf). **Abbrechen** darf nichts tun.
9. Nun wirklich löschen. Aus dem geöffneten Lied heraus muss die App die Blatt-Ansicht **verlassen**;
   im Liederheft verschwindet das Lied aus der Liste. In ChurchTools nachsehen: Es ist weg.
10. Zum Schluss mit einem Konto **ohne** das Recht „Lieder bearbeiten" nachsehen: Weder „Stammdaten …"
    im Lied-Menü noch der Stift im Liederheft dürfen erscheinen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/EditSongSheet.tsx`, `client/src/components/SongFields.tsx`, `client/src/utils/liedFormular.ts`, `client/src/components/SongMenu.tsx`, `client/src/pages/AllSongs.tsx`, `server/src/services/songPayload.ts`, `server/src/services/songVerwaltung.ts`, `server/src/services/ctWrite.ts`
- **Automatisiert:** teilweise – `server/src/services/songPayload.test.ts` (Feld-Erhalt!), `server/src/services/songVerwaltung.test.ts`, `client/src/utils/liedFormular.test.ts`, `client/src/components/EditSongSheet.test.tsx`; von Hand bleibt, dass ChurchTools die Felder wirklich behält
- **Historie:** #322

</details>

### TF-VER-01 · Eigene Fassung anlegen, ändern, löschen

**Das brauchst du:** Ein Lied, das du bearbeiten darfst.

**Das muss passieren:** „Akustik" steht zur Auswahl, deine Änderung erscheint im Blatt. In
ChurchTools liegt eine Datei mit erkennbarem Namen („… — Akustik (App).chordpro"). Nach dem Löschen
ist sie weg und die App zeigt wieder das Original.

1. Das Lied öffnen, oben auf den **Liedtitel** tippen.
2. **Neue Version…** wählen und „Akustik" als Namen eintragen.
3. Im Editor eine Textzeile ändern und **Speichern**.
4. Das Blatt ansehen.
5. In ChurchTools beim Lied nachsehen, welche Datei dort liegt.
6. In der App: Liedtitel → Version → „Akustik" umbenennen, dann löschen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/components/ChordEditor.tsx`, `client/src/components/ChordProInput.tsx`, `server/src/services/arrangementFiles.ts`, `server/src/services/setlistBuilder.ts`
- **Automatisiert:** teilweise – `server/src/services/setlistBuilder.test.ts` (Namensgebung)
- **Historie:** #37, #34

</details>

### TF-VER-02 · Tastatur im Editor

**Das brauchst du:** iPhone oder iPad.

**Das muss passieren:** Die Schreibstelle bleibt **über** der Tastatur sichtbar. Nach dem Schließen
sitzt die Ansicht wieder normal.

1. Ein Lied öffnen, Liedtitel antippen, eine eigene Version zum Bearbeiten öffnen.
2. **In die Mitte** des Textes tippen.
3. Fünf, sechs Zeilen eintippen.
4. Schließen und die obere Leiste ansehen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/ChordEditor.tsx`, `client/src/hooks/useOverlayKeyboardInset.ts`
- **Automatisiert:** teilweise – `client/src/hooks/useOverlayKeyboardInset.test.tsx`
- **Historie:** #207

</details>

### TF-VER-03 · Eigene Überschrift für ein Lied setzen

**Das brauchst du:** Ein Lied, das du bearbeiten darfst, und einen Ablaufplan, in dem es vorkommt.

**Das muss passieren:** Die neue Überschrift steht **auf dem Blatt** – und zwar dieselbe, die du in
der Vorschau rechts gesehen hast. Sie steht auch oben in der Kopfzeile und im Ablaufplan.

**Eine Stelle ändert sich absichtlich NICHT:** Unter **Alle Lieder** steht weiter der Name, den das
Lied in ChurchTools trägt. Das ist so gewollt und kein Fehler – die Liste kennt den Liedtext nicht.

1. Das Lied öffnen und oben rechts auf den **Stift** tippen.
2. In der Zeile `{title: …}` die Überschrift ändern, z. B. auf
   `{title: Mottosong AC26 - Auf dich will ich bauen}`.
3. Die **Vorschau rechts** ansehen und dir die Überschrift merken.
4. **Speichern** und zurück zum Blatt.
5. Die Überschrift auf dem Blatt mit der aus Schritt 3 vergleichen – sie muss gleich sein.
6. Oben in die **Kopfzeile** schauen.
7. Zum Ablaufplan des Gottesdienstes wechseln, in dem das Lied vorkommt.
8. Unten auf **Alle Lieder** tippen und das Lied suchen (hier steht der ChurchTools-Name).
9. Zurück in den Editor: die Zeile `{title: …}` ganz löschen und speichern. Jetzt muss überall
   wieder der ChurchTools-Name stehen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/utils/chordPdf.ts`, `client/src/components/PdfPreview.tsx`, `server/src/services/setlistBuilder.ts`, `server/src/services/chordproMeta.ts`
- **Automatisiert:** teilweise – `server/src/services/buildSong.head.test.ts`, `client/src/utils/chordPdf.test.ts` (`chartHead`); von Hand bleibt das Zusammenspiel aus Vorschau, Kopfzeile, Ablaufplan und Bibliothek
- **Historie:** #236

</details>

### TF-ADMIN-01 · Verwaltung nur für Berechtigte

**Das brauchst du:** Ein Konto **ohne** Admin-Recht und eines **mit**.

**Das muss passieren:** Die Verwaltungs-Einstellungen erscheinen **nur** beim Admin. Beim normalen
Konto sind sie gar nicht sichtbar – nicht ausgegraut, sondern weg.

1. Mit dem normalen Konto anmelden, unten auf **Mehr** tippen, ganz durchscrollen.
2. Abmelden, mit dem Admin-Konto anmelden.
3. Wieder **Mehr** öffnen und vergleichen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/pages/Settings.tsx`, `server/src/controllers/siteConfigController.ts`, `server/src/routes/siteConfig.ts`
- **Automatisiert:** teilweise – `server/src/controllers/siteConfigController.trim.test.ts`
- **Historie:** #152

</details>

### TF-ADMIN-02 · Hinweis auf eine neue Version

**Das muss passieren:** Der Hinweis erscheint und lädt auf Tipp neu. Danach steht unter **Mehr** die
neue Versionsnummer.

1. Nach einem Release die App öffnen (oder offen lassen).
2. Auf den Hinweis oben tippen.
3. Unten auf **Mehr** und ganz unten die Versionsnummer ansehen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/hooks/useUpdateCheck.ts`, `client/src/components/UpdateBanner.tsx`, `server/src/services/updateCheck.ts`
- **Automatisiert:** teilweise – `server/src/services/updateCheck.test.ts`
- **Historie:** –

</details>

### TF-LIB-07 · Liedtext-Vorschau vor dem Einfügen

**Das brauchst du:** Einen **Test-Termin**, zwei Lieder mit **gleichem oder ähnlichem Titel** und ein
Lied **ohne** Notenblatt als Gegenprobe. Für Schritt 6 ff. ein Konto mit SongSelect-Lizenz.

**Das muss passieren:** Ein Antippen zeigt **erst den Liedtext**, und darin steht der Knopf zum
Einfügen. Beim Durchsehen der Liste passiert von allein nichts.

1. Test-Termin öffnen → **Bearbeiten** → **Hinzufügen** → **Lied**.
2. Ein Lied **antippen**: Es muss die **Vorschau** kommen – Titel, Autor, Tonart und der Liedtext –
   **und das Lied darf NICHT sofort im Ablauf landen.**
3. In der Vorschau **„Zum Ablauf hinzufügen"**: Jetzt steht es im Ablauf, genau einmal.
4. Erneut **Hinzufügen → Lied**, diesmal den **„+"**-Knopf rechts in der Zeile: Das Lied muss **sofort**
   eingefügt werden, **ohne** Vorschau. Das ist der kurze Weg für den Gottesdienst.
5. Ein Lied **ohne Notenblatt** antippen: Es muss dastehen, dass kein Liedtext vorliegt – und
   **Einfügen muss trotzdem gehen**. Keine leere Fläche, keine Fehlermeldung.
6. Auf **SongSelect** wechseln, einen Titel suchen, einen Treffer **antippen**: Die Vorschau zeigt
   CCLIs Liedtext **mit Abschnitten** („Vers 1", „Chorus 1"), Autoren, **CCLI-Nummer** rechts oben und
   darunter den **CCLI-Lizenzhinweis** („For use solely with the SongSelect Terms of Use …").
   **Der Hinweis MUSS da sein** – CCLI schickt ihn mit dem Text mit.
7. **Zurück** und denselben Treffer **erneut** antippen: Der Text muss **sofort** da sein. Das belegt den
   Zwischenspeicher – ein Lied wird bei CCLI nur **einmal** abgerufen.
8. In der Vorschau **„Als neues Lied anlegen …"**: Es öffnet sich das gefüllte Formular. (Weiter wie in
   TF-LIB-03 – **Achtung, das legt ein echtes Lied in ChurchTools an.**)
9. Zwei gleichnamige Lieder nacheinander in der Vorschau ansehen und am Text erkennen, welches das
   gesuchte ist. Das ist der eigentliche Zweck.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/LiedVorschau.tsx`, `client/src/components/SongPicker.tsx`, `client/src/hooks/useServices.ts`, `server/src/services/ctSongSelect.ts`, `server/src/services/songTextIndex.ts`, `server/src/controllers/setlistController.ts`
- **Automatisiert:** teilweise – `client/src/components/SongPicker.test.tsx` (in der Liste wird NICHT abgefragt, Antippen führt in die Vorschau, „+" fügt sofort ein), `client/src/components/LiedVorschau.test.tsx` (ohne Text bleibt Einfügen möglich, Fehler ≠ „kein Text", der CCLI-Hinweis wird gezeigt), `server/src/services/songTextIndex.test.ts` (Index wird benutzt statt gebaut, genau ein Download); von Hand bleibt das Zusammenspiel mit CCLI und die Frage, ob die Vorschau im Gottesdienst als Umweg stört
- **Historie:** #379 (als Zwischenschritt umgebaut, Rückmeldung Alwin 14.08.2026)

</details>
