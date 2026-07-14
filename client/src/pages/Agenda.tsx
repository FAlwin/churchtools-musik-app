import { useEffect, useState } from 'react';
import type { Service } from '@shared/types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar } from '../components/NavBar';
import { CenterMessage } from '../components/CenterMessage';
import { Segment } from '../components/Segment';
import { Icon } from '../components/icons';
import { Spinner } from '../components/Spinner';
import { Toast, useToast } from '../components/Toast';
import { usePastServices } from '../hooks/useServices';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineServices } from '../hooks/useOfflineServices';
import { saveServiceOffline } from '../services/offline';
import { queryClient } from '../queryClient';
import * as api from '../services/churchtoolsApi';
import styles from './Agenda.module.scss';

interface AgendaProps {
  services: Service[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onSelect: (service: Service) => void;
  /** Öffnet direkt das „Liederheft" (Lieder-Charts) des Gottesdienstes. */
  onOpenSongs: (service: Service) => void;
}

const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

const OFFLINE_HINT = 'Offline nicht verfügbar – einmal online öffnen oder vorher speichern.';

/** Gruppiert Gottesdienste nach „Monat JJJJ" (Reihenfolge der Eingabe bleibt erhalten). */
function groupByMonth(list: Service[]): { key: string; items: Service[] }[] {
  const groups: { key: string; items: Service[] }[] = [];
  for (const s of list) {
    const [y, m] = s.date.split('-');
    const key = `${MONTHS[Number(m) - 1]} ${y}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, items: [] };
      groups.push(g);
    }
    g.items.push(s);
  }
  return groups;
}

/** Übersicht der Gottesdienste (kommend + vergangen), nach Monat gruppiert. */
export function Agenda({
  services,
  isLoading,
  isError,
  onRetry,
  onSelect,
  onOpenSongs,
}: AgendaProps) {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [monthsBack, setMonthsBack] = useState(1);
  // Gerade laufende „Für offline speichern"-Aktion (Termin-Zeile) → Spinner statt Knopf.
  const [savingId, setSavingId] = useState<number | null>(null);

  const online = useOnlineStatus();
  const offlineReg = useOfflineServices();
  const { toast, showToast } = useToast();

  // Vergangene Gottesdienste werden live geladen → ohne Netz nicht verfügbar. War man auf
  // „Vergangene" und geht offline, zurück auf „Kommende" (das Segment graut „Vergangene" aus).
  useEffect(() => {
    if (!online && tab === 'past') setTab('upcoming');
  }, [online, tab]);

  const today = new Date().toISOString().slice(0, 10);
  const pastQuery = usePastServices(monthsBack, tab === 'past' && online);
  const upcoming = services
    .filter((s) => s.date >= today)
    .sort((a, b) => a.start.localeCompare(b.start));
  const past = [...(pastQuery.data ?? [])]
    .filter((s) => s.date < today)
    .sort((a, b) => b.start.localeCompare(a.start));

  /** Lädt einen kommenden Gottesdienst komplett in den Offline-Vorrat (Zeilen-Knopf). */
  async function saveRow(s: Service) {
    if (savingId !== null) return;
    setSavingId(s.id);
    try {
      const items = await queryClient.fetchQuery({
        queryKey: ['agenda', s.id],
        queryFn: () => api.getAgenda(s.id),
      });
      await saveServiceOffline({ id: s.id, date: s.date }, items);
    } catch {
      showToast('Speichern fehlgeschlagen – bitte erneut versuchen.');
    } finally {
      setSavingId(null);
    }
  }

  function row(s: Service) {
    const held = !!offlineReg[s.id];
    // Ohne Netz ist nur bedienbar, was offline vorliegt – alles andere ausgegraut + Hinweis.
    const blocked = !online && !held;
    const isFuture = s.date >= today;
    return (
      <div key={s.id} className={`${styles.card}${blocked ? ' ' + styles.cardOff : ''}`}>
        <button
          className={styles.cardMain}
          onClick={() => (blocked ? showToast(OFFLINE_HINT) : onSelect(s))}
        >
          <div className={styles.dateBadge}>
            <span className={styles.day}>{s.day}</span>
            <span className={styles.month}>{s.month}</span>
          </div>
          <div className={styles.info}>
            <div className={styles.svcName}>
              {s.name}
              {s.subtitle && <span className={styles.subtitlePart}> · {s.subtitle}</span>}
            </div>
            <div className={styles.meta}>
              <span>{s.weekday}</span>
              <span className={styles.dotSep}>·</span>
              <span>{s.time}</span>
              {/* „Geändert"-Hinweis (#143): Setlist hat sich seit dem letzten Ansehen geändert. */}
              {s.setlistChanged && (
                <span
                  className={styles.changedBadge}
                  data-tour="setlist-geaendert"
                  title="Die Setlist hat sich geändert, seit du diesen Termin zuletzt geöffnet hast"
                >
                  geändert
                </span>
              )}
            </div>
          </div>
          {held && (
            <span
              className={styles.offBadge}
              data-tour="offline"
              title={`Offline verfügbar (Stand ${new Date(offlineReg[s.id].savedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})`}
              aria-label="Offline verfügbar"
            >
              <Icon name="cloud-check" size={18} stroke={2} />
            </span>
          )}
          <Icon name="chev-right" size={18} stroke={2.2} className={styles.chev} />
        </button>
        {/* Kommender, noch nicht gespeicherter GD → per Knopf offline verfügbar machen (#32). */}
        {isFuture && !held && online && (
          <button
            className={styles.songBook}
            data-tour="offline"
            onClick={() => void saveRow(s)}
            disabled={savingId !== null}
            aria-label="Für offline speichern"
            title="Für offline speichern"
          >
            {savingId === s.id ? <Spinner /> : <Icon name="cloud-download" size={21} stroke={2} />}
          </button>
        )}
        {s.songCount > 0 && (
          <button
            className={styles.songBook}
            data-tour="songbook"
            onClick={() => (blocked ? showToast(OFFLINE_HINT) : onOpenSongs(s))}
            aria-label={`Liederheft öffnen (${s.songCount} ${s.songCount === 1 ? 'Lied' : 'Lieder'})`}
            title="Liederheft öffnen"
          >
            <Icon name="music" size={21} stroke={2.2} />
            {/* Kleine Zahl am Noten-Knopf = Anzahl Lieder (früher in der Textzeile, dort abgeschnitten). */}
            <span className={styles.songCount}>{s.songCount}</span>
          </button>
        )}
      </div>
    );
  }

  function groups(list: Service[]) {
    return groupByMonth(list).map((g, gi) => (
      <div key={g.key} className={styles.group}>
        <div className={styles.groupHdr}>{g.key}</div>
        {/* Erste Monatsgruppe trägt den Tour-Marker (Einführung hebt die Terminliste hervor). */}
        <div className={styles.cardList} data-tour={gi === 0 ? 'termine-liste' : undefined}>
          {g.items.map(row)}
        </div>
      </div>
    ));
  }

  return (
    <Screen>
      <NavBar title="Termine" />

      <Segment
        className={styles.segWrap}
        value={tab}
        options={[
          { value: 'upcoming', label: 'Kommende' },
          { value: 'past', label: 'Vergangene' },
        ]}
        dimmed={online ? [] : ['past']}
        onChange={(v) => {
          if (!online && v === 'past') {
            showToast('Vergangene Gottesdienste sind offline nicht verfügbar.');
            return;
          }
          setTab(v);
        }}
      />

      <Scroll onRefresh={tab === 'upcoming' ? onRetry : () => pastQuery.refetch()}>
        {tab === 'upcoming' ? (
          isLoading ? (
            <CenterMessage loading text="Gottesdienste werden geladen…" />
          ) : isError ? (
            <CenterMessage
              icon="⚠️"
              text="Gottesdienste konnten nicht geladen werden."
              onRetry={onRetry}
            />
          ) : upcoming.length === 0 ? (
            <CenterMessage icon="📅" text="Keine kommenden Gottesdienste." />
          ) : (
            groups(upcoming)
          )
        ) : !online ? (
          <CenterMessage icon="📴" text="Vergangene Gottesdienste sind offline nicht verfügbar." />
        ) : pastQuery.isLoading ? (
          <CenterMessage loading text="Vergangene werden geladen…" />
        ) : pastQuery.isError ? (
          <CenterMessage
            icon="⚠️"
            text="Vergangene konnten nicht geladen werden."
            onRetry={() => pastQuery.refetch()}
          />
        ) : (
          <>
            {past.length === 0 ? (
              <CenterMessage icon="📅" text="Keine vergangenen Gottesdienste im Zeitraum." />
            ) : (
              groups(past)
            )}
            <button
              className={styles.loadMore}
              disabled={pastQuery.isFetching}
              onClick={() => setMonthsBack((m) => m + 1)}
            >
              {pastQuery.isFetching ? 'Lädt…' : 'Mehr laden'}
            </button>
          </>
        )}
        <div style={{ height: 16 }} />
      </Scroll>
      <Toast message={toast} />
    </Screen>
  );
}
