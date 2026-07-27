import type { MutableRefObject } from 'react';
import type { SlideSlot } from '../hooks/useSlideTransition';
import { textObjStyle } from '../utils/textObjStyle';
import styles from './PageDeck.module.scss';

interface SlidePanesProps {
  /** Laufender Übergang – `tick` erzwingt frische Ebenen bei schnellem Blättern. */
  slide: { dir: 1 | -1; tick: number };
  panes: { old: SlideSlot[]; neu: SlideSlot[] };
  perView: number;
  /** Das Overlay selbst – `useSlideTransition` animiert es. */
  overlayRef: MutableRefObject<HTMLDivElement | null>;
}

/**
 * Slide-Übergang beim Blättern: deckt die Live-Ansicht ab und schiebt alte und neue Seiten
 * horizontal (wie im Foto-Viewer). Nicht interaktiv (#193 – vorher inline in `PageDeck`).
 *
 * Die Seiten kommen als fertige Canvas aus `composePane` und werden per Ref eingehängt; die Texte
 * werden mit **exakt demselben** Stil wie in der Live-Ansicht gerendert (`textObjStyle`) – sonst
 * springt der Text im Moment des Übergangs sichtbar (#113).
 */
export function SlidePanes({ slide, panes, perView, overlayRef }: SlidePanesProps) {
  return (
    <div ref={overlayRef} className={styles.slideOverlay} aria-hidden="true">
      {[
        { pk: 'old', pane: panes.old },
        { pk: 'neu', pane: panes.neu },
      ].map(({ pk, pane }) => (
        // key mit tick: Startet ein neuer Übergang, WÄHREND der alte noch läuft (schnelles
        // Tastatur-Blättern), werden die Ebenen frisch aufgebaut statt wiederverwendet. Sonst
        // bliebe die alte Seiten-Grafik im DOM liegen (der Einfüge-Ref entfernt sie nicht) und
        // deckte als späteres Geschwister die neue ab → altes Lied blitzte auf.
        <div key={`${pk}${slide.tick}`} data-pane={pk} className={styles.slidePane}>
          {pane.length === 2 && <div className={styles.divider} />}
          <div className={styles.row}>
            {pane.map((s, j) => (
              <div key={j} className={styles.slot}>
                <div
                  className={styles.slideContent}
                  style={
                    s.zoom
                      ? {
                          transform: `translate3d(${s.zoom.x}px, ${s.zoom.y}px, 0) scale(${s.zoom.scale})`,
                          transformOrigin: '0 0',
                        }
                      : undefined
                  }
                >
                  <div
                    className={styles.pageBox}
                    style={{
                      justifyItems: perView === 2 && pane.length === 1 ? 'start' : 'center',
                    }}
                    ref={(n) => {
                      if (n && s.canvas.parentElement !== n) {
                        s.canvas.className = styles.contentCanvas;
                        n.insertBefore(s.canvas, n.firstChild);
                      }
                    }}
                  >
                    <div
                      data-slide-textlayer
                      className={styles.textLayer}
                      style={{ aspectRatio: s.aspect }}
                    >
                      {s.texts.map((o) => (
                        <div key={o.id} className={styles.textObj} style={textObjStyle(o)}>
                          {o.text}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
