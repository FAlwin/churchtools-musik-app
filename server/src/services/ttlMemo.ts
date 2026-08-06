/**
 * Kleiner Zwischenspeicher mit Verfallszeit – EINE Umsetzung für alle Memos (#306).
 *
 * Es gab diese Mechanik schon einmal handgeschrieben (`versionMemo.ts`), und mit dem Untertitel-Memo
 * wäre sie ein zweites Mal entstanden: dieselbe Map, dieselbe TTL-Prüfung, dasselbe Aufräumen beim
 * Schreiben. Genau die Fehlerklasse, die dieses Projekt am häufigsten getroffen hat – eine Regel an
 * zwei Stellen, korrigiert nur an einer. Deshalb liegt sie hier einmal.
 *
 * **`get` unterscheidet „nicht gemerkt" von „gemerkt, Wert ist `null`".** Das ist kein Detail: Beim
 * Untertitel ist `null` (= dieser Termin hat keinen) der HÄUFIGSTE Fall. Würde er als „nicht gemerkt"
 * gelten, holte ihn jeder Poll erneut – und der Speicher spart genau nichts.
 *
 * Aufräumen passiert beim Schreiben, nicht per Timer: Ein Intervall würde den Prozess wachhalten und
 * beim Herunterfahren stören (#251).
 *
 * ⚠️ Prozesslokal – siehe „Ein Prozess, ein Zustand" in `docs/entwicklung/entscheidungen.md`.
 */
export interface TtlMemo<T> {
  /** Gemerkter Wert, oder `undefined`, wenn nichts (mehr) da ist. `null` ist ein gültiger Wert. */
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  clear(): void;
  /** Nur für Tests: wie viele Einträge liegen gerade drin (nach dem Aufräumen). */
  readonly size: number;
}

export function createTtlMemo<T>(ttlMs: number): TtlMemo<T> {
  const memo = new Map<string, { value: T; at: number }>();

  return {
    get(key) {
      const hit = memo.get(key);
      if (hit && Date.now() - hit.at < ttlMs) return hit.value;
      return undefined;
    },
    set(key, value) {
      const now = Date.now();
      // Abgelaufene Fremd-Einträge bei dieser Gelegenheit räumen – sonst wächst die Map über die
      // Laufzeit mit längst vergangenen Terminen voll.
      for (const [k, v] of memo) {
        if (now - v.at >= ttlMs) memo.delete(k);
      }
      memo.set(key, { value, at: now });
    },
    clear() {
      memo.clear();
    },
    get size() {
      return memo.size;
    },
  };
}
