# Ablauf bearbeiten

⚠️ **Achtung: Diese Tests ändern echte Daten in ChurchTools.** Bitte an einem Test-Termin
durchführen, nicht am Gottesdienst des kommenden Sonntags.

In den Bearbeiten-Modus kommst du so: **Termin öffnen → oben rechts auf Bearbeiten tippen.**

### TF-EDIT-01 · Lied verknüpfen und wieder lösen

**Das brauchst du:** Einen **Test-Termin** mit einem Punkt, an dem noch kein Lied hängt.

**Das muss passieren:** In ChurchTools ist der Punkt danach ein richtiger **Lied-Punkt** mit
Arrangement – er darf nicht zu einem einfachen Text-Punkt geworden sein.

Das ist der heikelste Schreibvorgang der App: Wird ein Lied-Punkt versehentlich zu Text
herabgestuft, lässt sich das **in ChurchTools nicht rückgängig machen**. Deshalb steht dieser Fall
bei jedem Testlauf mit dabei.

1. Test-Termin öffnen, oben rechts **Bearbeiten**.
2. Den Punkt ohne Lied antippen – der Dialog **Eintrag bearbeiten** geht auf.
3. Auf **Lied verknüpfen** tippen.
4. Einen Liedtitel eintippen und einen Treffer antippen.
5. **Speichern**.
6. In ChurchTools im Browser denselben Ablauf öffnen und den Punkt ansehen.
7. Zurück in der App: den Punkt wieder antippen → **Verknüpfung aufheben** → **Speichern**.
8. Nochmal in ChurchTools nachsehen.

<details><summary>Technisches</summary>

- **Priorität:** kritisch
- **Betrifft:** `server/src/services/agendaPayload.ts`, `server/src/services/churchtools.ts`, `client/src/components/ItemActionSheet.tsx`, `client/src/components/SongPicker.tsx`
- **Automatisiert:** teilweise – `server/src/services/agendaPayload.test.ts`
- **Historie:** –

</details>

### TF-EDIT-02 · Den Titel eines Lied-Punkts ändern

**Das muss passieren:** In der Liste steht **„Eingangslied – <Liedname>"**, also beides. Wenn du in
Schritt 6 genau den Liednamen einträgst, steht er nur **einmal** da, nicht doppelt.

1. Test-Termin öffnen, **Bearbeiten**.
2. Einen **Lied**-Punkt antippen.
3. Ins Feld **Titel** tippen, alles löschen, „Eingangslied" eintragen.
4. **Speichern**.
5. Die Zeile in der Liste ansehen.
6. Denselben Punkt nochmal öffnen und als Titel **genau den Liednamen** eintragen, speichern.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/components/ItemActionSheet.tsx`, `client/src/utils/agendaItemTitle.ts`, `client/src/utils/agendaItemChanges.ts`, `client/src/components/AgendaRowParts.tsx`
- **Automatisiert:** ja – `client/src/utils/agendaItemTitle.test.ts`, `client/src/utils/agendaItemChanges.test.ts`
- **Historie:** #200

</details>

### TF-EDIT-03 · Dauer, Zuständig, Bemerkung, Uhrzeit ausblenden

**Das muss passieren:** Alles steht danach auch in ChurchTools. Nach Schritt 6 ist die Dauer aus der
Zeile verschwunden (in ChurchTools steht dann 0 Minuten – „keine Dauer" kennt ChurchTools nicht).
Nach Schritt 8 bleibt die Zeit-Spalte links leer.

1. Test-Termin öffnen, **Bearbeiten**, einen Punkt antippen.
2. **Dauer (Minuten)** auf 7 setzen.
3. Bei **Zuständig** einen Namen eintragen.
4. Bei **Bemerkung** „Test" eintragen.
5. **Speichern** und die Zeile ansehen.
6. Punkt erneut öffnen, das Feld **Dauer** ganz leeren, **Speichern**.
7. Punkt erneut öffnen, **Uhrzeit ausblenden** einschalten.
8. **Speichern** und die Zeile ansehen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/ItemActionSheet.tsx`, `client/src/utils/agendaItemChanges.ts`, `client/src/components/ResponsibleField.tsx`
- **Automatisiert:** teilweise – `client/src/utils/agendaItemChanges.test.ts`
- **Historie:** –

</details>

### TF-EDIT-04 · Reihenfolge per Ziehen ändern

**Das muss passieren:** Der Punkt landet an der neuen Stelle, und so steht es auch in ChurchTools.
Beim Ziehen ans untere Ende **scrollt die Liste von selbst mit**. Schritt 5 öffnet den Dialog –
tippen auf den Titel darf **kein** Ziehen auslösen.

1. Test-Termin öffnen, **Bearbeiten**.
2. Einen Punkt am **Griff rechts** (die drei Striche) anfassen.
3. Zwei Positionen nach unten ziehen und loslassen.
4. Denselben Punkt bis ans **untere Ende** der Liste ziehen.
5. Auf den **Titel** einer Zeile tippen (nicht auf den Griff).
6. Dialog schließen, in ChurchTools die Reihenfolge prüfen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/components/AgendaSortableRow.tsx`, `client/src/pages/Setlist.tsx`, `client/src/utils/dndAutoScroll.ts`
- **Automatisiert:** nein – Ziehen mit dem Finger
- **Historie:** –

</details>

### TF-EDIT-05 · Punkt hinzufügen und löschen

**Das muss passieren:** Die Rückfrage nennt den Punkt **genauso wie die Liste** – also
„Lied – Du großer Gott", nicht nur den Liednamen. Der gelöschte Punkt zerfällt sichtbar an seiner
Stelle. Beides steht danach so in ChurchTools.

1. Test-Termin öffnen, **Bearbeiten**.
2. Ganz unten auf **Hinzufügen** tippen.
3. Einen Titel eintragen und bestätigen.
4. Einen **Lied**-Punkt antippen und **Eintrag löschen** wählen.
5. Die Rückfrage lesen, dann bestätigen.
6. Zusehen, wie die Zeile verschwindet.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/AddItemSheet.tsx`, `client/src/pages/Setlist.tsx`, `client/src/components/ConfirmDialog.tsx`
- **Automatisiert:** nein
- **Historie:** –

</details>

### TF-EDIT-06 · Die Tastatur verdeckt den Dialog nicht

**Das brauchst du:** Ein **iPhone** – auf dem kleinen Bildschirm zeigt sich das Problem am
deutlichsten.

**Das muss passieren:** In Schritt 4 sind die **Treffer sichtbar** und antippbar, ohne dass du erst
nach oben wischen musst. Nach Schritt 6 sitzt die obere Leiste wieder normal – keine Lücke, keine
verschobenen Symbole.

1. Test-Termin öffnen, **Bearbeiten**, einen Punkt antippen.
2. Ins Feld **Titel** tippen – die Tastatur geht auf.
3. Auf **Lied verknüpfen** tippen.
4. Zwei, drei Buchstaben eintippen und auf die Trefferliste schauen.
5. Einen Treffer antippen.
6. **Speichern** und auf die obere Leiste schauen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/useOverlayKeyboardInset.ts`, `client/src/components/ItemActionSheet.tsx`, `client/src/components/Sheet.tsx`
- **Automatisiert:** teilweise – `client/src/hooks/useOverlayKeyboardInset.test.tsx`
- **Historie:** #207

</details>
