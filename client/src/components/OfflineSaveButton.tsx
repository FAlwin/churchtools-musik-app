import { useState } from 'react';
import type { AgendaItem } from '@shared/types/index';
import { saveServiceOffline } from '../services/offline';
import { IconButton } from './NavBar';
import { Icon } from './icons';
import { Spinner } from './Spinner';

/**
 * Kopf-Aktion „Für offline speichern" als Download-Icon mit Zustand (Häkchen = gespeichert).
 * Meist unnötig, weil der nächste Gottesdienst automatisch offline gehalten wird (#32) – dieser
 * Knopf ist für ältere Gottesdienste oder zum bewussten Nachladen.
 */
export function OfflineSaveButton({ items }: { items: AgendaItem[] }) {
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  async function save() {
    if (state === 'saving') return;
    setState('saving');
    try {
      await saveServiceOffline(items);
      setState('done');
    } catch {
      setState('error');
    }
  }

  const title =
    state === 'saving'
      ? 'Wird offline gespeichert…'
      : state === 'done'
        ? 'Offline gespeichert'
        : state === 'error'
          ? 'Fehler – nochmal versuchen'
          : 'Für offline speichern';

  return (
    <IconButton onClick={() => void save()} title={title}>
      {state === 'saving' ? (
        <Spinner />
      ) : (
        <Icon name={state === 'done' ? 'check' : 'download'} size={20} stroke={2.2} />
      )}
    </IconButton>
  );
}
