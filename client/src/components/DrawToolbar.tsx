import { useEffect, useRef, useState } from 'react';
import type { DrawTool } from '../types/index';
import type { TextStyle, TextAlign } from '../hooks/usePageDraw';
import { Icon } from './icons';
import styles from './DrawToolbar.module.scss';

interface DrawToolbarProps {
  colors: string[];
  drawColor: string;
  setDrawColor: (c: string) => void;
  drawTool: DrawTool;
  setDrawTool: (t: DrawTool) => void;
  onClear: () => void;
  /** Text-Werkzeug anbieten? (PDF-Viewer: aktuell nur Freihand → false) */
  allowText?: boolean;
  textSize?: number;
  setTextSize?: (fn: (s: number) => number) => void;
  /** Schrittweite/Grenzen der Textgröße. */
  sizeStep?: number;
  sizeMin?: number;
  sizeMax?: number;
  /** Formatiert den (internen) Größenwert für die Anzeige – z. B. cqh → gerundete „pt". */
  sizeLabel?: (v: number) => string;
  /** Ist eine vorhandene Text-Anmerkung ausgewählt? Dann wirken Farbe/Größe auf sie. */
  isTextSelected?: boolean;
  selectedColor?: string;
  selectedSize?: number;
  onSelectedColor?: (c: string) => void;
  onSelectedResize?: (delta: number) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  onDeleteSelected?: () => void;
  /** Strichstärke je Werkzeug + Setter (erneuter Tipp auf das aktive Werkzeug öffnet die Auswahl). */
  toolSizes?: { pen: number; marker: number; eraser: number };
  onToolSize?: (tool: 'pen' | 'marker' | 'eraser', size: number) => void;
  /** Aktueller Pinsel-Stil für NEUEN Text + Setter. */
  textStyle?: TextStyle;
  setTextStyle?: (fn: (s: TextStyle) => TextStyle) => void;
  /** Stil des AUSGEWÄHLTEN Textes + Setter (wirkt dann live auf diesen). */
  selectedStyle?: TextStyle;
  onSelectedStyle?: (patch: Partial<TextStyle>) => void;
}

// Voreingestellte Strichstärken je Werkzeug (Canvas-Pixel bei Renderskala 2) – von fein bis
// richtig dick (Marker/Radierer bis „Flächen-Format").
const TOOL_SIZE_PRESETS: Record<'pen' | 'marker' | 'eraser', number[]> = {
  pen: [2, 3, 5, 10, 16],
  marker: [12, 18, 28, 44, 64],
  eraser: [16, 26, 44, 72, 110],
};

/**
 * Aufgeräumte, vertikale Werkzeugleiste für den Zeichenmodus (rechter Rand): ein Farbknopf mit
 * Aufklapp-Palette, dann Werkzeuge (Stift/Marker/Radierer/Text), Größe und Aktionen
 * (Rückgängig/Wiederholen/Löschen) – jeweils klar gruppiert, einheitliche Icons.
 * Ist ein platzierter Text ausgewählt, ändern Farbe und Größe genau diesen Text – live.
 */
export function DrawToolbar({
  colors,
  drawColor,
  setDrawColor,
  drawTool,
  setDrawTool,
  onClear,
  allowText = true,
  textSize = 20,
  setTextSize,
  sizeStep = 4,
  sizeMin = 12,
  sizeMax = 56,
  sizeLabel,
  isTextSelected = false,
  selectedColor,
  selectedSize,
  onSelectedColor,
  onSelectedResize,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onDeleteSelected,
  toolSizes,
  onToolSize,
  textStyle,
  setTextStyle,
  selectedStyle,
  onSelectedStyle,
}: DrawToolbarProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const colorWrapRef = useRef<HTMLDivElement>(null);
  // Aktuell „ausgeklapptes" Werkzeug (erneuter Tipp auf das aktive Werkzeug): bei Stift/Marker/
  // Radierer die Strichstärke, beim Text der Einstellungs-Balken.
  const [expandedTool, setExpandedTool] = useState<DrawTool | null>(null);
  const toolsRef = useRef<HTMLDivElement>(null);

  // Aktive Farbe/Größe: bei ausgewähltem Text dessen Werte, sonst die Voreinstellung.
  const activeColor = (isTextSelected ? selectedColor : drawColor) ?? drawColor;
  const isCustomColor = !!activeColor && !colors.includes(activeColor);
  const shownSize = isTextSelected ? (selectedSize ?? textSize) : textSize;
  const showUndo = !!onUndo;

  // Format (Fett/Kursiv/Unterstrichen/Ausrichtung): bei ausgewähltem Text dessen Stil, sonst der
  // Pinsel-Stil für neu platzierten Text.
  const activeStyle = (isTextSelected ? selectedStyle : textStyle) ?? textStyle;
  function toggleFmt(key: 'bold' | 'italic' | 'underline') {
    if (isTextSelected) onSelectedStyle?.({ [key]: !activeStyle?.[key] });
    else setTextStyle?.((s) => ({ ...s, [key]: !s[key] }));
  }
  function setAlign(align: TextAlign) {
    if (isTextSelected) onSelectedStyle?.({ align });
    else setTextStyle?.((s) => ({ ...s, align }));
  }

  // Palette bei Klick außerhalb schließen.
  useEffect(() => {
    if (!paletteOpen) return;
    const onDown = (e: PointerEvent) => {
      if (colorWrapRef.current && !colorWrapRef.current.contains(e.target as Node)) setPaletteOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [paletteOpen]);

  function pickColor(c: string) {
    if (isTextSelected) onSelectedColor?.(c);
    else setDrawColor(c);
    setPaletteOpen(false);
  }
  function changeSize(delta: number) {
    if (isTextSelected) onSelectedResize?.(delta);
    else setTextSize?.((s) => Math.max(sizeMin, Math.min(sizeMax, s + delta)));
  }
  // Werkzeug wählen. Einheitlich für ALLE Werkzeuge: erster Tipp aktiviert das Werkzeug, ein
  // erneuter Tipp auf das AKTIVE Werkzeug klappt seine Einstellungen auf/zu (Strichstärke bei
  // Stift/Marker/Radierer, Einstellungs-Balken beim Text).
  function chooseTool(t: DrawTool) {
    if (t === drawTool) {
      setExpandedTool((cur) => (cur === t ? null : t));
      return;
    }
    setDrawTool(t);
    setExpandedTool(null);
  }

  // Wird ein Text auf der Seite ausgewählt, den Einstellungs-Balken automatisch öffnen (damit man
  // ihn sofort formatieren kann) – analog zum zweiten Tipp aufs Text-Werkzeug.
  useEffect(() => {
    if (isTextSelected) setExpandedTool('text');
  }, [isTextSelected]);

  // Strichstärke-Popover bei Klick außerhalb schließen. Der Text-Balken bleibt bewusst offen (er
  // wird nur per Toggle am Text-Werkzeug oder Werkzeugwechsel geschlossen).
  useEffect(() => {
    if (!expandedTool || expandedTool === 'text') return;
    const onDown = (e: PointerEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setExpandedTool(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [expandedTool]);

  return (
    <div className={styles.toolbar}>
      {/* Farbe: ein Knopf zeigt die aktuelle Farbe, Tippen öffnet die Palette. */}
      <div className={styles.colorWrap} ref={colorWrapRef}>
        <button
          className={`${styles.colorBtn} ${styles.expandable}`}
          style={{ background: activeColor }}
          onClick={() => setPaletteOpen((v) => !v)}
          aria-label="Farbe wählen"
          aria-expanded={paletteOpen}
        />
        {paletteOpen && (
          <div className={styles.palette}>
            {colors.map((c) => (
              <button
                key={c}
                className={`${styles.swatch}${activeColor === c ? ' ' + styles.swatchOn : ''}`}
                style={{ background: c }}
                onClick={() => pickColor(c)}
                aria-label={`Farbe ${c}`}
              />
            ))}
            <label
              className={`${styles.swatch} ${styles.swatchCustom}${isCustomColor ? ' ' + styles.swatchOn : ''}`}
              title="Eigene Farbe"
              style={isCustomColor && activeColor ? { background: activeColor } : undefined}
            >
              {/* „+" bleibt IMMER sichtbar → auch bei aktiver eigener Farbe erkennbar als Wähler. */}
              <Icon name="plus" size={18} stroke={2.4} className={styles.customPlus} />
              <input
                type="color"
                aria-label="Eigene Farbe wählen"
                value={isCustomColor && activeColor ? activeColor : '#888888'}
                onChange={(e) => pickColor(e.target.value)}
              />
            </label>
          </div>
        )}
      </div>

      <div className={styles.sep} />

      {/* Werkzeuge – jedes in einem Slot, damit sein Popover genau auf SEINER Höhe links ausklappt.
          Erneuter Tipp auf das aktive Zeichenwerkzeug öffnet die Strichstärke; das Text-Werkzeug
          zeigt seine Einstellungen (Größe/Format) als horizontalen Balken. */}
      <div className={styles.toolsGroup} ref={toolsRef}>
        {(['pen', 'marker', 'eraser'] as const).map((t) => (
          <div key={t} className={styles.toolSlot}>
            <button
              className={`${styles.toolBtn} ${styles.expandable}${drawTool === t ? ' ' + styles.on : ''}`}
              onClick={() => chooseTool(t)}
              title={t === 'pen' ? 'Stift' : t === 'marker' ? 'Marker' : 'Radierer'}
              aria-label={t === 'pen' ? 'Stift' : t === 'marker' ? 'Marker' : 'Radierer'}
            >
              <Icon name={t === 'pen' ? 'pencil' : t === 'marker' ? 'marker' : 'eraser'} size={20} stroke={2} />
            </button>
            {/* Strichstärke-Popover – klappt auf Höhe GENAU dieses Werkzeugs nach links auf. */}
            {expandedTool === t && toolSizes && onToolSize && (
              <div className={styles.sizePopover}>
                {TOOL_SIZE_PRESETS[t].map((sz) => {
                  const active = toolSizes[t] === sz;
                  // Wurzel-Skala: auch die dicken Stufen (bis 110) bleiben als Punkt im Knopf
                  // darstellbar und trotzdem klar voneinander unterscheidbar.
                  const dot = Math.max(5, Math.min(30, Math.round(3.2 * Math.sqrt(sz))));
                  return (
                    <button
                      key={sz}
                      className={`${styles.sizeOpt}${active ? ' ' + styles.sizeOptOn : ''}`}
                      onClick={() => {
                        onToolSize(t, sz);
                        setExpandedTool(null);
                      }}
                      aria-label={`Stärke ${sz}`}
                    >
                      <span className={styles.sizeDot} style={{ width: dot, height: dot }} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {allowText && (
          <div className={styles.toolSlot}>
            <button
              className={`${styles.toolBtn} ${styles.expandable}${drawTool === 'text' ? ' ' + styles.on : ''}`}
              onClick={() => chooseTool('text')}
              title="Text"
              aria-label="Text"
            >
              <Icon name="type" size={20} stroke={2} />
            </button>
            {/* Text-Einstellungen als horizontaler Balken links neben dem Text-Werkzeug:
                Größe · Fett/Kursiv/Unterstrichen · Ausrichtung. */}
            {expandedTool === 'text' && activeStyle && (
              <div className={styles.textPopover}>
                <button
                  className={styles.toolBtn}
                  onClick={() => changeSize(-sizeStep)}
                  title="Kleiner"
                  aria-label="Kleiner"
                >
                  <span className={styles.sizeBtnLabel}>A−</span>
                </button>
                <span className={styles.sizeValue}>{sizeLabel ? sizeLabel(shownSize) : Math.round(shownSize)}</span>
                <button
                  className={styles.toolBtn}
                  onClick={() => changeSize(sizeStep)}
                  title="Größer"
                  aria-label="Größer"
                >
                  <span className={styles.sizeBtnLabel}>A+</span>
                </button>
                <div className={styles.vsep} />
                <button
                  className={`${styles.toolBtn}${activeStyle.bold ? ' ' + styles.on : ''}`}
                  onClick={() => toggleFmt('bold')}
                  title="Fett"
                  aria-label="Fett"
                  aria-pressed={activeStyle.bold}
                >
                  <span className={styles.fmtLabel} style={{ fontWeight: 800 }}>
                    B
                  </span>
                </button>
                <button
                  className={`${styles.toolBtn}${activeStyle.italic ? ' ' + styles.on : ''}`}
                  onClick={() => toggleFmt('italic')}
                  title="Kursiv"
                  aria-label="Kursiv"
                  aria-pressed={activeStyle.italic}
                >
                  <span className={styles.fmtLabel} style={{ fontStyle: 'italic', fontWeight: 600 }}>
                    I
                  </span>
                </button>
                <button
                  className={`${styles.toolBtn}${activeStyle.underline ? ' ' + styles.on : ''}`}
                  onClick={() => toggleFmt('underline')}
                  title="Unterstrichen"
                  aria-label="Unterstrichen"
                  aria-pressed={activeStyle.underline}
                >
                  <span className={styles.fmtLabel} style={{ textDecoration: 'underline', fontWeight: 600 }}>
                    U
                  </span>
                </button>
                <div className={styles.vsep} />
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button
                    key={a}
                    className={`${styles.toolBtn}${activeStyle.align === a ? ' ' + styles.on : ''}`}
                    onClick={() => setAlign(a)}
                    title={a === 'left' ? 'Linksbündig' : a === 'center' ? 'Zentriert' : 'Rechtsbündig'}
                    aria-label={a === 'left' ? 'Linksbündig' : a === 'center' ? 'Zentriert' : 'Rechtsbündig'}
                    aria-pressed={activeStyle.align === a}
                  >
                    <Icon name={`align-${a}` as 'align-left' | 'align-center' | 'align-right'} size={19} stroke={2} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Aktionen */}
      <div className={styles.sep} />
      {isTextSelected && onDeleteSelected && (
        <button className={styles.toolBtn} onClick={onDeleteSelected} title="Text löschen" aria-label="Text löschen">
          <Icon name="trash" size={19} stroke={2} />
        </button>
      )}
      {showUndo && (
        <>
          <button className={styles.toolBtn} onClick={onUndo} disabled={!canUndo} title="Rückgängig" aria-label="Rückgängig">
            <Icon name="undo" size={19} stroke={2} />
          </button>
          <button className={styles.toolBtn} onClick={onRedo} disabled={!canRedo} title="Wiederherstellen" aria-label="Wiederherstellen">
            <Icon name="redo" size={19} stroke={2} />
          </button>
        </>
      )}
      <button className={styles.clear} onClick={onClear} title="Alles löschen" aria-label="Alles löschen">
        <Icon name="trash" size={19} stroke={2} />
      </button>
    </div>
  );
}
