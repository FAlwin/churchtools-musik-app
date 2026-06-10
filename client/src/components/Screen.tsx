import type { CSSProperties, ReactNode } from 'react';
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
}

/** Scrollbarer Bereich innerhalb eines Screens. */
export function Scroll({ children }: ScrollProps) {
  return <div className={styles.scroll}>{children}</div>;
}
