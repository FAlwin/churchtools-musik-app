import { useRef, type CSSProperties, type ReactNode } from 'react';
import { Spinner } from './Spinner';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useZumAnfang } from '../hooks/useZumAnfang';
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
 * Höhe des Zug-Anzeigers – so weit rückt der Inhalt während des Ladens nach unten. Die EINE Quelle:
 * Sie wird als Stil gesetzt, nicht zusätzlich im SCSS (dort stand sie bis zum Code-Check am
 * 23.09.2026 ein zweites Mal, und nichts hätte die beiden Zahlen gleich gehalten).
 */
const PULL_HOEHE = 48;

/**
 * Scrollbarer Bereich innerhalb eines Screens. Mit onRefresh: Pull-to-Refresh.
 *
 * Beide Varianten sind eigene Komponenten, damit jede genau EINMAL auf „nach oben" hört. Vorher rief
 * `Scroll` selbst `useZumAnfang` auf einen Ref, der im Pull-Zweig nie an ein Element kam – ein
 * zweiter, toter Listener neben dem in `PullScroll` (Code-Check 23.09.2026).
 */
export function Scroll({ children, onRefresh, unterLeiste }: ScrollProps) {
  if (!onRefresh) return <EinfachScroll>{children}</EinfachScroll>;
  return (
    <PullScroll onRefresh={onRefresh} unterLeiste={unterLeiste}>
      {children}
    </PullScroll>
  );
}

function EinfachScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useZumAnfang(ref);
  return (
    <div className={styles.scroll} ref={ref}>
      {children}
    </div>
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
        style={{ height: PULL_HOEHE, opacity: refreshing ? 1 : Math.min(pull / PULL_HOEHE, 1) }}
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
