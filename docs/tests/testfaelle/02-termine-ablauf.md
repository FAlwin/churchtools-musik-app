# Termine & Ablauf ansehen

### TF-ABLAUF-01 · Termin-Liste und Ablauf öffnen

- **Priorität:** kritisch
- **Betrifft:** `client/src/pages/Agenda.tsx`, `client/src/pages/Setlist.tsx`, `client/src/components/AgendaFullView.tsx`, `server/src/services/setlistBuilder.ts`, `server/src/controllers/setlistController.ts`
- **Automatisiert:** teilweise – `server/src/services/setlistBuilder.test.ts` (Mapping), Anzeige nicht
- **Historie:** –

1. Termin-Liste öffnen.
2. Den nächsten Gottesdienst antippen.

**Erwartet:** Die Liste zeigt die kommenden Termine mit Datum und Uhrzeit. Der Ablauf zeigt alle
Punkte mit Uhrzeit, Dauer, Notiz und Zuständigen – Reihenfolge wie in ChurchTools.

### TF-ABLAUF-02 · Lied antippen öffnet das RICHTIGE Lied

- **Priorität:** kritisch
- **Betrifft:** `client/src/components/AgendaFullView.tsx`, `client/src/pages/ChordChart.tsx`, `client/src/hooks/useChartNavigation.ts`
- **Automatisiert:** ja – `client/src/components/AgendaFullView.test.tsx` (Zählung nur über Lieder)
- **Historie:** –

**Voraussetzung:** Ein Ablauf, in dem **zwischen den Liedern** Nicht-Lied-Punkte stehen (Begrüßung,
Predigt) – sonst fällt ein Zählfehler nicht auf.

1. Das **dritte** Lied im Ablauf antippen.

**Erwartet:** Genau dieses Lied erscheint. Die Zählung darf nur Lieder berücksichtigen, nicht alle
Ablaufpunkte – sonst landet man mitten im Gottesdienst beim falschen Chart.

### TF-ABLAUF-03 · Zuständige: Namen und offene Dienste

- **Priorität:** normal
- **Betrifft:** `client/src/components/AgendaRowParts.tsx`, `server/src/services/agendaFormat.ts`
- **Automatisiert:** ja – `client/src/components/AgendaRowParts.test.tsx`, `server/src/services/setlistBuilder.test.ts`
- **Historie:** #38

**Voraussetzung:** Ein Ablauf mit besetzten **und** offenen Diensten, dazu eine **manuell als
Freitext** eingetragene Person (nicht über einen Dienst zugewiesen).

1. Den Ablauf ansehen.

**Erwartet:** Besetzte Plätze stehen als Name da, offene Dienste erkennbar als „Musik ?". Die manuell
eingetragene Person fehlt nicht – die steht in ChurchTools nur im Textfeld, nicht in der Personen-Liste.

### TF-ABLAUF-04 · Termine am selben Tag nach Uhrzeit sortiert

- **Priorität:** normal
- **Betrifft:** `server/src/services/setlistBuilder.ts`, `server/src/utils/mapEvent.ts`, `client/src/pages/Agenda.tsx`
- **Automatisiert:** nein – braucht mehrere echte Termine am selben Tag
- **Historie:** #36

**Voraussetzung:** Zwei Gottesdienste am selben Tag zu verschiedenen Uhrzeiten.

1. Termin-Liste öffnen.

**Erwartet:** Der frühere steht oben.

### TF-ABLAUF-05 · Änderungs-Hinweis am Termin

- **Priorität:** hoch
- **Betrifft:** `server/src/services/agendaDiff.ts`, `server/src/services/seenSetlists.ts`, `client/src/components/AblaufChangedBanner.tsx`, `client/src/pages/Agenda.tsx`
- **Automatisiert:** teilweise – `server/src/services/setlistBuilder.test.ts` (Diff/Fingerabdruck)
- **Historie:** #143, #161

**Voraussetzung:** Zwei Geräte oder ein zweiter ChurchTools-Zugang.

1. Auf Gerät A den Ablauf öffnen und wieder verlassen (damit gilt er als gesehen).
2. In ChurchTools ein Lied im Ablauf austauschen.
3. Auf Gerät A die Termin-Liste ansehen.
4. Den Ablauf öffnen.

**Erwartet:** Der Termin trägt einen Änderungs-Hinweis. Im Ablauf leuchtet der geänderte Punkt kurz
auf. Punkte, die man nie gesehen hat, gelten **nicht** als geändert – sonst leuchtet beim ersten
Öffnen alles.

### TF-ABLAUF-06 · Gelöschter Punkt löst sich an seiner Stelle auf

- **Priorität:** normal
- **Betrifft:** `client/src/components/DisintegratingRow.tsx`, `client/src/components/AgendaFullView.tsx`, `client/src/utils/vanishedRows.ts`, `client/src/utils/disintegrate.ts`
- **Automatisiert:** teilweise – `client/src/components/AgendaFullView.test.tsx` (Position, Rückgängig), Animation nicht
- **Historie:** #161, #178

1. Bei geöffnetem Ablauf in ChurchTools einen **mittleren** Punkt löschen.
2. Warten, bis die App nachlädt.

**Erwartet:** Die Zeile bleibt kurz durchgestrichen lesbar, zerfällt dann sichtbar – **an ihrer
Stelle**, nicht am Listenende. Danach schließt sich die Lücke. Sie darf nicht kommentarlos
verschwinden; man denkt sonst, man habe sich verklickt.

### TF-ABLAUF-07 · ChurchTools-Änderungen erscheinen zeitnah

- **Priorität:** hoch
- **Betrifft:** `server/src/services/versionMemo.ts`, `server/src/controllers/setlistController.ts`, `client/src/hooks/useSetlistLive.ts`
- **Automatisiert:** nein – braucht eine echte ChurchTools-Änderung und Wartezeit
- **Historie:** #159

**Voraussetzung:** Ablauf auf dem Gerät geöffnet lassen.

1. In ChurchTools die Tonart eines Liedes ändern.
2. Das Gerät **nicht anfassen** und warten.

**Erwartet:** Die Änderung erscheint innerhalb etwa einer Minute von selbst – ohne Wischen,
Neuladen oder App-Wechsel.
