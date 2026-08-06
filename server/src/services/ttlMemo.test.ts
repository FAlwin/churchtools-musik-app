import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTtlMemo } from './ttlMemo.js';

/**
 * #306: Diese Mechanik gab es schon handgeschrieben (`versionMemo`) und wäre für das Untertitel-Memo
 * ein zweites Mal entstanden. Jetzt liegt sie einmal – also braucht sie eigene Tests, denn ein Fehler
 * hier trifft beide Nutzer gleichzeitig.
 *
 * Zeit wird mit Fake-Timern gestellt, nicht durch Warten: Ein Test, der zehn Minuten schläft, wäre
 * unbrauchbar.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createTtlMemo', () => {
  it('gibt einen eben gemerkten Wert zurück', () => {
    const m = createTtlMemo<string>(1000);
    m.set('a', 'wert');
    expect(m.get('a')).toBe('wert');
  });

  it('kennt einen fremden Schlüssel nicht', () => {
    const m = createTtlMemo<string>(1000);
    m.set('a', 'wert');
    expect(m.get('b')).toBeUndefined();
  });

  it('vergisst nach Ablauf der Zeit', () => {
    const m = createTtlMemo<string>(1000);
    m.set('a', 'wert');
    vi.advanceTimersByTime(1001);
    expect(m.get('a')).toBeUndefined();
  });

  it('hält den Wert bis kurz vor Ablauf', () => {
    // Gegenrichtung: Die Zeit darf nicht zu früh ablaufen, sonst spart das Memo nichts.
    const m = createTtlMemo<string>(1000);
    m.set('a', 'wert');
    vi.advanceTimersByTime(999);
    expect(m.get('a')).toBe('wert');
  });

  it('ein gemerktes `null` ist ein TREFFER, kein Fehltreffer', () => {
    // Der Kern für das Untertitel-Memo: „dieser Termin hat keinen Untertitel" ist der HÄUFIGSTE Fall.
    // Gälte er als „nicht gemerkt", holte ihn jeder Poll erneut – und das Memo spart nichts.
    const m = createTtlMemo<string | null>(1000);
    m.set('a', null);
    expect(m.get('a')).toBeNull();
    expect(m.get('a')).not.toBeUndefined();
  });

  it('räumt abgelaufene Fremd-Einträge beim Schreiben weg', () => {
    // Ohne das wüchse die Map über die Laufzeit voll – bei einem Server, der Wochen läuft, relevant.
    const m = createTtlMemo<string>(1000);
    m.set('alt1', 'x');
    m.set('alt2', 'y');
    expect(m.size).toBe(2);

    vi.advanceTimersByTime(1001);
    m.set('neu', 'z');
    expect(m.size).toBe(1); // die beiden alten sind weg
    expect(m.get('neu')).toBe('z');
  });

  it('delete wirft genau einen Eintrag weg, die anderen bleiben', () => {
    // Für das CSRF-Token (#298): Ein abgelehnter Schreibvorgang darf nur das eigene Token verwerfen,
    // nicht die Token aller anderen Sitzungen.
    const m = createTtlMemo<string>(1000);
    m.set('a', 'eins');
    m.set('b', 'zwei');
    m.delete('a');
    expect(m.get('a')).toBeUndefined();
    expect(m.get('b')).toBe('zwei');
  });

  it('delete auf einen unbekannten Schlüssel tut nichts (und wirft nicht)', () => {
    const m = createTtlMemo<string>(1000);
    m.set('a', 'eins');
    m.delete('gibtsnicht');
    expect(m.get('a')).toBe('eins');
    expect(m.size).toBe(1);
  });

  it('clear leert alles', () => {
    const m = createTtlMemo<string>(1000);
    m.set('a', 'wert');
    m.clear();
    expect(m.get('a')).toBeUndefined();
    expect(m.size).toBe(0);
  });

  it('zwei Memos sind unabhängig voneinander', () => {
    // `versionMemo` (5 s) und das Untertitel-Memo (10 min) dürfen sich nicht in die Quere kommen.
    const kurz = createTtlMemo<string>(1000);
    const lang = createTtlMemo<string>(60_000);
    kurz.set('a', 'kurz');
    lang.set('a', 'lang');

    vi.advanceTimersByTime(1001);
    expect(kurz.get('a')).toBeUndefined();
    expect(lang.get('a')).toBe('lang');
  });
});
