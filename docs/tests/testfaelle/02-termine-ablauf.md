# Termine und Ablauf ansehen

### TF-ABLAUF-01 · Termin öffnen und den Ablauf ansehen

**Das muss passieren:** Die Liste zeigt die kommenden Gottesdienste mit Datum und Uhrzeit. Im Ablauf
stehen alle Punkte in derselben Reihenfolge wie in ChurchTools, mit Uhrzeit links, Dauer und
Bemerkung.

1. Unten auf **Termine** tippen.
2. Den nächsten Gottesdienst antippen.
3. Die Liste von oben nach unten durchsehen.

<details><summary>Technisches</summary>

- **Priorität:** kritisch
- **Betrifft:** `client/src/pages/Agenda.tsx`, `client/src/pages/Setlist.tsx`, `client/src/components/AgendaFullView.tsx`, `server/src/services/setlistBuilder.ts`, `server/src/controllers/setlistController.ts`
- **Automatisiert:** teilweise – `server/src/services/setlistBuilder.test.ts` (Daten), Anzeige nicht
- **Historie:** –

</details>

### TF-ABLAUF-02 · Lied antippen öffnet das RICHTIGE Lied

**Das brauchst du:** Einen Ablauf, in dem **zwischen** den Liedern andere Punkte stehen (Begrüßung,
Predigt). Ohne solche Zwischenpunkte fällt ein Zählfehler gar nicht auf.

**Das muss passieren:** Genau das Lied erscheint, das du angetippt hast. Wenn stattdessen ein
anderes kommt, zählt die App die Zwischenpunkte fälschlich mit.

1. Einen Termin öffnen.
2. Suche das **dritte Lied** von oben (Zwischenpunkte nicht mitzählen).
3. Dieses Lied antippen.
4. Oben den Titel lesen.

<details><summary>Technisches</summary>

- **Priorität:** kritisch
- **Betrifft:** `client/src/components/AgendaFullView.tsx`, `client/src/pages/ChordChart.tsx`, `client/src/hooks/useChartNavigation.ts`
- **Automatisiert:** ja – `client/src/components/AgendaFullView.test.tsx`
- **Historie:** –

</details>

### TF-ABLAUF-03 · Zuständige: Namen und offene Dienste

**Das brauchst du:** Einen Ablauf mit besetzten **und** unbesetzten Diensten. Dazu in ChurchTools bei
einem Punkt eine Person **von Hand ins Textfeld** eintragen (nicht über einen Dienst zuweisen).

**Das muss passieren:** Besetzte Plätze stehen als Name da. Unbesetzte sind erkennbar als
„Musik ?". Die von Hand eingetragene Person **fehlt nicht** – die steht in ChurchTools an einer
anderen Stelle und wurde früher übersehen.

1. Einen Termin öffnen.
2. Bei jedem Punkt die Zeile unter dem Titel ansehen (kleines Personen-Symbol).

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/AgendaRowParts.tsx`, `server/src/services/agendaFormat.ts`
- **Automatisiert:** ja – `client/src/components/AgendaRowParts.test.tsx`, `server/src/services/setlistBuilder.test.ts`
- **Historie:** #38

</details>

### TF-ABLAUF-04 · Zwei Termine am selben Tag stehen richtig herum

**Das brauchst du:** Zwei Gottesdienste am selben Tag zu verschiedenen Uhrzeiten.

**Das muss passieren:** Der frühere steht oben.

1. Unten auf **Termine** tippen.
2. Die beiden Termine des Tages ansehen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `server/src/services/setlistBuilder.ts`, `server/src/utils/mapEvent.ts`, `client/src/pages/Agenda.tsx`
- **Automatisiert:** nein – braucht zwei echte Termine am selben Tag
- **Historie:** #36

</details>

### TF-ABLAUF-05 · Blauer Punkt zeigt, dass sich etwas geändert hat

**Das brauchst du:** Zugang zu ChurchTools im Browser, während die App offen ist.

**Das muss passieren:** In Schritt 4 hat der Termin einen **blauen Punkt** – wie eine ungelesene
Nachricht. In Schritt 5 leuchtet der geänderte Punkt kurz auf. Beim allerersten Öffnen eines
Termins darf **nichts** leuchten, sonst blinkt die ganze Liste.

1. Einen Termin öffnen und wieder zurück zur Liste (damit gilt er als gesehen).
2. Im Browser in ChurchTools ein Lied dieses Ablaufs austauschen.
3. In der App unten auf **Termine** tippen.
4. Auf den Termin in der Liste schauen.
5. Den Termin öffnen und die geänderte Zeile ansehen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `server/src/services/agendaDiff.ts`, `server/src/services/seenSetlists.ts`, `client/src/components/AblaufChangedBanner.tsx`, `client/src/pages/Agenda.tsx`
- **Automatisiert:** teilweise – `server/src/services/setlistBuilder.test.ts` (Vergleichslogik)
- **Historie:** #143, #161

</details>

### TF-ABLAUF-06 · Gelöschter Punkt löst sich an seiner Stelle auf

**Das brauchst du:** Zugang zu ChurchTools, App mit geöffnetem Ablauf daneben.

**Das muss passieren:** Die Zeile bleibt kurz durchgestrichen lesbar und **zerfällt** dann sichtbar –
genau **an ihrer Stelle**, nicht unten am Listenende. Danach schließt sich die Lücke. Sie darf nicht
einfach kommentarlos verschwinden; sonst denkt man, man habe sich verklickt.

1. Einen Termin in der App öffnen und offen lassen.
2. In ChurchTools einen Punkt **aus der Mitte** des Ablaufs löschen.
3. In der App warten (bis zu einer Minute) und auf die Stelle schauen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/DisintegratingRow.tsx`, `client/src/components/AgendaFullView.tsx`, `client/src/utils/vanishedRows.ts`, `client/src/utils/disintegrate.ts`
- **Automatisiert:** teilweise – `client/src/components/AgendaFullView.test.tsx` (Position), Animation nicht
- **Historie:** #161, #178

</details>

### TF-ABLAUF-07 · Änderungen aus ChurchTools erscheinen von selbst

**Das muss passieren:** Die neue Tonart erscheint innerhalb etwa einer Minute **von allein**. Du
sollst nicht wischen, neu laden oder die App wechseln müssen.

1. Einen Termin in der App öffnen und das Gerät liegen lassen.
2. In ChurchTools die Tonart eines Liedes in diesem Ablauf ändern.
3. Das Gerät **nicht anfassen** und auf den Bildschirm schauen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `server/src/services/versionMemo.ts`, `server/src/controllers/setlistController.ts`, `client/src/hooks/useSetlistLive.ts`
- **Automatisiert:** nein – braucht eine echte Änderung und Wartezeit
- **Historie:** #159

</details>
