import type { ReactNode } from 'react';
import { Icon } from './icons';
import styles from './NavBar.module.scss';

interface IconButtonProps {
  onClick: () => void;
  title?: string;
  children: ReactNode;
  style?: React.CSSProperties;
}

/** Icon-Button für die Navigationsleiste (transparent, blaue Tinte). */
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
  /** Blaue Zurück-Aktion links (ChurchTools-Stil). */
  back?: () => void;
  backLabel?: string;
  /** Titel als Button (öffnet z. B. das Chart-Menü). */
  titleTap?: () => void;
  titleChevron?: boolean;
  /** Rückwärtskompatibel: eigener Inhalt links/rechts. */
  left?: ReactNode;
  right?: ReactNode;
}

/** Obere Navigationsleiste im ChurchTools-Stil (weiß/blur, zentrierter Titel). */
export function NavBar({
  title,
  subtitle,
  back,
  backLabel,
  titleTap,
  titleChevron,
  left,
  right,
}: NavBarProps) {
  return (
    <div className={styles.nav}>
      <div className={`${styles.side} ${styles.left}`}>
        {back ? (
          <button className={styles.back} onClick={back}>
            <Icon name="chev-left" size={20} stroke={2.4} />
            {backLabel && <span>{backLabel}</span>}
          </button>
        ) : (
          left
        )}
      </div>
      <div className={styles.titles}>
        {titleTap ? (
          <button className={styles.titleBtn} onClick={titleTap}>
            <span className={styles.title}>{title}</span>
            {titleChevron && <Icon name="chev-down" size={15} stroke={2.6} />}
          </button>
        ) : (
          <div className={styles.title}>{title}</div>
        )}
        {subtitle && <div className={styles.sub}>{subtitle}</div>}
      </div>
      <div className={`${styles.side} ${styles.right}`}>{right}</div>
    </div>
  );
}
