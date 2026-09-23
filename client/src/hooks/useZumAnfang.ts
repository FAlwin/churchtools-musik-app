import { useEffect, type RefObject } from 'react';

/**
 * **„Nach oben" von außen anstoßen** (22.09.2026).
 *
 * Alwin: „Warum funktioniert es nicht, dass ganz nach oben gescrollt wird, wenn ich auf die Uhrzeit
 * tippe?" – iOS scrollt beim Tipp auf die Statusleiste nur den **Haupt-Scroller des Dokuments**
 * nach oben. Diese App scrollt in einem inneren Bereich (damit die Tab-Leiste steht und das
 * Runterziehen funktioniert), und ein Tipp auf die Statusleiste erreicht die Web-App gar nicht –
 * es gibt dafür kein Ereignis. Nachbauen lässt sich nur der zweite Weg, den native Apps haben:
 * ein Tipp auf den **bereits aktiven Tab**. Der meldet sich hier.
 *
 * Bewusst ein Modul-weites Ereignis statt einer Prop-Kette durch alle Seiten: Der Scroll-Bereich
 * kennt sich selbst, die Tab-Leiste weiß nichts von ihm.
 *
 * Eigene Datei seit dem 23.09.2026: In `components/Screen.tsx` exportiert brach die Funktion das
 * Fast Refresh von Vite (#406, Lint-Regel `react-refresh/only-export-components`).
 */
const ZUM_ANFANG = 'app:zum-anfang';

/** Von der Tab-Leiste gerufen, wenn der schon aktive Tab noch einmal getippt wird. */
export function scrolleZumAnfang(): void {
  window.dispatchEvent(new Event(ZUM_ANFANG));
}

/** Lässt einen Scroll-Bereich auf „nach oben" hören – `Scroll` nutzt es für beide Varianten. */
export function useZumAnfang(ref: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const hoch = () => {
      const el = ref.current;
      if (!el || el.scrollTop === 0) return;
      const ruhig = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo?.({ top: 0, behavior: ruhig ? 'auto' : 'smooth' });
      /**
       * **Absicherung, kein Beiwerk.** Beim Durchklicken am 22.09.2026 zeigte sich: Auf diesem
       * inneren Scroll-Bereich führte der Browser `behavior: 'smooth'` **gar nicht** aus – der
       * Inhalt blieb einfach stehen, während ein harter Sprung sofort wirkte. Wo die Animation
       * läuft, ist sie nach 400 ms längst fertig und `scrollTop` schon 0; wo sie ausbleibt, springt
       * es hier. So ist das Ergebnis überall dasselbe, und in Umgebungen ohne `scrollTo` (Tests)
       * funktioniert es ebenfalls.
       */
      window.setTimeout(() => {
        if (el.scrollTop > 0) el.scrollTop = 0;
      }, 400);
    };
    window.addEventListener(ZUM_ANFANG, hoch);
    return () => window.removeEventListener(ZUM_ANFANG, hoch);
  }, [ref]);
}
