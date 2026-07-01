import { useState } from 'react';
import type { Service, SongArrangementOption, SongLibraryEntry } from '@shared/types/index';
import { Sheet } from './Sheet';
import { CenterMessage } from './CenterMessage';
import { Icon } from './icons';
import { useSongArrangements, useAddSongToService } from '../hooks/useServices';
import styles from './AddToAgendaSheet.module.scss';

interface AddToAgendaSheetProps {
  song: SongLibraryEntry;
  services: Service[];
  onClose: () => void;
}

/**
 * Zwei-Schritt-Sheet: Lied aus der Übersicht zu einem Ablauf hinzufügen.
 * 1. Termin wählen (kommende + vergangene) → 2. Arrangement/Tonart wählen → Bestätigung.
 */
export function AddToAgendaSheet({ song, services, onClose }: AddToAgendaSheetProps) {
  const [service, setService] = useState<Service | null>(null);
  const [done, setDone] = useState(false);

  const arrangements = useSongArrangements(service ? song.songId : null);
  const add = useAddSongToService();

  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = services
    .filter((s) => s.date >= todayIso)
    .sort((a, b) => a.start.localeCompare(b.start));
  const past = services
    .filter((s) => s.date < todayIso)
    .sort((a, b) => b.start.localeCompare(a.start));

  async function pick(a: SongArrangementOption) {
    if (!service || add.isPending) return;
    try {
      await add.mutateAsync({ eventId: service.id, arrangementId: a.arrangementId, title: song.name });
      setDone(true);
    } catch {
      // Fehler wird über add.isError unten angezeigt
    }
  }

  const title = done ? 'Hinzugefügt' : service ? 'Arrangement wählen' : 'Zu welchem Ablauf?';

  function ServiceRow({ s }: { s: Service }) {
    return (
      <button className={styles.choice} onClick={() => setService(s)}>
        <Icon name="calendar" size={18} className={styles.choiceIcon} />
        <span className={styles.choiceText}>
          <span className={styles.choiceTitle}>{s.name}</span>
          <span className={styles.choiceMeta}>
            {s.weekday}, {s.day}. {s.month}
            {s.subtitle ? ` · ${s.subtitle}` : ''}
          </span>
        </span>
        <Icon name="chev-right" size={18} stroke={2.2} className={styles.choiceIcon} />
      </button>
    );
  }

  return (
    <Sheet title={title} onClose={onClose} cancelLabel={done ? 'Fertig' : 'Abbrechen'}>
      {done ? (
        <div className={styles.success}>
          <span className={styles.successIcon}>
            <Icon name="check" size={26} stroke={2.6} />
          </span>
          <div>
            „{song.name}" wurde zu <b>{service?.name}</b> hinzugefügt.
          </div>
        </div>
      ) : !service ? (
        <div className={styles.list}>
          <div className={styles.songLabel}>{song.name}</div>
          {services.length === 0 ? (
            <div className={styles.empty}>Keine Termine gefunden.</div>
          ) : (
            <>
              {upcoming.length > 0 && <div className={styles.group}>Kommende</div>}
              {upcoming.map((s) => (
                <ServiceRow key={s.id} s={s} />
              ))}
              {past.length > 0 && <div className={styles.group}>Vergangene</div>}
              {past.map((s) => (
                <ServiceRow key={s.id} s={s} />
              ))}
            </>
          )}
        </div>
      ) : (
        <div className={styles.list}>
          <button className={styles.back} onClick={() => setService(null)} disabled={add.isPending}>
            <Icon name="chev-left" size={16} stroke={2.4} /> {service.name}
          </button>
          {add.isError && <div className={styles.err}>Konnte nicht hinzugefügt werden. Bitte erneut versuchen.</div>}
          {arrangements.isLoading ? (
            <CenterMessage loading text="Arrangements werden geladen…" />
          ) : arrangements.isError ? (
            <CenterMessage
              icon="⚠️"
              text="Arrangements konnten nicht geladen werden."
              onRetry={() => arrangements.refetch()}
            />
          ) : (arrangements.data ?? []).length === 0 ? (
            <div className={styles.empty}>Für dieses Lied sind keine Arrangements hinterlegt.</div>
          ) : (
            (arrangements.data ?? []).map((a) => (
              <button
                key={a.arrangementId}
                className={styles.choice}
                onClick={() => pick(a)}
                disabled={add.isPending}
              >
                <span className={styles.choiceText}>
                  <span className={styles.choiceTitle}>{a.arrangementName}</span>
                  {a.key && <span className={styles.choiceMeta}>Tonart {a.key}</span>}
                </span>
                <Icon name="plus" size={18} stroke={2.4} className={styles.choiceIcon} />
              </button>
            ))
          )}
        </div>
      )}
    </Sheet>
  );
}
