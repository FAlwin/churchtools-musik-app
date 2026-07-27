# Chart-Anzeige & Blättern

Die Seiten-Engine (`PageDeck` und ihre Hooks) ist der Teil mit den meisten Reparatur-Runden. Fast
nichts davon lässt sich automatisch prüfen – Gesten brauchen echte Finger.

### TF-CHART-01 · Chart wird angezeigt

- **Priorität:** kritisch
- **Betrifft:** `client/src/pages/ChordChart.tsx`, `client/src/utils/chordPdf.ts`, `client/src/hooks/useSetlistPages.ts`, `client/src/components/PageDeck.tsx`
- **Automatisiert:** teilweise – `e2e/chart-smoke.spec.ts` (rendert überhaupt), `client/src/utils/chordPdf.test.ts` (Seitenaufteilung)
- **Historie:** –

1. Ein Lied aus dem Ablauf öffnen.

**Erwartet:** Akkorde stehen über den zugehörigen Silben, Abschnitte (Vers/Refrain) sind erkennbar,
Kopfzeile zeigt Titel, Tonart und Tempo.

### TF-CHART-02 · Blättern per Wisch und Tipp

- **Priorität:** kritisch
- **Betrifft:** `client/src/hooks/usePageNavigation.ts`, `client/src/components/PageDeck.tsx`, `client/src/hooks/useChartNavigation.ts`
- **Automatisiert:** nein – Wischgesten nur am Gerät
- **Historie:** –

**Voraussetzung:** Ein mehrseitiges Lied, danach ein Ablauf mit mehreren Liedern.

1. Nach links wischen.
2. An den **rechten Rand** tippen.
3. An den **linken Rand** tippen.
4. Über die letzte Seite des Liedes hinausblättern.

**Erwartet:** 1–3 blättern je eine Seite. Schritt 4 springt ins **nächste Lied**. Kein Schritt
überspringt eine Seite – iOS schickt nach einer Berührung zusätzlich einen Klick hinterher, der
unterdrückt werden muss.

### TF-CHART-03 · Querformat zeigt zwei Seiten

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/useLandscape.ts`, `client/src/components/PageDeck.tsx`, `client/src/hooks/usePageCanvases.ts`
- **Automatisiert:** teilweise – `client/src/hooks/usePageCanvases.test.tsx` (beide Slots), Drehen nicht
- **Historie:** #20, #52

**Voraussetzung:** iPad, ein mehrseitiges Lied **und** ein Lied mit hochgeladenem PDF.

1. Ins Querformat drehen.
2. Blättern.
3. Zum PDF-Lied wechseln.
4. Zurück ins Hochformat drehen.

**Erwartet:** Im Querformat stehen immer zwei Seiten nebeneinander – auch beim PDF. Nie bleibt eine
Seite allein rechts stehen. Im Hochformat wieder eine Seite. Nach dem Drehen bleibt kein Zoom hängen.

### TF-CHART-04 · Zoom bleibt erhalten

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/useZoomOrchestration.ts`, `client/src/hooks/useZoomPersistence.ts`, `client/src/components/PageDeck.tsx`
- **Automatisiert:** nein – Pinch-Geste, nur am Gerät
- **Historie:** #33

**Voraussetzung:** Mehrseitiges Lied.

1. Mit zwei Fingern in eine Seite hineinzoomen und den Ausschnitt verschieben.
2. Eine Seite weiter und wieder zurückblättern.
3. Die App verlassen und zurückkehren.
4. Vollständig wieder herauszoomen.
5. Erneut hin- und herblättern.

**Erwartet:** Nach 2 und 3 ist der Zoom samt Ausschnitt unverändert. Nach 4 ist er dauerhaft weg –
er darf nach dem Blättern nicht zurückkommen.

### TF-CHART-05 · Kopfleiste bleibt an ihrem Platz

- **Priorität:** hoch
- **Betrifft:** `client/src/main.tsx`, `client/src/utils/appHeight.ts`, `client/src/hooks/useOverlayKeyboardInset.ts`, `client/src/components/Screen.tsx`
- **Automatisiert:** teilweise – `client/src/hooks/useOverlayKeyboardInset.test.tsx`
- **Historie:** #56, #187, #207

**Voraussetzung:** iPhone oder iPad als installierte PWA (nicht im Browser-Tab).

1. Ein Lied verknüpfen (Dialog mit Tastatur öffnen) und speichern.
2. Die Kopfleiste ansehen.
3. Die App verlassen und zurückkehren.
4. Drehen und zurückdrehen.

**Erwartet:** Die Kopfleiste sitzt jederzeit an derselben Stelle. Keine Lücke darüber, keine
verrutschten Symbole, nichts wandert aus dem Bild.

### TF-CHART-06 · Blätter-Animation ohne Aufblitzen

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/useSlideTransition.ts`, `client/src/components/SlidePanes.tsx`, `client/src/utils/textObjStyle.ts`
- **Automatisiert:** teilweise – `client/src/utils/textObjStyle.test.ts` (gleicher Stil in beiden Ansichten)
- **Historie:** #113, #26

**Voraussetzung:** Seiten mit **Anmerkungen** (Striche und Textfelder).

1. Zügig mehrmals vor- und zurückblättern.
2. Genau auf die Anmerkungen achten.

**Erwartet:** Die Anmerkungen wandern mit der Seite mit. Kein Aufblitzen der Vorseite, kein Springen
der Textgröße im Moment des Übergangs.

### TF-CHART-07 · Fußzeile springt nicht

- **Priorität:** normal
- **Betrifft:** `client/src/pages/ChordChart.tsx`, `client/src/hooks/useChartNavigation.ts`
- **Automatisiert:** nein
- **Historie:** #21

1. Durch mehrere Lieder blättern und die Fußzeile beobachten.

**Erwartet:** Punkte-Anzeige und „Nächstes Lied"-Text wechseln ruhig, ohne zwischendurch auf einen
falschen Wert zu springen.

### TF-CHART-08 · Einstellungen ändern blockiert die Bedienung nicht

- **Priorität:** hoch
- **Betrifft:** `client/src/pages/ChordChart.tsx`, `client/src/utils/chordPdf.ts`, `client/src/utils/chartPdfOptions.ts`
- **Automatisiert:** teilweise – `client/src/utils/chartPdfOptions.test.ts`
- **Historie:** #197

**Voraussetzung:** Ein Ablauf mit **vielen** Liedern; wenn möglich ein älteres iPad.

1. Das Aussehen-Menü öffnen und die Schriftgröße mehrfach zügig ändern.

**Erwartet:** Das Menü reagiert sofort, die bisherigen Seiten bleiben sichtbar, bis die neuen fertig
sind. Die App darf nicht für Sekunden stehen.
