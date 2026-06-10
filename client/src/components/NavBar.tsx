import type { ReactNode } from 'react';
import styles from './NavBar.module.scss';

interface IconButtonProps {
  onClick: () => void;
  title?: string;
  children: ReactNode;
  style?: React.CSSProperties;
}

/** Quadratischer Icon-Button für die Navigationsleiste. */
export function IconButton({ onClick, title, children, style }: IconButtonProps) {
  return (
    <button className={styles.ibtn} onClick={onClick} title={title} style={style}>
      {children}
    </button>
  );
}

interface NavBarProps {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
}

/** Obere Navigationsleiste (Teal) mit Titel, Untertitel und Aktions-Buttons. */
export function NavBar({ title, subtitle, left, right }: NavBarProps) {
  return (
    <div className={styles.navBar}>
      {left}
      <div className={styles.titles}>
        <div className={styles.title}>{title}</div>
        {subtitle && <div className={styles.sub}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}
