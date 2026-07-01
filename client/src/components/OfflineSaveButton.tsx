import { useEffect, useState } from 'react';
import type { AgendaItem } from '@shared/types/index';
import { saveServiceOffline } from '../services/offline';
import { Icon } from './icons';
import styles from './OfflineSaveButton.module.scss';

type State = 'idle' | 'saving' | 'done' | 'error';

/**
 * „Für offline speichern" für einen Gottesdienst: lädt online alle Charts/Dokumente in den Cache
 * und schreibt die Daten sofort nach IndexedDB – mit sichtbarem Fortschritt und Bestätigung, damit
 * klar ist, dass der Ablauf im Saal auch ohne Netz verfügbar ist (#32, Phase 2).
 */
export function OfflineSaveButton({ items }: { items: AgendaItem[] }) {
  const [state, setState] = useState<State>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  async function handleSave() {
    if (state === 'saving') return;
    setState('saving');
    setProgress({ done: 0, total: 0 });
    try {
      await saveServiceOffline(items, (done, total) => setProgress({ done, total }));
      setState('done');
    } catch {
      setState('error');
    }
  }

  // Offline lässt sich nichts nachladen – ehrlich sagen (außer es wurde in dieser Ansicht schon gespeichert).
  if (!online && state !== 'done') {
    return <div className={styles.hint}>Offline – „Für offline speichern" geht nur mit Netz.</div>;
  }

  const label =
    state === 'saving'
      ? progress.total > 0
        ? `Speichere… ${progress.done}/${progress.total}`
        : 'Speichere…'
      : state === 'done'
        ? 'Für offline gespeichert – erneut sichern'
        : state === 'error'
          ? 'Fehler – erneut versuchen'
          : 'Für offline speichern';

  return (
    <button
      className={`${styles.btn}${state === 'done' ? ' ' + styles.done : ''}${
        state === 'error' ? ' ' + styles.error : ''
      }`}
      onClick={() => void handleSave()}
      disabled={state === 'saving'}
    >
      <Icon name={state === 'done' ? 'check' : 'pin'} size={16} stroke={2.2} />
      {label}
    </button>
  );
}
