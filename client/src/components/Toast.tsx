import styles from './Toast.module.scss';

// useToast lebt in `hooks/useToast.ts` (getrennt, damit diese Datei nur Komponenten exportiert).

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className={styles.toast} role="status">
      {message}
    </div>
  );
}
