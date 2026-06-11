import { Spinner } from './Spinner';
import styles from './CenterMessage.module.scss';

interface CenterMessageProps {
  /** true → Ladekringel statt Icon. */
  loading?: boolean;
  icon?: string;
  text: string;
  onRetry?: () => void;
}

/** Zentrierte Statusmeldung (Laden, leer, Fehler) für Screen-Inhalte. */
export function CenterMessage({ loading, icon, text, onRetry }: CenterMessageProps) {
  return (
    <div className={styles.wrap}>
      {loading ? <Spinner /> : icon && <div className={styles.icon}>{icon}</div>}
      <div className={styles.text}>{text}</div>
      {onRetry && (
        <button className={styles.retry} onClick={onRetry}>
          Erneut versuchen
        </button>
      )}
    </div>
  );
}
