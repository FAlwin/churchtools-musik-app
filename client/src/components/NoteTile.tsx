import { Icon } from './icons';
import { ACCENTS } from '../utils/constants';
import styles from './NoteTile.module.scss';

interface NoteTileProps {
  size?: number;
  /** Akzentfarbe; per Index über ACCENTS rotieren lassen. */
  accent?: string;
}

/** Noten-Kachel (wie die ChurchTools-Lied-Karte). */
export function NoteTile({ size = 42, accent = ACCENTS[0] }: NoteTileProps) {
  return (
    <div className={styles.tile} style={{ width: size, height: size }}>
      <Icon name="music" size={size * 0.52} stroke={1.7} style={{ color: accent }} />
    </div>
  );
}
