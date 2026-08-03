# Notizen auf dem Liedblatt

Hier geht es um Stift, Finger und Handballen. Nichts davon lässt sich vom Rechner aus prüfen – bitte
wirklich am iPad mit dem Stift durchgehen.

Der Anmerkungsmodus wird immer gleich eingeschaltet: **Lied öffnen → oben rechts auf den Stift
tippen.** Dann erscheint die Werkzeugleiste am rechten Rand.

### TF-ANNO-01 · Malen mit Stift, Marker und Radierer

**Das muss passieren:** Der Strich folgt dem Stift ohne Verzögerung und ohne Lücken. Der Marker ist
durchscheinend, der Liedtext bleibt darunter lesbar. Der Radierer entfernt nur Gemaltes.

1. Lied öffnen, oben rechts auf den **Stift** tippen.
2. In der Leiste rechts das **Stift-Symbol** wählen und eine Linie über die Seite ziehen.
3. Das **Marker-Symbol** wählen und eine Textzeile markieren.
4. Das **Radierer-Symbol** wählen und die Hälfte der Linie wegwischen.
5. Auf den **farbigen Kreis** oben in der Leiste tippen, eine andere Farbe wählen, erneut malen.
6. Auf das Stift-Symbol **lange** tippen (oder erneut antippen) und die Strichstärke ändern, dann
   noch einmal malen.

<details><summary>Technisches</summary>

- **Priorität:** kritisch
- **Betrifft:** `client/src/hooks/usePointerStrokes.ts`, `client/src/hooks/usePageDraw.ts`, `client/src/components/PageDeck.tsx`, `client/src/components/DrawToolbar.tsx`
- **Automatisiert:** nein – Zeichnen auf echter Zeichenfläche
- **Historie:** –

</details>

### TF-ANNO-02 · Der Handballen malt nicht mit

**Das brauchst du:** iPad mit Apple Pencil.

**Das muss passieren:** Nur der Stift malt. Der Handballen hinterlässt **nichts** und blättert auch
nicht weiter.

1. Lied öffnen, Anmerkungsmodus einschalten, Stift-Werkzeug wählen.
2. Die Hand ganz normal auf dem Bildschirm ablegen, wie beim Schreiben auf Papier.
3. Mit dem Apple Pencil ein paar Wörter schreiben.
4. Die Hand kurz anheben und wieder ablegen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/usePointerStrokes.ts`
- **Automatisiert:** nein – braucht eine echte Hand
- **Historie:** –

</details>

### TF-ANNO-03 · Zweiter Finger bricht den Strich ab und zoomt

**Das muss passieren:** Der begonnene Strich **verschwindet ganz** – es darf kein Reststrich stehen
bleiben. Stattdessen wird die Seite größer. Der Anmerkungsmodus bleibt eingeschaltet.

1. Anmerkungsmodus einschalten, Stift-Werkzeug wählen.
2. Mit **einem Finger** anfangen, eine Linie zu ziehen – und den Finger **auf dem Bildschirm
   lassen**.
3. Einen **zweiten Finger** aufsetzen und beide auseinanderziehen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/usePointerStrokes.ts`, `client/src/hooks/useZoomOrchestration.ts`
- **Automatisiert:** nein
- **Historie:** –

</details>

### TF-ANNO-04 · Text schreiben – die Tastatur verdeckt nichts

**Das brauchst du:** iPhone oder iPad.

**Das muss passieren:** Der blinkende Cursor steht **genau da, wo du getippt hast**. Die Tastatur
geht **sofort** auf, nicht erst beim zweiten Tipp. Die Schreibstelle bleibt über der Tastatur
sichtbar. Nach Schritt 5 steht der Text fest an seiner Stelle.

1. Anmerkungsmodus einschalten.
2. In der Leiste rechts auf das **T** tippen.
3. **Weit unten** auf eine freie Stelle der Seite tippen.
4. „Einsatz Bass" eintippen.
5. Neben den Text tippen, um ihn zu übernehmen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/components/PageTextLayer.tsx`, `client/src/hooks/useKeyboardInsets.ts`, `client/src/components/PageDeck.tsx`
- **Automatisiert:** teilweise – `client/src/components/PageTextLayer.test.tsx`
- **Historie:** #207

</details>

### TF-ANNO-05 · Text verschieben, vergrößern, formatieren

**Das brauchst du:** Einen Text auf der Seite (siehe TF-ANNO-04).

**Das muss passieren:** Das Format bleibt so, wie du es eingestellt hast – auch nach dem Warten und
nach dem Neuladen. Schritt 6 ist Absicht: Normaler Text wurde früher nach ein paar Sekunden von
selbst fett.

1. Anmerkungsmodus einschalten, **T** wählen.
2. Den vorhandenen Text antippen – ein gestrichelter Rahmen erscheint.
3. Den Text an eine andere Stelle ziehen.
4. Am **blauen Punkt** unten rechts ziehen, bis der Text größer ist.
5. In der Leiste nacheinander **F**, **K** und **U** antippen und wieder aus.
6. Eine Minute nichts tun und dann hinschauen.
7. Die App schließen und neu öffnen, dasselbe Lied aufrufen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/PageTextLayer.tsx`, `client/src/components/PageDrawToolbar.tsx`, `client/src/utils/textObjStyle.ts`, `client/src/hooks/usePageDraw.ts`
- **Automatisiert:** teilweise – `client/src/utils/textObjStyle.test.ts`, `client/src/components/PageTextLayer.test.tsx`
- **Historie:** #115

</details>

### TF-ANNO-06 · Rahmen und offene Eingabe bleiben nicht hängen

**Das muss passieren:** Nach Schritt 3 ist der gestrichelte Rahmen **sofort** weg – nicht erst, wenn
du weiterblätterst. Nach Schritt 6 ist die Eingabe zu und du kannst normal malen.

1. Anmerkungsmodus einschalten, **T** wählen.
2. Einen vorhandenen Text antippen (Rahmen erscheint).
3. Oben rechts auf den **Stift** tippen, um den Anmerkungsmodus zu verlassen. Hinschauen.
4. Anmerkungsmodus wieder einschalten, **T** wählen.
5. Auf eine freie Stelle tippen und etwas eintippen – **nicht** bestätigen.
6. In der Leiste auf das **Stift-Symbol** wechseln.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/PageDeck.tsx`, `client/src/components/PageDrawToolbar.tsx`, `client/src/hooks/usePageDraw.ts`
- **Automatisiert:** teilweise – `client/src/components/PageTextLayer.test.tsx`
- **Historie:** #114, #39

</details>

### TF-ANNO-07 · Im Querformat ist nur eine Seite beschreibbar

**Das brauchst du:** iPad im Querformat, sodass zwei Seiten nebeneinander stehen.

**Das muss passieren:** Auf der grauen Seite entsteht **kein** Strich. Der Tipp in Schritt 4 macht
sie aktiv, **ohne** dabei einen Punkt zu hinterlassen – danach ist die andere Seite grau.

1. Ein mehrseitiges Lied im Querformat öffnen.
2. Anmerkungsmodus einschalten. Eine der beiden Seiten ist jetzt leicht grau.
3. Auf der **grauen** Seite versuchen zu malen.
4. Einmal auf die graue Seite tippen.
5. Jetzt dort malen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/usePointerStrokes.ts`, `client/src/components/PageTextLayer.tsx`, `client/src/components/PageDeck.tsx`
- **Automatisiert:** teilweise – `client/src/components/PageTextLayer.test.tsx`
- **Historie:** #53

</details>

### TF-ANNO-08 · Rückgängig, Wiederherstellen, Alles löschen

**Das muss passieren:** Rückgängig nimmt Striche **und** Texte in umgekehrter Reihenfolge zurück.
„Alles löschen" leert nur die Seite, auf der du gerade bist – die anderen bleiben unberührt.

1. Anmerkungsmodus einschalten.
2. Drei Striche malen und einen Text setzen.
3. Viermal auf den **Pfeil nach links** (Rückgängig) tippen.
4. Zweimal auf den **Pfeil nach rechts** (Wiederherstellen) tippen.
5. Auf das **Mülleimer-Symbol** tippen und bestätigen.
6. Eine Seite weiterblättern und dort nachsehen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/hooks/usePageDraw.ts`, `client/src/components/PageDrawToolbar.tsx`
- **Automatisiert:** teilweise – `client/src/hooks/usePageDraw.test.tsx` (nur Texte)
- **Historie:** –

</details>

### TF-ANNO-09 · Notizen sind nach dem Neustart und auf dem zweiten Gerät da

**Das brauchst du:** Zwei Geräte, beide mit demselben Konto angemeldet.

**Das muss passieren:** Alles ist nach dem Neustart wieder da. Auf Gerät B steht es an **derselben
Stelle** in **derselben Größe**.

1. Auf **Gerät A** ein Lied öffnen, malen und einen Text setzen.
2. Die App auf Gerät A ganz schließen (aus dem App-Umschalter wischen).
3. App neu öffnen, dasselbe Lied aufrufen.
4. Auf **Gerät B** die App neu laden und dasselbe Lied öffnen.

<details><summary>Technisches</summary>

- **Priorität:** kritisch
- **Betrifft:** `client/src/services/annotations.ts`, `client/src/hooks/usePageDraw.ts`, `server/src/services/annotations.ts`, `server/src/controllers/annotationsController.ts`
- **Automatisiert:** teilweise – `client/src/services/annotations.sync.test.ts`, `server/src/services/annotations.test.ts`
- **Historie:** #124

</details>

### TF-ANNO-10 · Die Werkzeugleiste bleibt am Gerät

**Das brauchst du:** Zwei Geräte am selben Konto.

**Das muss passieren:** Auf Gerät A sind Position und Zustand nach dem Neustart erhalten. Auf Gerät B
ist die Leiste **unverändert** – das ist Absicht: Wo die Leiste sitzt, hängt am Gerät und nicht am
Konto.

1. Auf **Gerät A** den Anmerkungsmodus einschalten.
2. Die Leiste am **Griff ganz oben** anfassen und nach unten ziehen.
3. Auf den **Pfeil unten** an der Leiste tippen, um sie einzuklappen.
4. App schließen und neu öffnen, Anmerkungsmodus wieder einschalten.
5. Auf **Gerät B** dasselbe Lied öffnen und den Anmerkungsmodus einschalten.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/DrawToolbar.tsx`, `client/src/utils/devicePrefs.ts`
- **Automatisiert:** nein – Ziehen
- **Historie:** –

</details>

### TF-ANNO-11 · Ein Netzaussetzer beim Zeichnen kostet keine Anmerkung

**Das brauchst du:** Ein Gerät, an dem du das WLAN kurz aus- und wieder einschalten kannst.

**Das muss passieren:** Der Strich **bleibt** – auch nachdem die App im Hintergrund weiter mit dem
Server abgeglichen hat. Bis Version 2.15.0 verschwand er in dieser Situation sichtbar wieder: Der
Upload scheiterte, wurde nicht wiederholt, und der nächste Abgleich holte den älteren Stand vom
Server zurück.

1. Ein Lied öffnen und den **Anmerkungsmodus** einschalten.
2. **WLAN und Mobilfunk ausschalten.**
3. Einen deutlich sichtbaren Strich über die Seite ziehen.
4. Ein paar Sekunden warten, dann **WLAN wieder einschalten**.
5. **Eine Minute warten**, ohne etwas zu tun (in dieser Zeit gleicht die App ab).
6. Die Seite ansehen – der Strich muss noch da sein.
7. Zur Gegenprobe: App schließen, neu öffnen, dasselbe Lied aufrufen. Der Strich ist da.
8. **Der härtere Fall (#256):** Nochmal WLAN aus, einen zweiten Strich ziehen, und die App **sofort
   vollständig schließen** (aus dem App-Umschalter wischen) – noch ohne Netz. Dann WLAN einschalten,
   App öffnen, Lied aufrufen und eine Minute warten. Auch dieser Strich muss bleiben; er wird beim
   Öffnen nachträglich hochgeladen.

**Wenn dein Konto voll ist:** Dann erscheint jetzt ein Hinweis unten am Bildschirm („Speicher-
Obergrenze erreicht"). Vorher verschwand die Anmerkung in diesem Fall stillschweigend. Lokal auf dem
Gerät bleibt sie erhalten.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/services/annotations.ts`, `client/src/services/reachability.ts`, `client/src/App.tsx`
- **Automatisiert:** teilweise – `client/src/services/annotations.flush.test.ts` (Zurücklegen, Wiederholung, Pull-Schutz, 413/401); von Hand bleibt die echte Netztrennung am Gerät
- **Historie:** #245

</details>
