import { describe, it, expect } from 'vitest';
import { songIdsFromQuery } from './songIdsQuery.js';

/**
 * #279: Die vier Zeilen standen dreimal wortgleich in Controllern – und alle drei behandelten den Typ
 * falsch. `req.query.songs` ist bei Express nicht immer ein String: `?songs=a&songs=b` ergibt ein
 * Array, `?songs[x]=1` ein **Objekt**. `String(obj)` wird dann zu `"[object Object]"`.
 *
 * Gefunden hat das die typbewusste Regel `no-base-to-string` – von Hand war es niemandem aufgefallen.
 * Gefährlich war es nicht (aus `[object Object]` entsteht keine gültige ID), aber es ist genau die Art
 * Eingabe-Behandlung, die später jemand kopiert.
 */
describe('songIdsFromQuery', () => {
  it('liest die normale Form `?songs=1,2,3`', () => {
    expect(songIdsFromQuery('1,2,3')).toEqual([1, 2, 3]);
  });

  it('nicht gesetzt ergibt eine leere Liste', () => {
    expect(songIdsFromQuery(undefined)).toEqual([]);
    expect(songIdsFromQuery('')).toEqual([]);
  });

  it('mehrfacher Parameter (`?songs=1&songs=2`) kommt als Array – beide zählen', () => {
    expect(songIdsFromQuery(['1', '2,3'])).toEqual([1, 2, 3]);
  });

  it('ein OBJEKT (`?songs[x]=1`) ergibt keine IDs, statt „[object Object]" zu erzeugen', () => {
    // Der eigentliche Fund: Vorher lief das durch `String(...)` und damit in den Müll.
    expect(songIdsFromQuery({ x: '1' })).toEqual([]);
  });

  it('Unsinn und negative/nicht ganze Zahlen werden verworfen', () => {
    expect(songIdsFromQuery('abc,,-1,0,1.5,7')).toEqual([7]);
  });

  it('Objekte INNERHALB eines Arrays werden übersprungen, der Rest bleibt', () => {
    expect(songIdsFromQuery(['4', { y: '9' } as unknown as string, '5'])).toEqual([4, 5]);
  });

  it('sehr große Zahlen bleiben erhalten (keine willkürliche Obergrenze)', () => {
    expect(songIdsFromQuery('999999')).toEqual([999999]);
  });
});
