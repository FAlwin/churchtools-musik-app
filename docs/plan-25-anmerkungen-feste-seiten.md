# Plan #25 – Anmerkungen auf festen, skalierbaren Seiten (großer Umbau)

> Entwurf zur Abstimmung. Noch **nicht** umgesetzt. Bezieht sich auf Issue #25
> (und schafft die Basis für #20 „zwei Seiten im Querformat" und #26 „Animation").

## Ziel
Anmerkungen (Striche + Text) sollen sich **wie ein Bild** verhalten: sie kleben am Inhalt,
skalieren und zoomen mit ihm und brechen weder im Querformat noch bei Zoom. Die heutige
Sperre („erst Anmerkungen löschen") für die Ausrichtung entfällt.

## Warum heute kaputt
- Anmerkungen werden in **absoluten Pixeln** gespeichert (bezogen auf die momentane Canvas-Größe
  `body-Höhe × content-Breite`, `useDrawing.ts` `fitCanvas`/`getCanvasPt`, Text-`x/y` in `types/index.ts`).
- Der Chart ist ein **fließendes Spalten-Layout** (`ChordChart.tsx` `.content` multicol +
  `usePagedColumns.ts`). Schrift, Spaltenzahl **und Ausrichtung** ändern den Textfluss → andere
  Spaltenumbrüche → die gespeicherten Pixel zeigen ins Leere.
- Deshalb: Sperre bei `drawing.hasAnnotations` (`ChordChart.tsx` Lock-Overlay).

## Zielarchitektur: feste Seiten, skaliert auf den Bildschirm (wie der PDF-Viewer)
Vorbild ist bereits im Code: `DocumentView.tsx` rendert eine **feste Seite** und skaliert sie samt
Anmerkungs-Canvas mit `react-zoom-pan-pinch`. Dasselbe Prinzip für den Chord-Chart:

1. **Referenz-Seite mit fester Geometrie.** Der Akkord-Inhalt wird in eine Seite mit **fester
   Breite/Höhe** gesetzt (abgeleitet aus dem Hochformat bei der gewählten Schrift → Hochformat
   bleibt 1:1 wie heute). Innerhalb dieser festen Seite weiterhin Spalten – aber die Aufteilung
   hängt **nicht mehr vom Viewport** ab, sondern nur von Schrift + Spaltenwahl.
2. **Skalieren statt umbrechen.** Statt bei Rotation/Resize neu umzubrechen, wird die feste Seite
   per `transform: scale(s)` auf den Bildschirm eingepasst:
   - Hochformat: `scale = 1` (sieht aus wie heute).
   - Querformat: Seite auf Höhe einpassen – und/oder **zwei Seiten nebeneinander** (löst #20).
3. **Anmerkungen im Seiten-Koordinatensystem.** Striche und Text liegen **innerhalb** des skalierten
   Seiten-Containers. Dadurch skalieren/zoomen sie automatisch mit – **keine Koordinaten-Mathematik,
   keine Drift, keine Sperre**.
4. **Zoom** (optional, Phase 3): Pinch-Zoom wie im Dokument-Viewer (Dependency `react-zoom-pan-pinch`
   ist bereits vorhanden).

## Datenmodell (neu)
- Anmerkungen werden **pro Seite** und in **seiten-relativen Koordinaten** gespeichert
  (Seitenindex + `x/y` in festen Seiteneinheiten, nicht in Viewport-Pixeln).
- Striche: pro Seite eine Canvas (wie `DocumentView` es mit `worship_docdraw_${fileId}_${pageIndex}`
  schon macht) → Key z. B. `worship_draw_${songId}_p${pageIndex}_v2`.
- Text: `TextAnnotation` bekommt `pageIndex`; `x/y` beziehen sich auf die feste Seite.
- **Versionierter Key (`_v2`)**, damit alte und neue Daten sich nicht vermischen.

## Migration bestehender Anmerkungen — ENTSCHIEDEN: verwerfen + Hinweis
Alte Anmerkungen sind pixelbasiert auf einer Geometrie, die es nach dem Umbau nicht mehr gibt →
eine verlässliche Umrechnung ist nicht möglich.
- **Festgelegt:** Alte Anmerkungen beim ersten Start des neuen Stands **einmalig verwerfen** (alte
  localStorage-Keys aufräumen) + dezenter, einmaliger Hinweis. Anmerkungen sind ohnehin lokal, pro
  Gerät und meist nur für einen Gottesdienst gedacht.

## Verhalten bei Schrift-/Spaltenwechsel mit vorhandenen Anmerkungen — ENTSCHIEDEN
- **Ausrichtung + Zoom: immer frei** (das war der Hauptschmerz) – kein Lock mehr.
- **Schrift/Spalten: weiterhin gesperrt**, solange Anmerkungen existieren (harte Sperre wie heute,
  aber nur noch für Schrift/Spalten – NICHT mehr für die Ausrichtung). Das hält das Seiten-Layout
  für annotierte Lieder stabil und vermeidet Drift bei bewussten Layout-Änderungen.

## Umsetzung in Phasen (jede Phase einzeln auf der Test-Instanz prüfbar)
**Phase 1 – Feste Seite + Skalieren (Kern, höchstes Risiko).**
- `ChordChart`-Render von „viewport-fließend" auf „feste Referenz-Seite, per `scale` eingepasst" umstellen.
- Blättern beibehalten (eine feste Seite pro Blätter-Takt). `usePagedColumns` entweder anpassen
  (feste statt viewport-abhängige Geometrie) oder durch eine einfachere, viewport-unabhängige
  Seitenrechnung ersetzen.
- Akzeptanz: Hoch- und Querformat lesbar, Blättern korrekt, **ohne** Anmerkungen.

**Phase 2 – Anmerkungen ins Seiten-Koordinatensystem.**
- `useDrawing` auf pro-Seite-Canvas + seiten-relative Text-Koordinaten umstellen (Vorbild `DocumentView`).
- Lock-Overlay entfernen/abschwächen, Migration alter Daten umsetzen.
- Akzeptanz: zeichnen, drehen, blättern – Anmerkungen bleiben an Ort & Stelle und skalieren mit.

**Phase 3 – Kür (optional, separate Issues).**
- Pinch-Zoom für den Chart (#25-Zusatz).
- Zwei Seiten nebeneinander im Querformat (#20).
- Anmerkungen laufen bei der Seitenwechsel-Animation mit (#26) – ergibt sich großteils automatisch,
  da Anmerkungen jetzt Teil der skalierten Seite sind.

## Betroffene Dateien (Schätzung)
- `client/src/pages/ChordChart.tsx` (Render, Skalierung, Blättern) – **groß**
- `client/src/pages/ChordChart.module.scss` (Seiten-/Skalier-Layout) – mittel
- `client/src/hooks/usePagedColumns.ts` (feste statt viewport-abhängige Geometrie) – mittel/groß
- `client/src/hooks/useDrawing.ts` (pro-Seite, relative Koordinaten, Migration) – **groß**
- `client/src/types/index.ts` (`TextAnnotation.pageIndex`, evtl. relative Maße) – klein
- `client/src/components/DrawToolbar.tsx` – voraussichtlich unverändert
- Tests: neue Unit-Tests für die Koordinaten-/Seiten-Logik; bestehende Render-Tests grün halten.

## Risiken
- Die WebKit-Pagination (iPad/Safari) ist heikel; der Umbau berührt genau diese Stelle.
- „Feste Seite skaliert" kann im Hochformat anders wirken, wenn die Referenzgröße schlecht gewählt ist
  → Referenz aus dem Hochformat ableiten, damit Hochformat 1:1 bleibt.
- Migration: alte Anmerkungen gehen (bewusst) verloren.
- Umfang: mehrere Sessions; strikt test-first (Test-Instanz :3002), Prod erst nach Abnahme.

## Getroffene Entscheidungen (22.06.2026)
1. Migration alter Anmerkungen: **verwerfen + einmaliger Hinweis**.
2. Schrift/Spalten bei vorhandenen Anmerkungen: **weiterhin sperren**; Ausrichtung + Zoom werden frei.
3. Querformat in Phase 1: **eine Seite eingepasst**; zwei Seiten (#20) erst in Phase 3.
4. Start: Plan erst festhalten/committen; Umsetzung (Phase 1) **später**, nachdem #24/#21 fertig getestet sind.

## Status
Geplant, **noch nicht begonnen**. Nächster Schritt bei Wiederaufnahme: Phase 1 (feste Seite + Skalieren).
