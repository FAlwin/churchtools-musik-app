# Ablauf bearbeiten (schreibt nach ChurchTools)

⚠️ Diese Fälle **ändern echte Daten in ChurchTools**. Bitte an einem Test-Termin durchführen, nicht
am Gottesdienst des kommenden Sonntags.

### TF-EDIT-01 · Lied verknüpfen und Verknüpfung lösen

- **Priorität:** kritisch
- **Betrifft:** `server/src/services/agendaPayload.ts`, `server/src/services/churchtools.ts`, `client/src/components/ItemActionSheet.tsx`, `client/src/components/SongPicker.tsx`
- **Automatisiert:** teilweise – `server/src/services/agendaPayload.test.ts` (Nutzlast)
- **Historie:** –

**Voraussetzung:** Test-Termin mit einem Punkt ohne Lied.

1. Den Punkt öffnen, „Lied verknüpfen", ein Lied suchen und auswählen.
2. Speichern.
3. In **ChurchTools** nachsehen.
4. In der App die Verknüpfung wieder aufheben und speichern.

**Erwartet:** Der Punkt ist in ChurchTools ein **Lied-Punkt** mit gewähltem Arrangement – er darf
nicht zu einem einfachen Text-Punkt werden. Das ist in ChurchTools **nicht rückgängig zu machen** und
deshalb der wichtigste Schreibpfad der App.

### TF-EDIT-02 · Titel eines Lied-Punkts ändern

- **Priorität:** hoch
- **Betrifft:** `client/src/components/ItemActionSheet.tsx`, `client/src/utils/agendaItemTitle.ts`, `client/src/utils/agendaItemChanges.ts`, `client/src/components/AgendaRowParts.tsx`
- **Automatisiert:** ja – `client/src/utils/agendaItemTitle.test.ts`, `client/src/utils/agendaItemChanges.test.ts`
- **Historie:** #200

1. Einen Lied-Punkt öffnen, den Titel auf „Eingangslied" ändern, speichern.
2. Die Ablauf-Liste ansehen.
3. In ChurchTools nachsehen.

**Erwartet:** In der Liste steht „Eingangslied – <Liedname>", wie in ChurchTools. Heißt der Titel
genau wie das Lied, steht der Name **nur einmal** da.

### TF-EDIT-03 · Dauer, Zuständig, Bemerkung, Uhrzeit ausblenden

- **Priorität:** normal
- **Betrifft:** `client/src/components/ItemActionSheet.tsx`, `client/src/utils/agendaItemChanges.ts`, `client/src/components/ResponsibleField.tsx`
- **Automatisiert:** teilweise – `client/src/utils/agendaItemChanges.test.ts`
- **Historie:** –

1. Dauer auf 7 setzen, Zuständigen eintragen, Bemerkung schreiben, speichern.
2. Punkt erneut öffnen, das Dauer-Feld **leeren**, speichern.
3. „Uhrzeit ausblenden" einschalten, speichern.

**Erwartet:** Alles steht in ChurchTools. Das geleerte Dauer-Feld führt zu **0 Minuten** (ChurchTools
kennt kein „keine Dauer") und die Dauer verschwindet aus der Anzeige. Bei ausgeblendeter Uhrzeit
bleibt die Zeit-Spalte leer.

### TF-EDIT-04 · Sortieren per Ziehen

- **Priorität:** hoch
- **Betrifft:** `client/src/components/AgendaSortableRow.tsx`, `client/src/pages/Setlist.tsx`, `client/src/utils/dndAutoScroll.ts`
- **Automatisiert:** nein – Ziehen mit dem Finger
- **Historie:** –

1. In den Bearbeiten-Modus wechseln.
2. Einen Punkt am **Griff** über zwei Positionen nach unten ziehen.
3. Bis ans untere Listenende ziehen (die Liste soll mitscrollen).
4. Auf den **Titel** einer Zeile tippen.

**Erwartet:** Die Reihenfolge ändert sich und steht so in ChurchTools. Beim Ziehen ans Ende scrollt
die Liste automatisch mit. Schritt 4 öffnet das Aktionsmenü, statt ein Ziehen zu beginnen.

### TF-EDIT-05 · Punkt hinzufügen und löschen

- **Priorität:** normal
- **Betrifft:** `client/src/components/AddItemSheet.tsx`, `client/src/pages/Setlist.tsx`, `client/src/components/ConfirmDialog.tsx`
- **Automatisiert:** nein
- **Historie:** –

1. Einen neuen Punkt hinzufügen (Titel eingeben).
2. Einen anderen Punkt löschen und bestätigen.

**Erwartet:** Die Rückfrage nennt den Punkt mit derselben Bezeichnung wie die Liste („Lied – Du
großer Gott", nicht nur den Liednamen). Der gelöschte Punkt löst sich sichtbar auf. Beides steht so
in ChurchTools.

### TF-EDIT-06 · Tastatur verdeckt den Bearbeiten-Dialog nicht

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/useOverlayKeyboardInset.ts`, `client/src/components/ItemActionSheet.tsx`, `client/src/components/Sheet.tsx`
- **Automatisiert:** teilweise – `client/src/hooks/useOverlayKeyboardInset.test.tsx`
- **Historie:** #207

**Voraussetzung:** iPhone (kleiner Bildschirm zeigt das Problem deutlicher).

1. Einen Punkt öffnen, ins Titel-Feld tippen.
2. „Lied verknüpfen" öffnen und einen Suchbegriff eintippen.
3. Einen Treffer antippen.
4. Speichern und die Kopfleiste ansehen.

**Erwartet:** In Schritt 2 sind die **Treffer sichtbar** und antippbar, ohne vorher zu wischen. Nach
Schritt 4 sitzt die Kopfleiste wieder normal – keine Lücke, keine verrutschten Symbole.
