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

1. Unten auf **Lieder** tippen.
2. Oben einen Teil eines Liedtitels eintippen (drei, vier Buchstaben).
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

### TF-LIB-03 · Neues Lied anlegen (CCLI und selbst eingetippt)

**Das brauchst du:** Ein Konto, das in ChurchTools Lieder bearbeiten darf. **Achtung: Dieser Test
legt echte Lieder in ChurchTools an** – auch von der Test-Instanz aus, denn beide sprechen dieselbe
ChurchTools-Instanz. Räum sie hinterher in ChurchTools wieder weg; die App kann keine Lieder löschen.

**Das muss passieren:** Das Lied steht in ChurchTools mit Kategorie, Autor, CCLI-Nummer, Copyright
und einem **Standard-Arrangement** in der gewählten Tonart. Beim CCLI-Weg hängt am Arrangement auch
gleich das **Notenblatt** – die App zeigt danach Akkorde, ohne dass man etwas hochladen muss.

1. Unten auf **Lieder** tippen, dann rechts unter der Suche auf **„Neues Lied"**.
2. **Bei CCLI suchen**, einen Titel eintippen (mindestens drei Zeichen) und **Suchen** drücken.
3. Einen Treffer antippen. Prüfen: Titel, Autoren, Nummer und Tonart stehen im Formular, das
   Copyright erscheint einen Moment später.
4. **Ohne Kategorie** prüfen, dass „Lied anlegen" **gesperrt** ist. Dann eine Kategorie antippen.
5. **Lied anlegen** – und in der Erfolgsansicht **Lied öffnen** wählen. Das Blatt muss Akkorde zeigen.
6. In ChurchTools nachsehen: Kategorie, Autor, CCLI, Copyright, Arrangement, Notenblatt.
7. Noch einmal **+**, diesmal **Selbst eintippen**: nur Name und Kategorie füllen, anlegen. Das Lied
   entsteht ohne Notenblatt – das ist richtig.
8. Einen Namen eintippen, den es schon gibt: Es muss eine **Warnung** erscheinen, das Anlegen aber
   erlaubt bleiben.
9. Dasselbe mit einer **CCLI-Nummer, die es schon gibt**: Hier muss der Server **ablehnen** und sagen,
   welches Lied sie schon hat.
10. Zum Schluss den Ablauf-Weg: Test-Termin öffnen → **Bearbeiten** → **Hinzufügen** → **Lied** →
    **Neues Lied anlegen …**. Danach muss das Lied im Ablauf stehen – genau einmal.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/NewSongSheet.tsx`, `client/src/hooks/useNeuesLied.ts`, `client/src/utils/liedFormular.ts`, `client/src/pages/AllSongs.tsx`, `client/src/components/AddItemSheet.tsx`, `server/src/services/songVerwaltung.ts`, `server/src/services/ctSongCategories.ts`
- **Automatisiert:** teilweise – `client/src/utils/liedFormular.test.ts`, `client/src/hooks/useNeuesLied.test.tsx`, `client/src/components/NewSongSheet.test.tsx`, `server/src/services/songVerwaltung.test.ts`; von Hand bleibt das Zusammenspiel mit ChurchTools und CCLI
- **Historie:** #322

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
