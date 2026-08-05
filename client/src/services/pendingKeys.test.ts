// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createPendingKeys } from './pendingKeys';

/**
 * Der Merker liegt in localStorage, damit er einen App-Neustart übersteht (#256/#275) – und er wird
 * von ZWEI Diensten genutzt (Anmerkungen und Lied-Einstellungen). Deshalb hier eigene Tests: Ein
 * Fehler an dieser Stelle würde beide gleichzeitig treffen.
 */
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('createPendingKeys', () => {
  it('merkt, liest und hakt ab', () => {
    const store = createPendingKeys('test_pending');
    expect(store.read()).toEqual(new Set());

    store.mark('a');
    store.mark('b');
    expect(store.read()).toEqual(new Set(['a', 'b']));

    store.unmark('a');
    expect(store.read()).toEqual(new Set(['b']));
  });

  it('räumt den Eintrag ganz weg, wenn nichts mehr aussteht', () => {
    const store = createPendingKeys('test_pending');
    store.mark('a');
    store.unmark('a');
    // Kein leeres Array liegen lassen – sonst sammelt sich Müll im Speicher des Geräts.
    expect(localStorage.getItem('test_pending')).toBeNull();
  });

  it('doppeltes Merken und Abhaken unbekannter Schlüssel sind harmlos', () => {
    const store = createPendingKeys('test_pending');
    store.mark('a');
    store.mark('a');
    store.unmark('gibtsnicht');
    expect(store.read()).toEqual(new Set(['a']));
  });

  it('übersteht einen Neustart – ein zweiter Store am selben Schlüssel sieht denselben Stand', () => {
    createPendingKeys('test_pending').mark('a');
    expect(createPendingKeys('test_pending').read()).toEqual(new Set(['a']));
  });

  it('zwei Dienste mit verschiedenen Schlüsseln kommen sich nicht in die Quere', () => {
    // Genau der Fall in der App: Anmerkungen und Einstellungen nutzen dasselbe Modul.
    const anno = createPendingKeys('anno_pending');
    const settings = createPendingKeys('settings_pending');
    anno.mark('song1_vorig_0');
    settings.mark('worship_key_1');

    expect(anno.read()).toEqual(new Set(['song1_vorig_0']));
    expect(settings.read()).toEqual(new Set(['worship_key_1']));
  });

  it('kaputter Inhalt gilt als „nichts ausstehend", statt zu werfen', () => {
    // Ein Wurf hier würde den ganzen Start blockieren – der Merker ist nur eine Hilfe, keine Wahrheit.
    localStorage.setItem('test_pending', 'kein JSON');
    expect(createPendingKeys('test_pending').read()).toEqual(new Set());
  });

  it('fremde Struktur (kein Array) gilt ebenfalls als leer', () => {
    localStorage.setItem('test_pending', JSON.stringify({ a: 1 }));
    expect(createPendingKeys('test_pending').read()).toEqual(new Set());
  });

  it('nicht-String-Einträge werden herausgefiltert', () => {
    localStorage.setItem('test_pending', JSON.stringify(['gut', 42, null]));
    expect(createPendingKeys('test_pending').read()).toEqual(new Set(['gut']));
  });

  it('voller Gerätespeicher verhindert das Merken, wirft aber nicht', () => {
    // Der Upload selbst soll trotzdem laufen – dann verhält es sich wie vor dem Merker.
    const store = createPendingKeys('test_pending');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => store.mark('a')).not.toThrow();
  });
});
