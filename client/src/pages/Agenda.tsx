import { useState } from 'react';
import type { Service } from '@shared/types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar } from '../components/NavBar';
import { CenterMessage } from '../components/CenterMessage';
import { Segment } from '../components/Segment';
import { Icon } from '../components/icons';
import { usePastServices } from '../hooks/useServices';
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

  const today = new Date().toISOString().slice(0, 10);
  const pastQuery = usePastServices(monthsBack, tab === 'past');
  const upcoming = services
    .filter((s) => s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = [...(pastQuery.data ?? [])]
    .filter((s) => s.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  function row(s: Service) {
    return (
      <div key={s.id} className={styles.card}>
        <button className={styles.cardMain} onClick={() => onSelect(s)}>
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
              <span className={styles.dotSep}>·</span>
              <span>{s.songCount} Lieder</span>
            </div>
          </div>
          <Icon name="chev-right" size={18} stroke={2.2} className={styles.chev} />
        </button>
        {s.songCount > 0 && (
          <button
            className={styles.songBook}
            onClick={() => onOpenSongs(s)}
            aria-label="Liederheft öffnen"
            title="Liederheft öffnen"
          >
            <Icon name="music" size={21} stroke={2.2} />
          </button>
        )}
      </div>
    );
  }

  function groups(list: Service[]) {
    return groupByMonth(list).map((g) => (
      <div key={g.key} className={styles.group}>
        <div className={styles.groupHdr}>{g.key}</div>
        <div className={styles.cardList}>{g.items.map(row)}</div>
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
        onChange={setTab}
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
    </Screen>
  );
}
