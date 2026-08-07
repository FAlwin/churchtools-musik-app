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
