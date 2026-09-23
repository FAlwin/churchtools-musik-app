import { describe, expect, it } from 'vitest';
import { tagAusIso } from './isoTag.js';

describe('tagAusIso (#410)', () => {
  it('liefert den Tag, wie er im Zeitpunkt steht', () => {
    expect(tagAusIso('2026-10-04T08:00:00Z')).toBe('2026-10-04');
  });

  it('nimmt bei ChurchTools-Zeitpunkten den UTC-Tag – 0:30 Uhr deutscher Zeit ist der Vortag', () => {
    // Dokumentiert die bekannte Grenze (siehe Kommentar an `tagAusIso`), damit eine Änderung auffällt.
    expect(tagAusIso('2026-10-03T22:30:00Z')).toBe('2026-10-03');
  });
});
