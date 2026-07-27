/**
 * Kurz-Memo für den Live-Abgleich des Ablaufs (#198 – vorher direkt im Controller).
 *
 * Viele offene Geräte pollen alle ~8 Sekunden. Damit ChurchTools davon nicht überrannt wird, hält
 * dieses Memo den Fingerabdruck eines Termins ein paar Sekunden vor.
 *
 * **Der Schlüssel ist bewusst kontobezogen** (#199): Vorher teilten sich alle Konten einen Eintrag –
 * wer keinen Zugriff auf den Termin hatte, bekam statt eines 403 den Hash eines Berechtigten. Bei
 * acht Bandmitgliedern sind es dadurch acht CT-Abfragen je Intervall statt einer; die
 * Zugriffsprüfung ist uns das wert (#215).
 *
 * ⚠️ Prozesslokal – siehe „Ein Prozess, ein Zustand" in `docs/entwicklung/entscheidungen.md`.
 */

const TTL_MS = 5_000;

const memo = new Map<string, { hash: string; at: number }>();

/** Gemerkter Fingerabdruck, sofern er noch frisch genug ist. */
export function getMemoizedVersion(key: string): string | null {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.hash;
  return null;
}

/**
 * Fingerabdruck merken. Räumt dabei abgelaufene Einträge weg – ohne das wüchse die Map über
 * Wochen mit längst vergangenen Terminen voll.
 */
export function rememberVersion(key: string, hash: string): void {
  const now = Date.now();
  for (const [k, v] of memo) {
    if (now - v.at >= TTL_MS) memo.delete(k);
  }
  memo.set(key, { hash, at: now });
}

/** Nur für Tests: Memo leeren. */
export function clearVersionMemo(): void {
  memo.clear();
}
