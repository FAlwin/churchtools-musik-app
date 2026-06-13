import { useEffect, useRef, useState } from 'react';
import type { SongSearchResult } from '@shared/types/index';
import { Sheet } from './Sheet';
import { searchSongs } from '../services/churchtoolsApi';
import styles from './AddItemSheet.module.scss';

interface AddItemSheetProps {
  onClose: () => void;
  /** Legt einen Punkt an. Wirft bei Fehler (z.B. fehlende Rechte). */
  onAdd: (data: { type: 'header' | 'text' | 'song'; title?: string; arrangementId?: number }) => Promise<void>;
}

type Mode = 'choose' | 'header' | 'text' | 'song';

/** Sheet zum Hinzufügen eines Ablaufpunkts: Überschrift, Text oder Lied (per Songsuche). */
export function AddItemSheet({ onClose, onAdd }: AddItemSheetProps) {
  const [mode, setMode] = useState<Mode>('choose');
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SongSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Letzte gestartete Suchanfrage – verwirft Antworten überholter Anfragen.
  const latestQuery = useRef('');

  async function add(data: Parameters<typeof onAdd>[0]) {
    setBusy(true);
    setErr(null);
    try {
      await onAdd(data);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Hinzufügen fehlgeschlagen.');
      setBusy(false);
    }
  }

  // Live-Suche: tippt der Nutzer, wird nach kurzer Pause (Debounce) automatisch gesucht.
  useEffect(() => {
    if (mode !== 'song') return;
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
        // Nur übernehmen, wenn keine neuere Anfrage gestartet wurde.
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
  }, [query, mode]);

  const titleText =
    mode === 'header' ? 'Überschrift hinzufügen' : mode === 'text' ? 'Punkt hinzufügen' : mode === 'song' ? 'Lied hinzufügen' : 'Hinzufügen';

  return (
    <Sheet title={titleText} onClose={onClose}>
      {err && <div className={styles.err}>{err}</div>}

      {mode === 'choose' && (
        <div className={styles.choices}>
          <button className={styles.choice} onClick={() => setMode('song')}>🎵 Lied</button>
          <button className={styles.choice} onClick={() => setMode('header')}>▸ Überschrift</button>
          <button className={styles.choice} onClick={() => setMode('text')}>≡ Punkt / Text</button>
        </div>
      )}

      {(mode === 'header' || mode === 'text') && (
        <div className={styles.form}>
          <input
            className={styles.input}
            placeholder={mode === 'header' ? 'Titel der Überschrift' : 'Titel des Punkts'}
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && title.trim()) add({ type: mode, title: title.trim() });
            }}
          />
          <button
            className={styles.primary}
            disabled={!title.trim() || busy}
            onClick={() => add({ type: mode, title: title.trim() })}
          >
            {busy ? 'Füge hinzu…' : 'Hinzufügen'}
          </button>
        </div>
      )}

      {mode === 'song' && (
        <div className={styles.form}>
          <input
            className={styles.input}
            placeholder="Lied suchen…"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className={styles.results}>
            {results.flatMap((s) =>
              s.arrangements.map((a) => (
                <button
                  key={`${s.songId}-${a.arrangementId}`}
                  className={styles.result}
                  disabled={busy}
                  onClick={() => add({ type: 'song', title: s.name, arrangementId: a.arrangementId })}
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
      )}
    </Sheet>
  );
}
