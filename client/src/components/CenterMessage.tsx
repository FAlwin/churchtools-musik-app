import { Spinner } from './Spinner';
import styles from './CenterMessage.module.scss';

interface CenterMessageProps {
  /** true → Ladekringel statt Icon. */
  loading?: boolean;
  icon?: string;
  text: string;
  onRetry?: () => void;
  /** Optionale Zusatzaktion (z.B. Abmelden) mit eigenem Text. */
  actionLabel?: string;
  onAction?: () => void;
  /** Dezenter technischer Zusatztext (z. B. Diagnose), klein/grau unter der Meldung. */
  detail?: string;
}

/** Zentrierte Statusmeldung (Laden, leer, Fehler) für Screen-Inhalte. */
export function CenterMessage({ loading, icon, text, onRetry, actionLabel, onAction, detail }: CenterMessageProps) {
  return (
    <div className={styles.wrap}>
      {loading ? <Spinner /> : icon && <div className={styles.icon}>{icon}</div>}
      <div className={styles.text}>{text}</div>
      {detail && <pre className={styles.detail}>{detail}</pre>}
      {onRetry && (
        <button className={styles.retry} onClick={onRetry}>
          Erneut versuchen
        </button>
      )}
      {onAction && actionLabel && (
        <button className={styles.retry} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
