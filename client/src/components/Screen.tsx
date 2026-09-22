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
  /**
   * Sitzt über diesem Bereich eine Leiste (Detailansichten mit Zurück-Pfeil)? Dann hält die Leiste
   * den Abstand zum Unschärfe-Band schon, und der Zug-Anzeiger rückt dicht an den Inhalt – sonst
   * läge er mitten in der Leiste.
   */
  unterLeiste?: boolean;
  /**
   * Optional: aktiviert „Runterziehen zum Aktualisieren".
   *
   * **Muss das Versprechen des Abrufs zurückgeben** – daran hängt, wie lange die Ladeanzeige steht.
   * Eine Funktion ohne Rückgabe lehnt der Compiler ab; genau die hatte bei den Abwesenheiten dazu
   * geführt, dass die Anzeige sofort wieder weg war (22.09.2026). Mehrere Abrufe: `Promise.all`.
   */
  onRefresh?: () => Promise<unknown>;
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

/** Höhe des Zug-Anzeigers – so weit rückt der Inhalt während des Ladens nach unten. */
const PULL_HOEHE = 48;

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
export function Scroll({ children, onRefresh, unterLeiste }: ScrollProps) {
  const eigenerRef = useRef<HTMLDivElement | null>(null);
  useZumAnfang(eigenerRef);
  if (!onRefresh) {
    return (
      <div className={styles.scroll} ref={eigenerRef}>
        {children}
      </div>
    );
  }
  return (
    <PullScroll onRefresh={onRefresh} unterLeiste={unterLeiste}>
      {children}
    </PullScroll>
  );
}

function PullScroll({
  children,
  onRefresh,
  unterLeiste,
}: {
  children: ReactNode;
  onRefresh: () => Promise<unknown>;
  unterLeiste?: boolean;
}) {
  const { ref, pull, refreshing, isTriggered, handlers } = usePullToRefresh(onRefresh);
  useZumAnfang(ref);
  return (
    <div className={styles.pullWrap}>
      {/*
        **Der Zug-Anzeiger steht fest, der Inhalt wandert** (Alwin, 22.09.2026, mit Screenshots:
        „bei termine ist es falsch und bei lieder richtig").

        Vorher war er das erste Kind des Scroll-Bereichs, und seine Höhe war die Zugstrecke – er saß
        also am oberen Bildschirmrand, mitten im Unschärfe-Band von iOS 26/27, und war dort weich und
        unleserlich. Bei den Liedern fiel das nicht auf: Diese Liste ist lang genug zum Scrollen,
        deshalb legt iOS beim Ziehen sein EIGENES Gummiband darüber und schob den Anzeiger zufällig
        aus dem Band heraus. Bei den Terminen mit einem einzigen Eintrag gibt es nichts zu scrollen,
        das Gummiband bleibt aus – und der Hinweis klebte oben.

        Jetzt hängt er über dem Scroll-Bereich an einer festen Stelle: demselben Abstand, den auch die
        Überschrift hält (`--inhalt-pad-top`, in der App Safe-Area + 36 px). Damit sitzt er auf jedem
        Bildschirm gleich und immer unter dem Band – unabhängig davon, wie lang die Liste ist und ob
        iOS zusätzlich schiebt. So machen es native Apps auch: Der Anzeiger steht, der Inhalt schiebt
        sich darunter weg.
      */}
      <div
        className={`${styles.pullIndicator}${unterLeiste ? ' ' + styles.pullDicht : ''}`}
        /*
         * Die Deckkraft wächst mit dem Zug, statt bei einer festen Schwelle umzuspringen. Grund ist
         * die feste Position: Bei ganz kurzem Zug liegt der Anzeiger noch über der Überschrift
         * (gemessen: bis etwa 48 px Zug), und genau dort ist er jetzt noch blass.
         */
        style={{ opacity: refreshing ? 1 : Math.min(pull / PULL_HOEHE, 1) }}
        aria-hidden={pull > 8 || refreshing ? undefined : true}
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
              Listenanfang lag er im Unschärfe-Band und wirkte verschwommen. Der Wortlaut wechselt am
              Auslösepunkt, damit klar ist, wann man loslassen kann.
            */}
            <span className={styles.pullText} style={{ opacity: pull > 28 ? 1 : 0 }}>
              {isTriggered ? 'Loslassen zum Aktualisieren' : 'Zum Aktualisieren nach unten ziehen'}
            </span>
          </>
        )}
      </div>
      <div
        ref={ref}
        className={styles.scroll}
        onTouchStart={handlers.onTouchStart}
        onTouchMove={handlers.onTouchMove}
        onTouchEnd={handlers.onTouchEnd}
      >
        <div
          style={{
            // Der Inhalt macht dem Anzeiger Platz: beim Ziehen um die Zugstrecke, während des
            // Ladens um die Höhe des Anzeigers.
            transform: `translateY(${refreshing ? PULL_HOEHE : pull}px)`,
            transition: pull === 0 ? 'transform .2s' : 'none',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
