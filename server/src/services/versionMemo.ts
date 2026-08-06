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
import { createTtlMemo } from './ttlMemo.js';

const TTL_MS = 5_000;

// Nutzt den gemeinsamen Baustein (#306) – die Map samt TTL-Prüfung und Aufräumen stand vorher hier
// von Hand und wäre für das Untertitel-Memo ein zweites Mal entstanden.
const memo = createTtlMemo<string>(TTL_MS);

/** Gemerkter Fingerabdruck, sofern er noch frisch genug ist. */
export function getMemoizedVersion(key: string): string | null {
  return memo.get(key) ?? null;
}

/** Fingerabdruck merken (räumt dabei Abgelaufenes weg). */
export function rememberVersion(key: string, hash: string): void {
  memo.set(key, hash);
}

/** Nur für Tests: Memo leeren. */
export function clearVersionMemo(): void {
  memo.clear();
}
