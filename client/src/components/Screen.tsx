import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Spinner } from './Spinner';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import styles from './Screen.module.scss';

interface ScreenProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Vollflächiger Screen-Container mit Fade-in. */
export function Screen({ children, className, style }: ScreenProps) {
  return (
    <div className={`${styles.screen}${className ? ' ' + className : ''}`} style={style}>
      {children}
    </div>
  );
}

interface ScrollProps {
  children: ReactNode;
  /** Optional: aktiviert „Runterziehen zum Aktualisieren". */
  onRefresh?: () => Promise<unknown> | void;
}

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
 */
const ZUM_ANFANG = 'app:zum-anfang';

/** Von der Tab-Leiste gerufen, wenn der schon aktive Tab noch einmal getippt wird. */
export function scrolleZumAnfang(): void {
  window.dispatchEvent(new Event(ZUM_ANFANG));
}

function useZumAnfang(ref: React.RefObject<HTMLDivElement | null>) {
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

/** Scrollbarer Bereich innerhalb eines Screens. Mit onRefresh: Pull-to-Refresh. */
export function Scroll({ children, onRefresh }: ScrollProps) {
  const eigenerRef = useRef<HTMLDivElement | null>(null);
  useZumAnfang(eigenerRef);
  if (!onRefresh) {
    return (
      <div className={styles.scroll} ref={eigenerRef}>
        {children}
      </div>
    );
  }
  return <PullScroll onRefresh={onRefresh}>{children}</PullScroll>;
}

function PullScroll({
  children,
  onRefresh,
}: {
  children: ReactNode;
  onRefresh: () => Promise<unknown> | void;
}) {
  const { ref, pull, refreshing, isTriggered, handlers } = usePullToRefresh(onRefresh);
  useZumAnfang(ref);
  return (
    <div
      ref={ref}
      className={styles.scroll}
      onTouchStart={handlers.onTouchStart}
      onTouchMove={handlers.onTouchMove}
      onTouchEnd={handlers.onTouchEnd}
    >
      <div
        className={styles.pullIndicator}
        style={{ height: refreshing ? 48 : pull, opacity: pull > 8 || refreshing ? 1 : 0 }}
      >
        {refreshing ? (
          <Spinner />
        ) : (
          <>
            <span
              className={styles.pullArrow}
              style={{ transform: `rotate(${isTriggered ? 180 : 0}deg)` }}
            >
              ↓
            </span>
            {/*
              Der Hinweis steht NUR während der Geste (Alwin, 22.09.2026): Als dauerhafte Zeile am
              Listenanfang lag er in Bildschirmen ohne Kopfleiste im Unschärfe-Band von iOS 26/27 und
              wirkte verschwommen. Während man zieht, darf er dort liegen – man sieht ohnehin auf die
              eigene Hand. Der Wortlaut wechselt am Auslösepunkt, damit klar ist, wann man loslassen kann.
            */}
            <span className={styles.pullText} style={{ opacity: pull > 28 ? 1 : 0 }}>
              {isTriggered ? 'Loslassen zum Aktualisieren' : 'Zum Aktualisieren nach unten ziehen'}
            </span>
          </>
        )}
      </div>
      <div
        style={{
          transform: refreshing ? 'translateY(0)' : `translateY(${pull}px)`,
          transition: pull === 0 ? 'transform .2s' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
