# Lied-Einstellungen (Tonart, Kapo, Darstellung, Versionen)

Die Regel, an der hier alles hängt: Fast alles gilt **pro Version**, aber die gewählte Version selbst
und die Anzeigequelle gelten **pro Lied**.

### TF-EINST-01 · Tonart und Kapo ändern

- **Priorität:** kritisch
- **Betrifft:** `client/src/hooks/useSongSettings.ts`, `client/src/utils/transpose.ts`, `client/src/components/KeyPicker.tsx`, `client/src/components/CapoPicker.tsx`, `client/src/utils/chordPdf.ts`
- **Automatisiert:** teilweise – `client/src/utils/transpose.test.ts`, `client/src/hooks/useSongSettings.test.tsx` (Speichern), Darstellung nicht
- **Historie:** –

1. Ein Lied öffnen, die Tonart zwei Halbtöne höher setzen.
2. Kapo auf 2 setzen.

**Erwartet:** Alle Akkorde stehen in der neuen Tonart, auch Bass-Akkorde wie `E/G#`. Der Kapo
verschiebt die **Griffe** entsprechend; die Kopfzeile zeigt beides an.

### TF-EINST-02 · Einstellungen gelten pro Version

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/useSongSettings.ts`, `client/src/utils/songVersions.ts`, `client/src/utils/chartSettings.ts`
- **Automatisiert:** ja – `client/src/hooks/useSongSettings.test.tsx`
- **Historie:** –

**Voraussetzung:** Ein Lied mit mindestens zwei Fassungen (Original + eigene Version).

1. Im **Original**: Tonart ändern, Kapo 2, zwei Spalten.
2. Auf die **zweite Version** wechseln.
3. Dort Kapo 4 und eine Spalte setzen.
4. Zurück zum **Original**.

**Erwartet:** Schritt 2 zeigt die eigenen (unberührten) Werte der zweiten Version. Nach Schritt 4
sind Tonart, Kapo 2 und zwei Spalten **unverändert** da.

### TF-EINST-03 · Version und Anzeigequelle gelten fürs ganze Lied

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/useSongSettings.ts`, `client/src/utils/songVersions.ts`, `client/src/utils/chartSettings.ts`
- **Automatisiert:** ja – `client/src/hooks/useSongSettings.test.tsx`
- **Historie:** –

**Voraussetzung:** Ein Lied mit hochgeladenem PDF **und** mehreren Fassungen.

1. Auf das PDF umschalten.
2. Die Version wechseln.
3. App schließen und neu öffnen, dasselbe Lied.

**Erwartet:** Nach Schritt 2 bleibt das **PDF** angezeigt. Nach Schritt 3 sind dieselbe Version und
dieselbe Anzeigequelle wieder aktiv.

### TF-EINST-04 · Spalten, Schriftgröße, „Nur Text"

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/useSongSettings.ts`, `client/src/utils/chordPdf.ts`, `client/src/utils/chartPdfOptions.ts`
- **Automatisiert:** teilweise – `client/src/utils/chordPdf.test.ts` (Seitenzahl je Spalten/Größe)
- **Historie:** –

1. Auf zwei Spalten umschalten.
2. Schriftgröße vergrößern und verkleinern.
3. „Nur Text" einschalten.

**Erwartet:** Zwei Spalten brauchen weniger Seiten, größere Schrift mehr. „Nur Text" blendet die
Akkorde aus und behält den Liedtext. Die Seitenanzeige unten zählt entsprechend mit.

### TF-EINST-05 · Einzelne Abschnitte transponieren

- **Priorität:** normal
- **Betrifft:** `client/src/components/SectionTransposeSheet.tsx`, `client/src/utils/chartSettings.ts`, `client/src/hooks/useSongSettings.ts`, `client/src/utils/chordPdf.ts`
- **Automatisiert:** nein – Zusammenspiel Auswahl + Darstellung
- **Historie:** #16

1. Im Lied-Menü „Abschnitte transponieren" öffnen.
2. Nur den **Refrain** zwei Halbtöne höher setzen.
3. Speichern und das Chart ansehen.
4. Auf 0 zurücksetzen.

**Erwartet:** Nur der Refrain steht höher, die Verse bleiben. Nach dem Zurücksetzen ist alles wieder
einheitlich – und die Einstellung ist danach nicht mehr gespeichert.

### TF-EINST-06 · Einstellungen sind auf dem zweiten Gerät da

- **Priorität:** hoch
- **Betrifft:** `client/src/services/userSettings.ts`, `server/src/services/userSettings.ts`, `server/src/controllers/userSettingsController.ts`
- **Automatisiert:** teilweise – `server/src/services/userSettings.test.ts` (Grenzen, Schlüssel-Filter)
- **Historie:** #195, #213

**Voraussetzung:** Zwei Geräte am selben Konto.

1. Auf Gerät A bei drei Liedern Tonart, Kapo und Schriftgröße ändern.
2. Auf Gerät B die App neu laden und dieselben Lieder öffnen.

**Erwartet:** Alle drei Lieder sehen auf B genauso aus. Auch die versionsbezogenen Werte kommen mit –
nicht nur die des Originals.
