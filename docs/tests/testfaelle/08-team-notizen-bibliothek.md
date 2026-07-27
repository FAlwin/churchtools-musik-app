# Team-Notizen, Lieder-Bibliothek, Versionen, Verwaltung

### TF-TEAM-01 · Fremde Notizen ansehen und übernehmen

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/useTeamNotesImport.ts`, `client/src/services/teamNotes.ts`, `client/src/components/PageTextLayer.tsx`, `client/src/utils/annotationKeys.ts`, `client/src/utils/strokes.ts`
- **Automatisiert:** teilweise – `client/src/services/annotations.keys.test.ts`, `client/src/utils/strokes.test.ts`
- **Historie:** #124

**Voraussetzung:** Zwei Konten; das zweite hat zu einem Lied Anmerkungen geteilt. Das eigene Konto
braucht das Team-Notizen-Recht.

1. Das Lied öffnen, „Notizen von …" wählen.
2. Die Vorschau „Zusammenführen" einschalten.
3. Übernehmen.
4. Eigene Tonart und Kapo prüfen.

**Erwartet:** In Schritt 1 erscheinen **deren** Anmerkungen, die eigenen sind ausgeblendet. Schritt 2
zeigt beide übereinander. Nach Schritt 3 ist deren Version aktiv und deren Spalten/Schrift
übernommen – **Tonart und Kapo bleiben die eigenen**.

### TF-TEAM-02 · Ohne Recht keine fremden Notizen

- **Priorität:** normal
- **Betrifft:** `server/src/services/churchtools.ts`, `server/src/controllers/teamNotesController.ts`, `client/src/pages/ChordChart.tsx`
- **Automatisiert:** teilweise – `server/src/services/churchtools.capabilities.test.ts`
- **Historie:** #149, #152

**Voraussetzung:** Ein Konto **ohne** Team-Notizen-Recht.

1. Ein Lied öffnen, bei dem jemand Notizen geteilt hat.

**Erwartet:** Der Punkt „Notizen von …" erscheint gar nicht erst. Keine Fehlermeldung, kein leeres
Menü.

### TF-LIB-01 · Lieder-Bibliothek: Suche, Filter, Statistik

- **Priorität:** normal
- **Betrifft:** `client/src/pages/Songs.tsx`, `client/src/utils/songFilter.ts`, `client/src/components/SongStatsBar.tsx`, `server/src/services/songUsage.ts`
- **Automatisiert:** teilweise – `client/src/utils/songFilter.test.ts`, `server/src/services/songUsage.test.ts`
- **Historie:** #157, #158

1. Bibliothek öffnen, nach einem Titelteil suchen.
2. Den Zeitraum-Filter umstellen (z. B. „letzte 12 Monate").
3. Ein Lied ansehen, das kürzlich gespielt wurde.

**Erwartet:** Die Suche findet auch bei Teiltreffern. Der Filter reduziert die Liste. Beim Lied
stehen letztes Spieldatum und Häufigkeit – **künftige** Termine zählen nicht mit.

### TF-LIB-02 · Lied direkt zum Ablauf hinzufügen

- **Priorität:** normal
- **Betrifft:** `client/src/components/AddToAgendaSheet.tsx`, `client/src/pages/Songs.tsx`, `server/src/services/agendaPayload.ts`
- **Automatisiert:** teilweise – `server/src/services/agendaPayload.test.ts`
- **Historie:** #15

**Voraussetzung:** Test-Termin.

1. In der Bibliothek ein Lied wählen, „Zum Ablauf hinzufügen".
2. Termin und Position wählen, bestätigen.
3. In ChurchTools nachsehen.

**Erwartet:** Der Punkt steht an der gewählten Stelle und ist ein **Lied-Punkt** mit Arrangement.

### TF-VER-01 · Eigene Version anlegen, bearbeiten, löschen

- **Priorität:** hoch
- **Betrifft:** `client/src/components/ChordEditor.tsx`, `client/src/components/ChordProInput.tsx`, `server/src/services/arrangementFiles.ts`, `server/src/services/setlistBuilder.ts`
- **Automatisiert:** teilweise – `server/src/services/setlistBuilder.test.ts` (Namensgebung, Erkennung)
- **Historie:** #37, #34

**Voraussetzung:** Ein Lied mit Bearbeitungsrecht.

1. Im Lied-Menü eine neue Version „Akustik" anlegen.
2. Im Editor eine Zeile ändern und speichern.
3. Das Chart ansehen.
4. Version umbenennen, dann löschen.

**Erwartet:** Die Version erscheint zur Auswahl, die Änderung steht im Chart. In ChurchTools liegt
eine Datei mit erkennbarem Namen („… — Akustik (App).chordpro"). Nach dem Löschen ist sie weg und die
App fällt aufs Original zurück.

### TF-VER-02 · Tastatur im ChordPro-Editor

- **Priorität:** normal
- **Betrifft:** `client/src/components/ChordEditor.tsx`, `client/src/hooks/useOverlayKeyboardInset.ts`
- **Automatisiert:** teilweise – `client/src/hooks/useOverlayKeyboardInset.test.tsx`
- **Historie:** #207

**Voraussetzung:** iPhone oder iPad.

1. Den Editor öffnen und in die Mitte des Textes tippen.
2. Mehrere Zeilen eintippen.

**Erwartet:** Die Schreibstelle bleibt über der Tastatur sichtbar. Nach dem Schließen sitzt die
Ansicht wieder normal.

### TF-ADMIN-01 · Verwaltung nur für Berechtigte

- **Priorität:** normal
- **Betrifft:** `client/src/pages/Settings.tsx`, `server/src/controllers/siteConfigController.ts`, `server/src/middleware/requireAdmin.ts`
- **Automatisiert:** teilweise – `server/src/controllers/siteConfigController.trim.test.ts`
- **Historie:** #152

**Voraussetzung:** Ein Konto **ohne** Admin-Recht.

1. Mit dem normalen Konto „Mehr" öffnen.
2. Mit einem Admin-Konto dasselbe.

**Erwartet:** Die Verwaltungs-Einstellungen erscheinen nur beim Admin. Beim normalen Konto sind sie
gar nicht sichtbar.

### TF-ADMIN-02 · Aktualisierungs-Hinweis

- **Priorität:** normal
- **Betrifft:** `client/src/hooks/useUpdateCheck.ts`, `client/src/components/UpdateBanner.tsx`, `server/src/services/updateCheck.ts`
- **Automatisiert:** teilweise – `server/src/services/updateCheck.test.ts`
- **Historie:** –

1. Nach einem Release die App öffnen.

**Erwartet:** Der Hinweis auf die neue Version erscheint und lädt auf Tipp neu. Danach zeigt „Mehr"
die neue Versionsnummer.
