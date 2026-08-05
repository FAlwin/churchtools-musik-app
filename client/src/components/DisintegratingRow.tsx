/**
 * Zeile eines ENTFERNTEN Ablaufpunkts (#161 Etappe B, ausgelagert mit #198).
 *
 * Warum so aufwendig: Ein Punkt, der einfach verschwindet, sieht wie ein Fehler aus – man fragt
 * sich, ob man sich verklickt hat. Deshalb bleibt die Zeile kurz durchgestrichen lesbar und
 * zerfällt dann sichtbar („poof" wie in iOS): Die Zeile wird abfotografiert, in Partikel zerlegt
 * (`utils/disintegrate`) und die echte Zeile fällt zusammen.
 *
 * `html2canvas` wird erst hier dynamisch geladen – es ist groß und wird nur für diesen Moment
 * gebraucht. Fällt es aus, wird die Zeile einfach ausgeblendet; die Anzeige bleibt korrekt.
 */
import { useEffect, useRef, useState } from 'react';
import { disintegrate } from '../utils/disintegrate';
import styles from '../pages/Setlist.module.scss';

/**
 * „Voller Ablauf": alle Punkte mit Uhrzeit, Dauer, Notiz und Zuständigen (wie in ChurchTools,
 * aber aufgeräumt). Lieder sind antippbar (→ Charts). Die Uhrzeit (`item.time`) ist bereits
 * serverseitig korrekt: in ChurchTools ausgeblendete Punkte (Auge) liefern keine Zeit.
 */
/**
 * Zeile eines entfernten Ablaufpunkts (#161 Etappe B): kurz durchgestrichen sichtbar, dann
 * „poof"-Zerfall à la iOS – die Zeile wird abfotografiert, in Partikel zerlegt (utils/disintegrate)
 * und die echte Zeile fällt zusammen. Fällt html2canvas aus, wird einfach ausgeblendet.
 */
export function DisintegratingRow({ title }: { title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    // Reduzierte Bewegung: kein Effekt, direkt zusammenfalten.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setGone(true);
      return;
    }
    // `void (async () => …)()` statt eines async-Callbacks direkt in `setTimeout` (#279): Der Timer
    // erwartet eine void-Funktion, ein zurückgegebenes Promise würde niemand behandeln.
    const t = setTimeout(() => {
      void (async () => {
        const rect = el.getBoundingClientRect();
        try {
          const html2canvas = (await import('html2canvas')).default;
          if (cancelled) return;
          const snap = await html2canvas(el, { backgroundColor: null, scale: 1, logging: false });
          if (cancelled) return;
          setGone(true); // echte Zeile verschwindet + fällt zusammen …
          disintegrate(snap, rect); // … während die Partikel verwehen
        } catch {
          if (!cancelled) setGone(true);
        }
      })();
    }, 450); // kurz lesbar, bevor es zerfällt
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);
  return (
    <div
      ref={ref}
      className={`${styles.removedRow}${gone ? ` ${styles.removedGone}` : ''}`}
      aria-label={`Entfernt: ${title}`}
    >
      <div className={styles.flowTime} />
      <div className={styles.flowBody}>
        <div className={styles.flowHead}>
          <span className={styles.removedTitle}>{title}</span>
          <span className={styles.removedTag}>entfernt</span>
        </div>
      </div>
    </div>
  );
}
