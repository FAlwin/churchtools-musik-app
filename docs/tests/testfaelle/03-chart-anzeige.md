# Liedblätter anzeigen und blättern

Der Bereich mit den meisten Reparaturen. Fast nichts davon lässt sich vom Rechner aus prüfen – das
braucht echte Finger auf einem echten Gerät.

### TF-CHART-01 · Das Liedblatt erscheint

**Das muss passieren:** Die Akkorde stehen genau über den richtigen Silben. Vers und Refrain sind
voneinander abgesetzt. Oben stehen Titel, Tonart und Tempo.

1. Unten auf **Termine** tippen, einen Gottesdienst öffnen.
2. Ein Lied antippen.
3. Das Blatt ansehen.

<details><summary>Technisches</summary>

- **Priorität:** kritisch
- **Betrifft:** `client/src/pages/ChordChart.tsx`, `client/src/utils/chordPdf.ts`, `client/src/hooks/useSetlistPages.ts`, `client/src/components/PageDeck.tsx`, `client/src/hooks/useChartStream.ts`
- **Automatisiert:** teilweise – `e2e/chart-smoke.spec.ts`, `client/src/utils/chordPdf.test.ts`
- **Historie:** –

</details>

### TF-CHART-02 · Blättern per Wischen und Tippen

**Das brauchst du:** Ein Lied mit mehreren Seiten, in einem Ablauf mit mehreren Liedern.

**Das muss passieren:** Jeder Schritt blättert **genau eine** Seite – nie zwei auf einmal. Schritt 5
wechselt zum nächsten Lied.

1. Ein mehrseitiges Lied öffnen.
2. Nach links wischen.
3. Ganz am **rechten Rand** einmal tippen.
4. Ganz am **linken Rand** einmal tippen.
5. So oft weiterblättern, bis du über die letzte Seite hinaus bist.

<details><summary>Technisches</summary>

- **Priorität:** kritisch
- **Betrifft:** `client/src/hooks/usePageNavigation.ts`, `client/src/components/PageDeck.tsx`, `client/src/hooks/useChartNavigation.ts`
- **Automatisiert:** nein – Wischgesten nur am Gerät
- **Historie:** –

</details>

### TF-CHART-03 · Querformat zeigt zwei Seiten

**Das brauchst du:** Ein iPad. Ein mehrseitiges Lied und ein Lied, bei dem in ChurchTools ein PDF
hochgeladen ist.

**Das muss passieren:** Im Querformat liegen immer **zwei** Seiten nebeneinander – auch beim PDF. Es
darf nie eine Seite allein rechts stehen. Im Hochformat wieder eine. Nach dem Drehen darf keine
Seite vergrößert hängen bleiben.

1. Ein mehrseitiges Lied öffnen.
2. Das iPad ins **Querformat** drehen.
3. Einmal weiterblättern.
4. Zum Lied mit dem PDF wechseln.
5. Zurück ins **Hochformat** drehen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/useLandscape.ts`, `client/src/components/PageDeck.tsx`, `client/src/hooks/usePageCanvases.ts`
- **Automatisiert:** teilweise – `client/src/hooks/usePageCanvases.test.tsx` und seit #314
  `client/src/hooks/useChartNavigation.test.ts` (die Regel „nie eine Seite allein links", auch beim
  Schrumpfen des Stroms); das Drehen selbst und die PDF-Seiten bleiben von Hand
- **Historie:** #20, #52

</details>

### TF-CHART-04 · Vergrößerung bleibt beim Blättern erhalten

**Das brauchst du:** Ein Lied mit mehreren Seiten.

**Das muss passieren:** Nach Schritt 5 und nach Schritt 6 ist die Seite **noch genauso vergrößert**
und zeigt denselben Ausschnitt. Nach Schritt 7 ist die Vergrößerung dauerhaft weg – sie darf beim
Blättern nicht zurückkommen.

1. Ein mehrseitiges Lied öffnen.
2. Mit zwei Fingern die Seite aufziehen, bis sie deutlich größer ist.
3. Mit zwei Fingern den Ausschnitt nach unten schieben.
4. Nach links wischen (eine Seite weiter).
5. Zurückwischen und hinschauen.
6. Zu einer anderen App wechseln und wieder zurückkommen.
7. Mit zwei Fingern ganz herauszoomen, dann zweimal hin- und herblättern.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/useZoomOrchestration.ts`, `client/src/hooks/useZoomPersistence.ts`, `client/src/components/PageDeck.tsx`
- **Automatisiert:** nein – Zwei-Finger-Geste, nur am Gerät
- **Historie:** #33

</details>

### TF-CHART-05 · Die obere Leiste bleibt, wo sie ist

**Das brauchst du:** iPhone oder iPad, die App vom **Startbildschirm** aus geöffnet (nicht im
Browser).

**Das muss passieren:** Die obere Leiste sitzt nach jedem Schritt an derselben Stelle. Keine Lücke
darüber, keine verschobenen Symbole, nichts rutscht aus dem Bild.

1. Einen Termin öffnen, oben rechts auf **Bearbeiten** tippen.
2. Einen Eintrag antippen, **Lied verknüpfen**, etwas eintippen, einen Treffer wählen.
3. **Speichern** tippen und auf die obere Leiste schauen.
4. Zu einer anderen App wechseln und zurückkommen.
5. Das Gerät drehen und wieder zurückdrehen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/main.tsx`, `client/src/utils/appHeight.ts`, `client/src/hooks/useOverlayKeyboardInset.ts`, `client/src/components/Screen.tsx`
- **Automatisiert:** teilweise – `client/src/hooks/useOverlayKeyboardInset.test.tsx`
- **Historie:** #56, #187, #207

</details>

### TF-CHART-06 · Beim Blättern blitzt nichts auf

**Das brauchst du:** Ein Lied, auf dessen Seiten du schon gemalt und Text gesetzt hast.

**Das muss passieren:** Die Notizen wandern **mit der Seite mit**. Es darf nichts von der vorigen
Seite kurz aufblitzen und die Textgröße darf im Moment des Umblätterns nicht springen.

1. Das Lied öffnen.
2. Fünfmal zügig hin- und herblättern.
3. Dabei nur auf deine Notizen achten.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/useSlideTransition.ts`, `client/src/components/SlidePanes.tsx`, `client/src/utils/textObjStyle.ts`
- **Automatisiert:** teilweise – `client/src/utils/textObjStyle.test.ts`
- **Historie:** #113, #26

</details>

### TF-CHART-07 · Die Fußzeile springt nicht

**Das muss passieren:** Punkte-Anzeige und der Text „Nächstes Lied: …" wechseln ruhig mit. Sie
dürfen nicht kurz etwas Falsches anzeigen.

1. Ein Lied öffnen.
2. Durch drei bis vier Lieder durchblättern.
3. Dabei unten auf die Punkte und den Text schauen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/pages/ChordChart.tsx`, `client/src/hooks/useChartNavigation.ts`
- **Automatisiert:** nein
- **Historie:** #21

</details>

### TF-CHART-08 · Schriftgröße ändern blockiert die App nicht

**Das brauchst du:** Einen Ablauf mit **vielen** Liedern. Wenn vorhanden, ein älteres iPad – dort
zeigt sich das Problem am deutlichsten.

**Das muss passieren:** Das Menü reagiert **sofort** auf jeden Tipp. Die alten Seiten bleiben
sichtbar, bis die neuen fertig sind. Die App darf nicht mehrere Sekunden stehen.

1. Ein Lied öffnen.
2. Oben rechts auf **Aa** tippen.
3. Fünfmal zügig hintereinander auf **A+** tippen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/pages/ChordChart.tsx`, `client/src/components/ChartAppearanceMenu.tsx`, `client/src/utils/chordPdf.ts`, `client/src/utils/chartPdfOptions.ts`, `client/src/components/ChartOverlays.tsx`
- **Automatisiert:** teilweise – `client/src/utils/chartPdfOptions.test.ts`, `client/src/components/ChartAppearanceMenu.test.tsx`
- **Historie:** #197

</details>

### TF-CHART-09 · Der Tempo-Puls schlägt im Takt des Lieds

**Das brauchst du:** Ein Lied, bei dem in ChurchTools ein **Tempo** hinterlegt ist, und ein
Metronom (eine Handy-App genügt). Wenn möglich zusätzlich ein Lied **ohne** Tempo.

**Das muss passieren:** Neben der Tempo-Angabe (`♩ 72`) pulst ein kleiner blauer Punkt – genau im
Takt des Lieds. Er ist **lautlos**. Die Kopfzeile darf dabei nicht wackeln oder umbrechen.

1. Ein Lied mit Tempo öffnen.
2. Oben rechts auf **♩** tippen → das Tempo-Menü geht auf. Unter **Sichtbarer Puls** auf **An** –
   der Punkt beginnt zu pulsen, der ♩-Knopf färbt sich.
3. Das Metronom auf dasselbe Tempo stellen und **eine halbe Minute mitlaufen lassen**. Punkt und
   Metronom müssen zusammenbleiben – nicht auseinanderdriften.
4. Zum nächsten Lied blättern: Der Puls übernimmt dessen Tempo.
5. Zu einem Lied **ohne** Tempo blättern: Der Punkt ist weg und im Menü steht „kein Tempo"; **An**
   und die Klick-Knöpfe sind ausgegraut. Der ♩-Knopf selbst bleibt da – über ihn trägt man ja
   gerade ein fehlendes Tempo nach.
6. Das Liederheft verlassen und neu öffnen: Der Puls ist **aus**.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/BpmPulse.tsx`, `client/src/utils/bpmPulse.ts`, `client/src/components/ChartHeader.tsx`, `client/src/components/TempoMenu.tsx`, `client/src/utils/activeSongView.ts`
- **Automatisiert:** teilweise – `client/src/utils/bpmPulse.test.ts` und
  `client/src/components/BpmPulse.test.tsx` (Taktrate mit selbst gesteuerten Frames, auch über 144
  Schläge hinweg), dazu `client/src/components/TempoMenu.test.tsx` (was gesperrt ist und was nicht).
  Von Hand bleibt der Abgleich gegen ein echtes Metronom und der Eindruck auf dem Gerät – ob der
  Punkt beim Spielen hilft, ohne vom Blatt abzulenken.
- **Historie:** #145

</details>

### TF-CHART-10 · Tipp in die Mitte blendet die Leisten aus

**Das brauchst du:** Ein iPad oder Handy, ein Lied mit mehreren Seiten.

**Das muss passieren:** Ein Tipp in die **Mitte** des Blattes blendet Kopf- und Fußzeile aus – das
Blatt bekommt die ganze Fläche und wird sichtbar größer. Beim **ersten** Mal erscheint kurz der
Hinweis „Leisten ausgeblendet – nochmal in die Mitte tippen holt sie zurück." Ein weiterer Tipp
holt sie zurück. Die Ränder blättern weiter wie bisher.

1. Ein Lied öffnen, in die **Mitte** tippen → Leisten weg, Hinweis erscheint.
2. Nochmal in die Mitte tippen → Leisten zurück.
3. Am **linken** und **rechten** Rand tippen → es wird geblättert, die Leisten bleiben wie sie sind.
4. Ins **Querformat** drehen, in die rechte Bildhälfte (aber nicht an den Rand) tippen → Leisten
   weg **und** die Kopfzeile bezieht sich auf das rechte Lied.
5. Mit zwei Fingern hineinzoomen, dann in die Mitte tippen → die Seite wird **neu eingepasst**
   (nichts ragt hinter die Leisten). Danach zu einem anderen Lied und wieder zurück blättern → die
   Vergrößerung ist **wieder da**, sie wurde nur eingepasst, nicht verworfen.
   **Sofort** nach dem Zoomen tippen, ohne Pause – auch dann muss eingepasst werden. Genau dieser
   Fall ging schief: Die Sperre gegen das Abwürgen einer laufenden Pinch-Geste stand noch rund eine
   halbe Sekunde nach dem Loslassen.
6. **Am großen Bildschirm, Fenster hoch und schmal** (nicht am Handy!): einmal in die Mitte tippen
   und wieder zurück → die Seite muss am Ende wieder in die Fläche passen. Nur in einem hohen
   Fenster ist die Seite höhenbegrenzt; im Hochformat am Handy begrenzt die Breite und der Fehler
   bleibt unsichtbar.
7. **Anmerkungsmodus** einschalten und in die Mitte tippen → es passiert nichts (der Finger gehört
   dem Stift).
8. Das Liederheft verlassen und neu öffnen → die Leisten sind wieder da.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/hooks/usePageNavigation.ts`, `client/src/pages/ChordChart.tsx`, `client/src/components/PageDeck.tsx`, `client/src/utils/onboarding.ts`, `client/src/hooks/useZoomPersistence.ts`, `client/src/hooks/useZoomOrchestration.ts`
- **Automatisiert:** weitgehend – `client/src/hooks/usePageNavigation.test.ts` (Zonen,
  Zeichenmodus, der nach einem Touch nachgereichte Klick), dazu `useZoomPersistence.test.ts` und
  `useZoomOrchestration.test.ts` (einpassen ohne vergessen). **Punkt 5 und 6 deckt
  `e2e/chart-fullscreen.spec.ts` ab** – bewusst als E2E, weil es um echte Geometrie geht
  (gerenderte Seiten, CSS, Zoom-Bibliothek) und die Messung nur in einem hohen Fenster etwas
  aussagt. Von Hand bleibt der Eindruck am Gerät: ob es sich beim echten Pinch richtig anfühlt,
  zeigt nur das Gerät.
- **Historie:** #319

</details>
### TF-CHART-11 · Klick und Tempo antippen

**Das brauchst du:** Ein Lied mit Tempo, ein Metronom, und ein Konto, das Lieder in ChurchTools
bearbeiten darf. Zusätzlich ein Lied **ohne** hinterlegtes Tempo.

**Das muss passieren:** Der Klick liegt hörbar auf demselben Schlag wie der sichtbare Puls und
driftet auch nach einer Minute nicht weg. Das angetippte Tempo landet in ChurchTools – und **nur**
das; Tonart, Taktart und Dauer des Arrangements bleiben unverändert.

1. Lied mit Tempo öffnen, auf **♩**, unter **Klick** auf **Dauerhaft** → es tickt, die Eins ist
   höher und lauter. Der ♩-Knopf färbt sich.
2. Metronom danebenlegen und **eine Minute** laufen lassen → kein Auseinanderdriften.
3. Auf **Einzählen** stellen → es klickt **einen Takt** lang und hört von selbst auf; das Menü
   springt danach zurück auf **Aus**.
4. Am iPhone den **physischen Stummschalter** umlegen → der Klick verstummt womöglich. Das ist eine
   Eigenheit von iOS und kein Fehler; der sichtbare Puls läuft weiter.
5. **Tempo antippen:** Viermal im Takt auf **Tippen** → daneben steht ein Tempo. Weiter tippen →
   der Wert wird ruhiger. **Zurück** verwirft ihn wieder.
6. Ein Tempo antippen und **in ChurchTools speichern** → kurze Rückmeldung, die Kopfzeile zeigt das
   neue `♩`. **Danach in ChurchTools nachsehen:** Tonart, Taktart und Dauer des Arrangements müssen
   unverändert sein. (Ein `PUT` ersetzt dort den ganzen Datensatz – deshalb dieser Punkt.)
7. Mit einem Konto **ohne** Bearbeitungsrecht dasselbe: Der Speichern-Knopf erscheint nicht,
   stattdessen der Hinweis auf die fehlende Berechtigung.
8. Lied **ohne** Tempo öffnen, ein Tempo antippen und speichern → ab jetzt hat das Lied ein Tempo,
   Puls und Klick sind nicht mehr ausgegraut.

<details><summary>Technisches</summary>

- **Priorität:** hoch (Punkt 6 schreibt in ChurchTools)
- **Betrifft:** `client/src/components/TempoMenu.tsx`, `client/src/hooks/useMetronome.ts`, `client/src/utils/metronome.ts`, `client/src/utils/tapTempo.ts`, `server/src/services/arrangementPayload.ts`, `server/src/services/ctWrite.ts`
- **Automatisiert:** teilweise – `metronome.test.ts`, `tapTempo.test.ts`, `useMetronome.test.ts`
  (Audio-Uhr mit gestellter Zeit), `TempoMenu.test.tsx` und `arrangementPayload.test.ts` (der Test
  auf **Erhalt**: nichts nebenbei löschen). Von Hand bleiben der Klang, der Abgleich gegen ein
  echtes Metronom, der iOS-Stummschalter und Punkt 6 – ob in ChurchTools wirklich nur das Tempo
  anders ist, zeigt nur der Blick dorthin.
- **Historie:** #145

</details>
