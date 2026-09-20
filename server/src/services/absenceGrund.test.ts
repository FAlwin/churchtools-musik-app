import { describe, it, expect } from 'vitest';
import { grundLesbar, istMarkerEintrag, markerFreitext, mitMarker } from '@shared/absences/index';

/**
 * Die Regeln aus `@shared/absences` – die eine Stelle, die App, Server und (künftig) der Sync teilen.
 *
 * `grundLesbar` gibt es, weil ChurchTools bei den Standardgründen keinen Text liefert, sondern einen
 * Übersetzungsschlüssel. Gemessen an der ECG-Instanz am 05.09.2026: `absent.reason.absence`,
 * `absent.reason.vacation`, `absent.reason.sick`; einen Endpunkt mit deutschen Namen hat die API nicht.
 */
describe('grundLesbar', () => {
  it('übersetzt die drei gemessenen Standardgründe', () => {
    expect(grundLesbar('absent.reason.absence')).toBe('Abwesend');
    expect(grundLesbar('absent.reason.vacation')).toBe('Urlaub');
    expect(grundLesbar('absent.reason.sick')).toBe('Krank');
  });

  it('lässt einen eigenen Grund der Gemeinde unverändert', () => {
    expect(grundLesbar('Fortbildung')).toBe('Fortbildung');
  });

  it('macht einen unbekannten Schlüssel lesbar, statt Technik zu zeigen', () => {
    expect(grundLesbar('absent.reason.parental_leave')).toBe('Parental leave');
  });

  it('nichts bleibt nichts', () => {
    expect(grundLesbar(null)).toBeNull();
    expect(grundLesbar('  ')).toBeNull();
  });
});

describe('Marker – Herkunftskennzeichen, kein Bearbeitungsrecht', () => {
  it('setzt und erkennt den Marker, Freitext bleibt lesbar', () => {
    expect(mitMarker('Urlaub')).toBe('[Musikteam] Urlaub');
    expect(mitMarker('')).toBe('[Musikteam]');
    expect(istMarkerEintrag('[Musikteam] Urlaub')).toBe(true);
    expect(istMarkerEintrag('Urlaub')).toBe(false);
    expect(markerFreitext('[Musikteam] Urlaub')).toBe('Urlaub');
    // Ohne Marker bleibt der Kommentar unangetastet – er stammt aus ChurchTools.
    expect(markerFreitext('Kur in Bad Nauheim')).toBe('Kur in Bad Nauheim');
  });
});
