# Tonart, Kapo und Darstellung

Zwei Menüs, die hier immer wieder vorkommen:

- **Lied-Menü** – oben auf den **Liedtitel** tippen. Darin: Tonart, Kapo, Version, Transponieren.
- **Darstellung** – oben rechts auf **Aa** tippen. Darin: Schriftgröße und Spalten.

### TF-EINST-01 · Tonart und Kapo ändern

**Das muss passieren:** Nach Schritt 3 stehen **alle** Akkorde zwei Halbtöne höher – auch geteilte
wie `E/G#`. Nach Schritt 5 zeigt die Kopfzeile Tonart **und** Kapo an, und die Griffe sind
entsprechend verschoben.

1. Ein Lied öffnen.
2. Oben auf den **Liedtitel** tippen.
3. Bei **Transponieren** zweimal nach oben (+2) und das Menü schließen.
4. Wieder auf den Titel tippen.
5. Bei **Kapo** die 2 wählen und schließen.

<details><summary>Technisches</summary>

- **Priorität:** kritisch
- **Betrifft:** `client/src/pages/ChordChart.tsx`, `client/src/components/SongMenu.tsx`, `client/src/utils/chartSettings.ts`, `client/src/utils/transpose.ts`, `client/src/components/KeyPicker.tsx`, `client/src/components/CapoPicker.tsx`, `client/src/utils/chordPdf.ts`, `client/src/hooks/useSongSettings.ts`
- **Automatisiert:** teilweise – `client/src/utils/transpose.test.ts`, `client/src/hooks/useSongSettings.test.tsx`
- **Historie:** –

</details>

### TF-EINST-02 · Jede Version hat ihre eigenen Einstellungen

**Das brauchst du:** Ein Lied mit mindestens **zwei Fassungen** – also Original plus eine selbst
angelegte Version (siehe TF-VER-01).

**Das muss passieren:** Bei Schritt 5 stehen **die eigenen, noch unberührten Werte** der zweiten
Version – nicht die vom Original. Nach Schritt 8 sind beim Original Tonart, Kapo 2 und zwei Spalten
**unverändert** da.

Das ist der wichtigste Fall in dieser Datei: Geht er schief, steht im Gottesdienst die falsche
Tonart auf dem Blatt.

1. Ein Lied mit zwei Fassungen öffnen. Sicherstellen, dass **Original** gewählt ist (Liedtitel
   antippen → Version).
2. Tonart um +2 ändern.
3. Kapo auf 2 setzen.
4. Über **Aa** auf **2 Spalten** stellen.
5. Liedtitel antippen → **Version** → die zweite Fassung wählen. Hinschauen.
6. Dort Kapo auf **4** setzen.
7. Über **Aa** auf **1 Spalte** stellen.
8. Liedtitel antippen → **Version** → zurück auf **Original**. Hinschauen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/pages/ChordChart.tsx`, `client/src/utils/chartSettings.ts`, `client/src/utils/songVersions.ts`, `client/src/hooks/useSongSettings.ts`
- **Automatisiert:** ja – `client/src/hooks/useSongSettings.test.tsx`
- **Historie:** –

</details>

### TF-EINST-03 · Version und PDF gelten fürs ganze Lied

**Das brauchst du:** Ein Lied mit hochgeladenem PDF **und** mit mehreren Fassungen.

**Das muss passieren:** Nach Schritt 4 ist **weiterhin das PDF** zu sehen – es darf nicht zu den
Akkorden zurückspringen. Nach Schritt 6 sind dieselbe Version und wieder das PDF aktiv.

1. Das Lied öffnen.
2. Oben auf den **Liedtitel** tippen.
3. Unter der Liste der Dateien das **PDF** wählen.
4. Wieder auf den Titel tippen → **Version** → die andere Fassung wählen. Hinschauen.
5. Die App schließen und neu öffnen.
6. Dasselbe Lied aufrufen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/pages/ChordChart.tsx`, `client/src/utils/chartSettings.ts`, `client/src/utils/songVersions.ts`, `client/src/hooks/useSongSettings.ts`
- **Automatisiert:** ja – `client/src/hooks/useSongSettings.test.tsx`
- **Historie:** –

</details>

### TF-EINST-04 · Spalten, Schriftgröße und „Nur Text"

**Das muss passieren:** Zwei Spalten brauchen **weniger** Seiten, größere Schrift **mehr** – die
Seitenzahl unten rechts ändert sich entsprechend. „Nur Text" blendet die Akkorde aus, der Liedtext
bleibt vollständig.

1. Ein mehrseitiges Lied öffnen und die Seitenzahl unten rechts merken.
2. Oben rechts **Aa** → **2 Spalten**. Seitenzahl vergleichen.
3. Dreimal auf **A+** tippen. Seitenzahl vergleichen.
4. Liedtitel antippen → **Nur Text** einschalten.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/pages/ChordChart.tsx`, `client/src/utils/chartSettings.ts`, `client/src/utils/chordPdf.ts`, `client/src/utils/chartPdfOptions.ts`, `client/src/hooks/useSongSettings.ts`
- **Automatisiert:** teilweise – `client/src/utils/chordPdf.test.ts`
- **Historie:** –

</details>

### TF-EINST-05 · Nur einen Abschnitt transponieren

**Das muss passieren:** Nur der Refrain steht höher, die Verse bleiben wie sie waren. Nach Schritt 6
ist wieder alles einheitlich.

1. Ein Lied öffnen, oben auf den **Liedtitel** tippen.
2. **Abschnitte transponieren** wählen.
3. Beim **Refrain** auf +2 stellen, die Verse auf 0 lassen.
4. Schließen und das Blatt ansehen.
5. Wieder in **Abschnitte transponieren** gehen.
6. Den Refrain zurück auf **0** stellen und schließen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/SectionTransposeSheet.tsx`, `client/src/utils/chartSettings.ts`, `client/src/pages/ChordChart.tsx`, `client/src/utils/chordPdf.ts`, `client/src/hooks/useSongSettings.ts`
- **Automatisiert:** nein
- **Historie:** #16

</details>

### TF-EINST-06 · Einstellungen sind auf dem zweiten Gerät da

**Das brauchst du:** Zwei Geräte, beide mit demselben Konto angemeldet.

**Das muss passieren:** Alle drei Lieder sehen auf Gerät B genauso aus wie auf A.

1. Auf **Gerät A** drei verschiedene Lieder öffnen und bei jedem Tonart, Kapo und Schriftgröße
   ändern.
2. Eine Minute warten.
3. Auf **Gerät B** die App schließen und neu öffnen.
4. Dieselben drei Lieder nacheinander aufrufen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/services/userSettings.ts`, `server/src/services/userSettings.ts`, `server/src/controllers/userSettingsController.ts`
- **Automatisiert:** teilweise – `server/src/services/userSettings.test.ts`
- **Historie:** #195, #213

</details>

### TF-EINST-07 · Geteiltes PDF sieht aus wie der Bildschirm (auch mit Kapo)

**Das brauchst du:** Ein Lied mit Akkorden. Am besten ein Gerät, auf dem du das PDF gleich ansehen
kannst.

**Das muss passieren:** Die Akkorde im PDF sind **dieselben** wie auf dem Bildschirm. Auch die
Kopfzeile („Tonart – …") stimmt überein. Bis Version 2.14 stand im geteilten PDF bei gesetztem Kapo
eine andere Tonart als auf dem Blatt – bei Kapo 2 zwei Halbtöne zu hoch.

1. Ein Lied öffnen und oben auf den **Liedtitel** tippen.
2. Bei **Kapo** die 2 wählen.
3. Die Akkorde der ersten Zeile auf dem Bildschirm aufschreiben oder merken.
4. Wieder auf den Titel tippen und **Als PDF teilen** wählen.
5. Das PDF ansehen (z. B. in Dateien speichern oder sich selbst schicken).
6. Die erste Zeile im PDF mit dem Zettel aus Schritt 3 vergleichen.
7. Zur Gegenprobe: Kapo zurück auf **0**, noch einmal teilen – auch dann müssen Bildschirm und PDF
   übereinstimmen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/pages/ChordChart.tsx`, `client/src/utils/chartPdfOptions.ts`, `client/src/utils/songPdfOpts.ts`, `client/src/utils/sharePdf.ts`, `client/src/utils/chordPdf.ts`
- **Automatisiert:** teilweise – `client/src/utils/chartPdfOptions.test.ts` (die Rechnung inkl. Kapo und der Weg über den Speicher); von Hand bleibt der Teilen-Dialog des Geräts und das Ansehen der fertigen Datei
- **Historie:** #239

</details>
### TF-EINST-08 · Ohne Netz geänderte Tonart übersteht das Schließen der App

**Das brauchst du:** Ein iPad/iPhone mit der App als PWA und ein zweites Gerät (oder denselben
Browser am Rechner), um gegenzuprüfen. Ein Lied, dessen Tonart du gefahrlos ändern kannst.

**Das muss passieren:** Die ohne Netz geänderte Tonart ist nach dem Neustart **noch da** und landet
auf dem Konto. Bis Version 2.16 war sie still weg: Der Merker für den ausstehenden Upload lebte nur
im Speicher, und beim nächsten Öffnen spiegelte der Abgleich den älteren Server-Stand zurück. Die
Anmerkungen hatten diesen Schutz schon, die Einstellungen nicht.

1. Das Lied öffnen und die aktuelle Tonart notieren.
2. **Flugmodus einschalten** (oder WLAN aus – die App muss wirklich ohne Netz sein).
3. Auf den Liedtitel tippen und eine **andere Tonart** wählen. Sie gilt sofort auf dem Blatt.
4. Die App **ganz schließen** (App-Umschalter, nach oben wegwischen – nicht nur in den Hintergrund).
5. Flugmodus wieder aus.
6. Die App öffnen und dasselbe Lied ansehen: Es muss die **in Schritt 3 gewählte** Tonart stehen.
7. Gegenprobe auf dem zweiten Gerät (bzw. nach Ab- und Neuanmelden): Dort muss ebenfalls die neue
   Tonart erscheinen – dann ist sie wirklich auf dem Konto und nicht nur auf dem ersten Gerät.

**Zweiter Durchgang (kürzer):** Schritte 1–3 wiederholen, dann die App **sofort** wegwischen, ohne
eine halbe Sekunde zu warten. Auch das darf die Änderung nicht kosten (iOS friert dabei die
Sammel-Pause ein).

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/services/userSettings.ts`, `client/src/services/pendingKeys.ts`, `client/src/services/appHidden.ts`, `client/src/pages/ChordChart.tsx`
- **Automatisiert:** teilweise – `client/src/services/userSettings.pending.test.ts` (Merker, Abgleich-Schutz, Flush beim Weglegen) und `client/src/services/pendingKeys.test.ts`; von Hand bleiben der echte Flugmodus, das echte Beenden durch iOS und das Zusammenspiel zweier Geräte
- **Historie:** #275 (Vorbild: #245/#256 bei den Anmerkungen)

</details>
