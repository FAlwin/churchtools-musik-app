import { useState } from 'react';
import type { Service, SongLibraryEntry } from '@shared/types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar } from '../components/NavBar';
import { CenterMessage } from '../components/CenterMessage';
import { Segment } from '../components/Segment';
import { Icon } from '../components/icons';
import { NoteTile } from '../components/NoteTile';
import { AddToAgendaSheet } from '../components/AddToAgendaSheet';
import type { SongUsageMap } from '../services/churchtoolsApi';
import styles from './AllSongs.module.scss';

interface AllSongsProps {
  songs: SongLibraryEntry[];
  usage?: SongUsageMap;
  usageLoading?: boolean;
  showStats?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onSelect: (entry: SongLibraryEntry) => void;
  /** Wenn true: pro Lied eine „+"-Aktion „Zu Ablauf hinzufügen". */
  canAddToAgenda?: boolean;
  /** Termine zur Auswahl beim Hinzufügen (kommende + vergangene). */
  services?: Service[];
}

type Sort = 'name' | 'count' | 'recent';

function fmtDate(iso: string | null): string {
  if (!iso) return 'noch nie';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** Durchsuchbare Liste aller Lieder, sortierbar nach Name/Häufigkeit/zuletzt. */
export function AllSongs({
  songs,
  usage,
  usageLoading,
  showStats = false,
  isLoading,
  isError,
  onRetry,
  onSelect,
  canAddToAgenda = false,
  services = [],
}: AllSongsProps) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const [addSong, setAddSong] = useState<SongLibraryEntry | null>(null);
  // Zeitfilter (nur für Häufigkeit/Zuletzt). Leere Felder = „Alle" (kein Limit).
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const query = q.trim().toLowerCase();

  // Statistik-Modus = eine der beiden zeitbezogenen Sortierungen ist aktiv.
  const statMode = showStats && sort !== 'name';
  const allRange = !from && !to;

  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
  const rangedDates = (s: SongLibraryEntry) => (usage?.[s.songId]?.dates ?? []).filter(inRange);
  const countOf = (s: SongLibraryEntry) => rangedDates(s).length;
  // Termine kommen absteigend sortiert → das erste ist das jüngste im Zeitraum.
  const lastOf = (s: SongLibraryEntry) => rangedDates(s)[0] ?? null;

  const searched = query
    ? songs.filter(
        (s) => s.name.toLowerCase().includes(query) || (s.author ?? '').toLowerCase().includes(query),
      )
    : [...songs];

  // Bei Häufigkeit/Zuletzt nur Lieder zeigen, die im gewählten Zeitraum gespielt wurden.
  const filtered = (statMode ? searched.filter((s) => countOf(s) > 0) : searched).sort((a, b) => {
    if (sort === 'count') return countOf(b) - countOf(a) || a.name.localeCompare(b.name, 'de');
    if (sort === 'recent')
      return (lastOf(b) ?? '').localeCompare(lastOf(a) ?? '') || a.name.localeCompare(b.name, 'de');
    return a.name.localeCompare(b.name, 'de');
  });

  const SORTS: { id: Sort; label: string }[] = [
    { id: 'name', label: 'A–Z' },
    { id: 'count', label: 'Häufigkeit' },
    { id: 'recent', label: 'Zuletzt' },
  ];

  return (
    <Screen>
      <NavBar title="Lieder" />

      <div className={styles.searchWrap}>
        <div className={styles.search}>
          <Icon name="search" size={18} stroke={2} className={styles.searchIcon} />
          <input placeholder="Lied oder Autor suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {showStats && (
          <Segment
            className={styles.segWrap}
            value={sort}
            options={SORTS.map((s) => ({ value: s.id, label: s.label }))}
            onChange={setSort}
          />
        )}
        {statMode && (
          <div className={styles.rangeBar}>
            <input
              className={styles.dateInput}
              type="date"
              aria-label="Zeitraum von"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span className={styles.rangeDash}>–</span>
            <input
              className={styles.dateInput}
              type="date"
              aria-label="Zeitraum bis"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
            <button
              type="button"
              className={`${styles.allBtn} ${allRange ? styles.allActive : ''}`}
              onClick={() => {
                setFrom('');
                setTo('');
              }}
            >
              Alle
            </button>
          </div>
        )}
      </div>

      <Scroll onRefresh={onRetry}>
        {isLoading ? (
          <CenterMessage loading text="Lieder werden geladen…" />
        ) : isError ? (
          <CenterMessage icon="⚠️" text="Lieder konnten nicht geladen werden." onRetry={onRetry} />
        ) : filtered.length === 0 ? (
          <CenterMessage
            icon="🎵"
            text={
              query
                ? `Keine Treffer für „${q}"`
                : statMode && !allRange
                  ? 'In diesem Zeitraum wurde kein Lied gespielt.'
                  : 'Keine Lieder gefunden.'
            }
          />
        ) : (
          <div className={styles.group}>
            <div className={styles.groupHdr}>{filtered.length} Lieder</div>
            <div className={styles.cardList}>
              {filtered.map((s) => (
                <div key={s.songId} className={styles.rowWrap}>
                  <button className={styles.row} onClick={() => onSelect(s)}>
                    <NoteTile />
                    <div className={styles.info}>
                      <div className={styles.name}>{s.name}</div>
                      {s.author && <div className={styles.sub}>{s.author}</div>}
                      {showStats && sort !== 'name' && (
                        <span className={styles.stat}>
                          {usageLoading
                            ? 'Statistik lädt…'
                            : sort === 'count'
                              ? `${countOf(s)}× gespielt`
                              : `zuletzt ${fmtDate(lastOf(s))}`}
                        </span>
                      )}
                    </div>
                    {s.key && <span className={styles.keyPill}>{s.key}</span>}
                    <Icon name="chev-right" size={18} stroke={2.2} className={styles.chev} />
                  </button>
                  {canAddToAgenda && (
                    <button
                      className={styles.addBtn}
                      onClick={() => setAddSong(s)}
                      aria-label={`„${s.name}" zu einem Ablauf hinzufügen`}
                      title="Zu Ablauf hinzufügen"
                    >
                      <Icon name="plus" size={20} stroke={2.4} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ height: 16 }} />
      </Scroll>

      {addSong && (
        <AddToAgendaSheet song={addSong} services={services} onClose={() => setAddSong(null)} />
      )}
    </Screen>
  );
}
