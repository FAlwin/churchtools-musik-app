import { useEffect, useRef, useState } from 'react';
import type { SongSearchResult } from '@shared/types/index';
import { searchSongs } from '../services/churchtoolsApi';
import styles from './SongSearch.module.scss';

interface SongSearchProps {
  /** Wird mit dem gewählten Arrangement + Songname aufgerufen. */
  onPick: (arrangementId: number, songName: string) => void;
  /** Deaktiviert die Treffer (z.B. während ein Vorgang läuft). */
  busy?: boolean;
  autoFocus?: boolean;
}

/** Wiederverwendbare Lied-Suche (Live-Suche mit Debounce) – genutzt zum Hinzufügen und Verknüpfen. */
export function SongSearch({ onPick, busy, autoFocus }: SongSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SongSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Letzte gestartete Suchanfrage – verwirft Antworten überholter Anfragen.
  const latestQuery = useRef('');

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    latestQuery.current = q;
    const handle = setTimeout(async () => {
      try {
        const res = await searchSongs(q);
        if (latestQuery.current !== q) return;
        setResults(res);
        setErr(null);
      } catch (e) {
        if (latestQuery.current === q) setErr(e instanceof Error ? e.message : 'Suche fehlgeschlagen.');
      } finally {
        if (latestQuery.current === q) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className={styles.form}>
      {err && <div className={styles.err}>{err}</div>}
      <input
        className={styles.input}
        placeholder="Lied suchen…"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className={styles.results}>
        {results.flatMap((s) =>
          s.arrangements.map((a) => (
            <button
              key={`${s.songId}-${a.arrangementId}`}
              className={styles.result}
              disabled={busy}
              onClick={() => onPick(a.arrangementId, s.name)}
            >
              <span className={styles.songName}>{s.name}</span>
              <span className={styles.arrMeta}>
                {a.arrangementName}
                {a.key ? ` · ${a.key}` : ''}
              </span>
            </button>
          )),
        )}
        {searching && <div className={styles.empty}>Suche…</div>}
        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <div className={styles.empty}>Keine Treffer.</div>
        )}
      </div>
    </div>
  );
}
