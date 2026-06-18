import { useState } from 'react';
import type { Service } from '@shared/types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar } from '../components/NavBar';
import { CenterMessage } from '../components/CenterMessage';
import { usePastServices } from '../hooks/useServices';
import styles from './Agenda.module.scss';

interface AgendaProps {
  services: Service[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onSelect: (service: Service) => void;
}

/** Übersicht der Gottesdienste (kommend + vergangen). */
export function Agenda({ services, isLoading, isError, onRetry, onSelect }: AgendaProps) {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [monthsBack, setMonthsBack] = useState(1);

  const today = new Date().toISOString().slice(0, 10);
  const pastQuery = usePastServices(monthsBack, tab === 'past');
  const upcoming = services.filter((s) => s.date >= today);
  const past = [...(pastQuery.data ?? [])]
    .filter((s) => s.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  function card(s: Service) {
    return (
      <div key={s.id} className={styles.card} onClick={() => onSelect(s)}>
        <div className={styles.dateBadge}>
          <span className={styles.day}>{s.day}</span>
          <span className={styles.month}>{s.month}</span>
        </div>
        <div className={styles.info}>
          <div className={styles.svcName}>
            {s.weekday} · {s.name}
            {s.subtitle && <span className={styles.subtitlePart}> · {s.subtitle}</span>}
          </div>
          <div className={styles.meta}>
            <span>{s.time}</span>
            <span>{s.location}</span>
            <span>{s.songCount} Songs</span>
          </div>
        </div>
        <span className={styles.arr}>›</span>
      </div>
    );
  }

  return (
    <Screen>
      <NavBar title="Termine" />

      <div className={styles.tabs}>
        <button
          className={`${styles.tab}${tab === 'upcoming' ? ' ' + styles.tabOn : ''}`}
          onClick={() => setTab('upcoming')}
        >
          Kommende
        </button>
        <button
          className={`${styles.tab}${tab === 'past' ? ' ' + styles.tabOn : ''}`}
          onClick={() => setTab('past')}
        >
          Vergangene
        </button>
      </div>

      <Scroll onRefresh={tab === 'upcoming' ? onRetry : () => pastQuery.refetch()}>
        {tab === 'upcoming' ? (
          isLoading ? (
            <CenterMessage loading text="Gottesdienste werden geladen…" />
          ) : isError ? (
            <CenterMessage icon="⚠️" text="Gottesdienste konnten nicht geladen werden." onRetry={onRetry} />
          ) : upcoming.length === 0 ? (
            <CenterMessage icon="📅" text="Keine kommenden Gottesdienste." />
          ) : (
            <div className={styles.list}>{upcoming.map(card)}</div>
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
              <div className={styles.list}>{past.map(card)}</div>
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
      </Scroll>
    </Screen>
  );
}
