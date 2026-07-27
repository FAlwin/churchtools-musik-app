import type { DrawTool } from '../types/index';
import type { usePageDraw, TextStyle } from '../hooks/usePageDraw';
import { textStyleOf } from '../utils/textObjStyle';
import { DrawToolbar } from './DrawToolbar';

type PageDraw = ReturnType<typeof usePageDraw>;

interface PageDrawToolbarProps {
  /** Anmerkungs-Zustand der AKTIVEN Seite – auf die wirken alle Knöpfe. */
  activeDraw: PageDraw;
  /** Beide sichtbaren Seiten – ein Werkzeugwechsel räumt auf allen auf (#39). */
  draws: PageDraw[];
  drawColors: string[];
  drawColor: string;
  setDrawColor: (c: string) => void;
  drawTool: DrawTool;
  setDrawTool: (t: DrawTool) => void;
  toolSizes: { pen: number; marker: number; eraser: number };
  setToolSizes: (fn: (s: { pen: number; marker: number; eraser: number }) => {
    pen: number;
    marker: number;
    eraser: number;
  }) => void;
  textSize: number;
  setTextSize: (fn: (s: number) => number) => void;
  textStyle: TextStyle;
  setTextStyle: (fn: (s: TextStyle) => TextStyle) => void;
  /** „Alles löschen" – die Rückfrage stellt der Eltern-Screen. */
  onClear: () => void;
}

/**
 * Verdrahtet die Werkzeugleiste mit den Anmerkungen der aktiven Seite (#193 – vorher ~60 Zeilen
 * Prop-Verkabelung mitten in `PageDeck`).
 *
 * Die eigentliche Leiste (`DrawToolbar`) ist bewusst „dumm": Sie kennt nur Farben, Werkzeuge und
 * Größen. Hier steht, was diese Bedienung für die Seite bedeutet – vor allem die beiden Regeln,
 * die sonst leicht verloren gehen: Ein Werkzeugwechsel beendet offene Textbearbeitungen auf
 * ALLEN Seiten (#39), und Format-/Farb-/Größen-Knöpfe wirken direkt auf einen ausgewählten Text
 * statt nur auf den „Pinsel" für den nächsten.
 */
export function PageDrawToolbar({
  activeDraw,
  draws,
  drawColors,
  drawColor,
  setDrawColor,
  drawTool,
  setDrawTool,
  toolSizes,
  setToolSizes,
  textSize,
  setTextSize,
  textStyle,
  setTextStyle,
  onClear,
}: PageDrawToolbarProps) {
  const selected = activeDraw.texts.find((o) => o.id === activeDraw.selectedId) ?? null;
  /** Führt eine Aktion nur aus, wenn wirklich ein Text ausgewählt ist. */
  const withSelected = (fn: (id: number) => void) => () => {
    if (activeDraw.selectedId !== null) fn(activeDraw.selectedId);
  };

  return (
    <DrawToolbar
      colors={drawColors}
      drawColor={drawColor}
      setDrawColor={setDrawColor}
      drawTool={drawTool}
      setDrawTool={(t) => {
        // Werkzeugwechsel (z. B. auf den Stift) beendet eine offene Textbearbeitung und hebt die
        // Auswahl auf – auf allen Seiten, damit keine UI hängen bleibt (#39).
        for (const d of draws) {
          d.cancelText();
          d.setSelectedId(null);
        }
        setDrawTool(t);
      }}
      toolSizes={toolSizes}
      onToolSize={(tool, size) => setToolSizes((s) => ({ ...s, [tool]: size }))}
      textSize={textSize}
      setTextSize={setTextSize}
      sizeStep={0.25}
      sizeMin={1}
      sizeMax={10}
      // Anzeige als vertraute „pt"-Zahl (A4-Höhe ≈ 842 pt → pt ≈ cqh × 8,42), gerundet.
      sizeLabel={(v) => `${Math.round(v * 8.42)}`}
      allowText
      onClear={onClear}
      isTextSelected={activeDraw.selectedId !== null}
      selectedColor={selected?.color}
      selectedSize={selected?.sizeCqh}
      onSelectedColor={(c) => withSelected((id) => activeDraw.setColor(id, c))()}
      onSelectedResize={(delta) => withSelected((id) => activeDraw.resize(id, delta))()}
      textStyle={textStyle}
      setTextStyle={setTextStyle}
      selectedStyle={selected ? textStyleOf(selected) : undefined}
      onSelectedStyle={(patch) => withSelected((id) => activeDraw.setStyle(id, patch))()}
      onUndo={activeDraw.undo}
      canUndo={activeDraw.canUndo}
      onRedo={activeDraw.redo}
      canRedo={activeDraw.canRedo}
      onDeleteSelected={withSelected((id) => activeDraw.deleteText(id))}
    />
  );
}
