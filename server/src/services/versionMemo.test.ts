import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getMemoizedVersion, rememberVersion, clearVersionMemo } from './versionMemo.js';

/**
 * #283: `clearVersionMemo` trug den Kommentar „Nur für Tests" – **es gab aber keinen einzigen Test**.
 * Dabei sind TTL und Aufräumen rein und in wenigen Zeilen prüfbar, und beides ist nicht harmlos:
 *
 *  - Wäre die TTL kaputt, würden die Geräte ChurchTools mit ihrem 8-Sekunden-Polling überrennen
 *    (oder – umgekehrt – eine Ablauf-Änderung minutenlang nicht sehen).
 *  - Ohne das Aufräumen wüchse die Map über Wochen mit längst vergangenen Terminen voll.
 *
 * Die Zeit wird mit Fake-Timern gestellt, nicht durch Warten: Ein Test, der 5 Sekunden schläft, wäre
 * langsam UND unzuverlässig.
 */
beforeEach(() => {
  vi.useFakeTimers();
  clearVersionMemo();
});

afterEach(() => vi.useRealTimers());

describe('versionMemo – frisch gemerkte Werte', () => {
  it('gibt einen eben gemerkten Fingerabdruck zurück', () => {
    rememberVersion('u42:1500', 'hash-a');
    expect(getMemoizedVersion('u42:1500')).toBe('hash-a');
  });

  it('kennt einen fremden Schlüssel nicht', () => {
    rememberVersion('u42:1500', 'hash-a');
    expect(getMemoizedVersion('u43:1500')).toBeNull();
  });

  it('ein neuer Wert überschreibt den alten', () => {
    rememberVersion('u42:1500', 'hash-a');
    rememberVersion('u42:1500', 'hash-b');
    expect(getMemoizedVersion('u42:1500')).toBe('hash-b');
  });

  it('kontobezogene Schlüssel bleiben getrennt (#199)', () => {
    // Der Kern der Trennung: Sonst bekäme ein Konto ohne Zugriff den Hash eines Berechtigten.
    rememberVersion('u42:1500', 'hash-a');
    rememberVersion('u99:1500', 'hash-b');
    expect(getMemoizedVersion('u42:1500')).toBe('hash-a');
    expect(getMemoizedVersion('u99:1500')).toBe('hash-b');
  });
});

describe('versionMemo – Ablauf (TTL)', () => {
  it('kurz vor Ablauf gilt der Wert noch', () => {
    rememberVersion('k', 'hash');
    vi.advanceTimersByTime(4_999);
    expect(getMemoizedVersion('k')).toBe('hash');
  });

  it('nach Ablauf gilt er nicht mehr', () => {
    rememberVersion('k', 'hash');
    vi.advanceTimersByTime(5_000);
    expect(getMemoizedVersion('k')).toBeNull();
  });
});

describe('versionMemo – Aufräumen beim Schreiben', () => {
  it('abgelaufene Einträge verschwinden, sobald etwas Neues gemerkt wird', () => {
    // Ohne das wüchse die Map über Wochen mit vergangenen Terminen voll.
    rememberVersion('alt', 'hash-alt');
    vi.advanceTimersByTime(6_000);
    rememberVersion('neu', 'hash-neu');

    expect(getMemoizedVersion('alt')).toBeNull();
    expect(getMemoizedVersion('neu')).toBe('hash-neu');
  });

  it('noch frische Einträge werden dabei NICHT weggeräumt', () => {
    rememberVersion('frisch', 'hash-f');
    vi.advanceTimersByTime(1_000);
    rememberVersion('noch-frischer', 'hash-n');

    expect(getMemoizedVersion('frisch')).toBe('hash-f');
    expect(getMemoizedVersion('noch-frischer')).toBe('hash-n');
  });

  it('clearVersionMemo leert alles', () => {
    rememberVersion('a', '1');
    rememberVersion('b', '2');
    clearVersionMemo();
    expect(getMemoizedVersion('a')).toBeNull();
    expect(getMemoizedVersion('b')).toBeNull();
  });
});
