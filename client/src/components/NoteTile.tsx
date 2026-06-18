import { Icon } from './icons';
import styles from './NoteTile.module.scss';

interface NoteTileProps {
  size?: number;
}

/** Noten-Kachel (wie die ChurchTools-Lied-Karte) – einheitlich in Blau. */
export function NoteTile({ size = 42 }: NoteTileProps) {
  return (
    <div className={styles.tile} style={{ width: size, height: size }}>
      <Icon name="music" size={size * 0.52} stroke={1.7} style={{ color: 'var(--blue-ink)' }} />
    </div>
  );
}
