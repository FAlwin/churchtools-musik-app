import type { CSSProperties, ReactNode } from 'react';
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

/** Scrollbarer Bereich innerhalb eines Screens. Mit onRefresh: Pull-to-Refresh. */
export function Scroll({ children, onRefresh }: ScrollProps) {
  if (!onRefresh) {
    return <div className={styles.scroll}>{children}</div>;
  }
  return <PullScroll onRefresh={onRefresh}>{children}</PullScroll>;
}

function PullScroll({ children, onRefresh }: { children: ReactNode; onRefresh: () => Promise<unknown> | void }) {
  const { ref, pull, refreshing, isTriggered, handlers } = usePullToRefresh(onRefresh);
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
          <span className={styles.pullArrow} style={{ transform: `rotate(${isTriggered ? 180 : 0}deg)` }}>
            ↓
          </span>
        )}
      </div>
      <div style={{ transform: refreshing ? 'translateY(0)' : `translateY(${pull}px)`, transition: pull === 0 ? 'transform .2s' : 'none' }}>
        {children}
      </div>
    </div>
  );
}
