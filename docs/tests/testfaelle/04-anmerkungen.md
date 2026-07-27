# Anmerkungen (Stift, Marker, Text)

Fast nichts hiervon ist automatisierbar: Es geht um Stift gegen Finger gegen Handballen. Genau
deshalb steht es hier so ausführlich.

### TF-ANNO-01 · Zeichnen mit Stift, Marker und Radierer

- **Priorität:** kritisch
- **Betrifft:** `client/src/hooks/usePointerStrokes.ts`, `client/src/hooks/usePageDraw.ts`, `client/src/components/PageDeck.tsx`, `client/src/components/DrawToolbar.tsx`
- **Automatisiert:** nein – Zeigergesten auf echtem Canvas
- **Historie:** –

1. Anmerkungsmodus einschalten, mit dem **Stift** eine Linie ziehen.
2. Auf **Marker** wechseln, über den Text malen.
3. Auf **Radierer** wechseln, einen Teil wegwischen.
4. Strichstärke ändern und erneut zeichnen.
5. Farbe wechseln und erneut zeichnen.

**Erwartet:** Der Strich folgt dem Stift ohne Versatz und ohne Aussetzer. Der Marker ist
durchscheinend und verdeckt den Text nicht. Der Radierer entfernt nur Striche.

### TF-ANNO-02 · Handballen malt nicht mit

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/usePointerStrokes.ts`
- **Automatisiert:** nein – braucht eine echte Hand
- **Historie:** –

**Voraussetzung:** iPad mit Apple Pencil.

1. Die Hand wie beim Schreiben auf dem Bildschirm ablegen.
2. Mit dem Stift schreiben.

**Erwartet:** Nur der Stift zeichnet. Der Handballen hinterlässt nichts und blättert auch nicht.

### TF-ANNO-03 · Zweiter Finger bricht den Strich ab und zoomt

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/usePointerStrokes.ts`, `client/src/hooks/useZoomOrchestration.ts`
- **Automatisiert:** nein
- **Historie:** –

1. Im Anmerkungsmodus mit einem Finger einen Strich beginnen (noch nicht loslassen).
2. Einen zweiten Finger aufsetzen und aufziehen.

**Erwartet:** Der begonnene Strich **verschwindet** (kein Fragment bleibt zurück), stattdessen wird
gezoomt. Der Anmerkungsmodus bleibt an.

### TF-ANNO-04 · Text platzieren, Tastatur verdeckt nichts

- **Priorität:** hoch
- **Betrifft:** `client/src/components/PageTextLayer.tsx`, `client/src/hooks/useKeyboardInsets.ts`, `client/src/components/PageDeck.tsx`
- **Automatisiert:** teilweise – `client/src/components/PageTextLayer.test.tsx` (Anzeige/Anfassbarkeit)
- **Historie:** #207

**Voraussetzung:** iPhone oder iPad.

1. Text-Werkzeug wählen, auf eine freie Stelle **unten** auf der Seite tippen.
2. Text eintippen.
3. Daneben tippen, um zu übernehmen.

**Erwartet:** Der Cursor blinkt genau an der getippten Stelle, die Tastatur öffnet sich **sofort**
(nicht erst beim zweiten Tipp), und die Eingabestelle bleibt über der Tastatur sichtbar. Nach dem
Übernehmen steht der Text fest an seiner Stelle.

### TF-ANNO-05 · Text verschieben, Größe und Format ändern

- **Priorität:** normal
- **Betrifft:** `client/src/components/PageTextLayer.tsx`, `client/src/components/PageDrawToolbar.tsx`, `client/src/utils/textObjStyle.ts`, `client/src/hooks/usePageDraw.ts`
- **Automatisiert:** teilweise – `client/src/utils/textObjStyle.test.ts`, `client/src/components/PageTextLayer.test.tsx`
- **Historie:** #115

1. Einen vorhandenen Text antippen (auswählen) und verschieben.
2. Am Zieh-Knopf unten rechts die Größe ändern.
3. Fett, kursiv, unterstrichen und die Ausrichtung umschalten.
4. Eine Minute warten und erneut hinsehen.
5. App neu laden.

**Erwartet:** Das Format bleibt, wie eingestellt. Schritt 4 ist Absicht: Normaler Text wurde früher
nach Sekunden von selbst fett.

### TF-ANNO-06 · Auswahlrahmen und offene Eingabe bleiben nicht hängen

- **Priorität:** normal
- **Betrifft:** `client/src/components/PageDeck.tsx`, `client/src/components/PageDrawToolbar.tsx`, `client/src/hooks/usePageDraw.ts`
- **Automatisiert:** teilweise – `client/src/components/PageTextLayer.test.tsx` (Zieh-Knopf nur bei Auswahl)
- **Historie:** #114, #39

1. Einen Text auswählen (gestrichelter Rahmen erscheint).
2. Den Anmerkungsmodus verlassen.
3. Wieder hinein, eine Text-Eingabe öffnen und **ohne zu bestätigen** auf den Stift wechseln.

**Erwartet:** Nach Schritt 2 ist der Rahmen sofort weg – nicht erst beim nächsten Seitenwechsel.
Nach Schritt 3 ist die Eingabe geschlossen und man kann normal zeichnen.

### TF-ANNO-07 · Im Querformat ist nur die aktive Seite beschreibbar

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/usePointerStrokes.ts`, `client/src/components/PageTextLayer.tsx`, `client/src/components/PageDeck.tsx`
- **Automatisiert:** teilweise – `client/src/components/PageTextLayer.test.tsx`
- **Historie:** #53

**Voraussetzung:** iPad im Querformat, zwei Seiten sichtbar.

1. Anmerkungsmodus einschalten.
2. Auf der **ausgegrauten** Seite zu zeichnen versuchen.
3. Auf die ausgegraute Seite tippen.

**Erwartet:** Schritt 2 hinterlässt **nichts**. Schritt 3 macht die Seite aktiv – **ohne** dabei
einen Strich zu setzen. Danach ist sie beschreibbar und die andere ausgegraut.

### TF-ANNO-08 · Rückgängig, Wiederherstellen, Alles löschen

- **Priorität:** normal
- **Betrifft:** `client/src/hooks/usePageDraw.ts`, `client/src/components/PageDrawToolbar.tsx`
- **Automatisiert:** teilweise – `client/src/hooks/usePageDraw.test.tsx` (nur Texte, ohne Canvas)
- **Historie:** –

1. Drei Striche zeichnen und einen Text setzen.
2. Viermal rückgängig machen.
3. Zweimal wiederherstellen.
4. „Alles löschen" und bestätigen.

**Erwartet:** Rückgängig nimmt Striche **und** Texte in umgekehrter Reihenfolge zurück.
„Alles löschen" leert nur die **aktive** Seite.

### TF-ANNO-09 · Anmerkungen überstehen Neustart und sind auf dem zweiten Gerät

- **Priorität:** kritisch
- **Betrifft:** `client/src/services/annotations.ts`, `client/src/hooks/usePageDraw.ts`, `server/src/services/annotations.ts`, `server/src/controllers/annotationsController.ts`
- **Automatisiert:** teilweise – `client/src/services/annotations.sync.test.ts`, `server/src/services/annotations.test.ts`
- **Historie:** #124

**Voraussetzung:** Zwei Geräte am selben Konto.

1. Auf Gerät A ein Lied bemalen und beschriften.
2. Die App auf Gerät A vollständig schließen und neu öffnen.
3. Auf Gerät B dasselbe Lied öffnen (ggf. neu laden).

**Erwartet:** Beides ist nach dem Neustart da und erscheint auf Gerät B an derselben Stelle in
derselben Größe.

### TF-ANNO-10 · Werkzeugleiste bleibt lokal am Gerät

- **Priorität:** normal
- **Betrifft:** `client/src/utils/devicePrefs.ts`, `client/src/components/DrawToolbar.tsx`
- **Automatisiert:** nein – Ziehen
- **Historie:** –

**Voraussetzung:** Zwei Geräte am selben Konto.

1. Auf Gerät A die Leiste am Griff nach unten ziehen und einklappen.
2. App auf A neu öffnen.
3. Auf Gerät B nachsehen.

**Erwartet:** Auf A sind Position und Zustand erhalten. Auf B ist die Leiste **unverändert** – das
ist Absicht: Sie gehört ans Gerät, nicht aufs Konto.
