import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Coachmarks.module.scss';

/** Ein Schritt der Einführung: hebt das per `selector` gefundene Element hervor und erklärt es. */
export interface CoachStep {
  /** CSS-Selektor des Ziel-Elements (i. d. R. ein `[data-tour="…"]`). */
  selector: string;
  title: string;
  body: string;
}

interface CoachmarksProps {
  steps: CoachStep[];
  /** Wird aufgerufen, wenn die Tour beendet ist (durchlaufen ODER übersprungen). */
  onClose: () => void;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6; // Abstand des Highlight-Rahmens ums Element
const GAP = 12; // Abstand der Sprechblase zum Element

/**
 * Geführte Einführung mit Spotlight-Hinweisblasen (#Onboarding). Dunkelt den Bildschirm ab, hebt
 * das jeweilige Element aus (Loch via großem box-shadow) und zeigt eine Blase mit Erklärung +
 * „Weiter"/„Überspringen". Elemente werden per Selektor gesucht – fehlt eins (z. B. kein Offline-
 * Symbol, weil nichts gespeichert ist), wird der Schritt automatisch übersprungen. Robust ohne
 * erzwungene Navigation: die Tour läuft dort, wo der Nutzer gerade ist.
 */
export function Coachmarks({ steps, onClose }: CoachmarksProps) {
  const [idx, setIdx] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const closedRef = useRef(false);

  // Ziel des aktuellen Schritts vermessen; nicht gefundene Schritte überspringen. useLayoutEffect,
  // damit die Blase vor dem ersten Frame korrekt sitzt (kein Springen).
  useLayoutEffect(() => {
    if (closedRef.current) return;
    let cur = idx;
    let el: HTMLElement | null = null;
    while (cur < steps.length) {
      el = document.querySelector<HTMLElement>(steps[cur].selector);
      if (el) break;
      cur++;
    }
    if (cur >= steps.length || !el) {
      close();
      return;
    }
    if (cur !== idx) {
      setIdx(cur);
      return;
    }
    // `nearest` statt `center`: schon sichtbare Ziele werden NICHT gescrollt. `center` zentrierte
    // z. B. die Tab-Leiste (unten) und schob dabei den ganzen Viewport nach oben – dieser Versatz
    // blieb und schlug auf die danach geöffnete Ansicht durch („oben abgeschnitten").
    el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    const r = el.getBoundingClientRect();
    setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, steps]);

  // Beim Drehen/Größenänderung neu vermessen (sonst sitzt das Highlight daneben).
  useEffect(() => {
    function remeasure() {
      const el = document.querySelector<HTMLElement>(steps[idx]?.selector ?? '');
      if (!el) return;
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
    window.addEventListener('resize', remeasure);
    window.addEventListener('orientationchange', remeasure);
    return () => {
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('orientationchange', remeasure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, steps]);

  function close() {
    if (closedRef.current) return;
    closedRef.current = true;
    // Sicherheitsnetz: einen etwaigen Viewport-Versatz (durch scrollIntoView) zurücksetzen, bevor
    // die App weiterrendert/navigiert – sonst startet die nächste Ansicht verschoben.
    if (window.scrollY !== 0) window.scrollTo(0, 0);
    onClose();
  }
  function next() {
    if (idx + 1 >= steps.length) close();
    else setIdx(idx + 1);
  }

  if (!box) return null;
  const step = steps[idx];
  const vh = window.innerHeight;
  // Blase über oder unter das Element setzen – je nachdem, wo mehr Platz ist.
  const below = box.top + box.height / 2 < vh / 2;
  const bubbleStyle = below
    ? { top: box.top + box.height + PAD + GAP }
    : { bottom: vh - box.top + PAD + GAP };

  return createPortal(
    <div className={styles.root} role="dialog" aria-modal="true">
      {/* Spotlight: transparentes Rechteck ums Ziel, riesiger box-shadow dunkelt den Rest ab. */}
      <div
        className={styles.hole}
        style={{
          top: box.top - PAD,
          left: box.left - PAD,
          width: box.width + PAD * 2,
          height: box.height + PAD * 2,
        }}
      />
      <div className={styles.bubble} style={bubbleStyle}>
        <div className={styles.title}>{step.title}</div>
        <div className={styles.body}>{step.body}</div>
        <div className={styles.foot}>
          <span className={styles.count}>
            Schritt {idx + 1} von {steps.length}
          </span>
          <div className={styles.actions}>
            <button className={styles.skip} onClick={close}>
              Überspringen
            </button>
            <button className={styles.next} onClick={next}>
              {idx + 1 >= steps.length ? 'Fertig' : 'Weiter'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
