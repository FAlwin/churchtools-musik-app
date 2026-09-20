/**
 * Die **Liedquellen** (Liederbücher) einer Gemeinde (#396).
 *
 * Sie stehen im ChurchTools-Dialog als Auswahl hinter „Quelle", und sie kommen von dort, wo schon
 * die Lied-Kategorien und die Abwesenheitsgründe herkommen: der alten churchservice-Schnittstelle
 * (`getMasterData` → `songsource`). Die `/api/`-Welt hat dafür keinen Endpunkt – gemessen am
 * 20.09.2026 (`/api/songsources`, `/api/masterdata/songsources`: beide 404).
 *
 * **Das ist die DRITTE Tabelle aus `getMasterData`** – nach `songcategory` (`ctSongCategories.ts`)
 * und `absent_reason` (`absences.ts`). Alle drei haben dieselbe Grammatik: IDs kommen als
 * Zeichenkette, deshalb überall `ctId`.
 *
 * **Warum es hier keinen Rückfall gibt** (anders als bei den Kategorien): Eine Quelle lässt sich
 * nicht aus den Liedern rekonstruieren – am Arrangement steht nur die ID, den Namen kennt allein
 * diese Tabelle. Antwortet die alte Schnittstelle nicht, bleibt die Liste leer, und die Oberfläche
 * sagt das. Eine geratene Liste wäre schlimmer: Wer die falsche Quelle wählt, schreibt sie für alle
 * nach ChurchTools.
 */
import { ctAjax } from './ctAjax.js';
import { ctId } from '../utils/ctId.js';
import type { SongSource } from '@shared/types/index';

/** Meldungen für die alte Schnittstelle – Quellen, nicht Kategorien (siehe `AjaxMeldungen`). */
const QUELL_MELDUNGEN = {
  verweigert: 'Keine Berechtigung, die Liedquellen in ChurchTools zu lesen.',
  abgelehnt: 'ChurchTools hat die Anfrage nach den Liedquellen abgelehnt',
  unlesbar: 'ChurchTools lieferte keine lesbare Antwort für die Liedquellen.',
  fehlgeschlagen: 'Die Liedquellen konnten nicht geladen werden.',
  innenUnlesbar: 'Die Quellen-Liste von ChurchTools war nicht lesbar.',
};

/**
 * So liefert die alte Schnittstelle eine Quelle – alles als Zeichenkette.
 *
 * **Und sie liefert ein Objekt, keine Liste** (gemessen: `{"2": {...}}`, nach ID geschlüsselt) –
 * anders als bei `songcategory`, das als Array kommt. Deshalb wird unten über `Object.values`
 * gegangen und nicht blind `?? []` gesetzt: Ein Array-`map` auf ein Objekt wirft nicht, es liefert
 * **leer** – die Quellen wären stillschweigend verschwunden.
 */
interface RohQuelle {
  id?: string | number;
  name?: string;
  shorty?: string;
  sortkey?: string | number;
}

/**
 * Alle Liedquellen der Instanz.
 *
 * Die Reihenfolge kommt von ChurchTools (`sortkey`), wie bei den Abwesenheitsgründen – „die erste"
 * ist also nicht willkürlich, sondern die, die die Gemeinde vorn haben wollte.
 */
export async function getSongSources(cookie: string): Promise<SongSource[]> {
  const daten = (await ctAjax(cookie, 'getMasterData', {}, QUELL_MELDUNGEN)) as {
    songsource?: Record<string, RohQuelle> | RohQuelle[];
  };
  const roh = daten.songsource;
  // Beide Formen zulassen: heute ein Objekt, bei `songcategory` ein Array – und morgen vielleicht
  // umgekehrt. `Object.values` deckt beides ab, ohne dass jemand die Form raten muss.
  const liste: RohQuelle[] = roh ? Object.values(roh) : [];

  return liste
    .map((q) => ({
      id: ctId(q.id),
      name: (q.name ?? '').trim(),
      shorty: (q.shorty ?? '').trim(),
      sortkey: Number(q.sortkey ?? 0),
    }))
    .filter((q): q is { id: number; name: string; shorty: string; sortkey: number } => {
      return q.id !== null && !!q.name;
    })
    .sort((a, b) => a.sortkey - b.sortkey || a.name.localeCompare(b.name, 'de'))
    .map(({ id, name, shorty }) => ({ id, name, shorty }));
}
