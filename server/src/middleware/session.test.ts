import { describe, it, expect } from 'vitest';
import { parseSessionValue, isSessionExpired } from './session.js';

const TAG = 90 * 24 * 3_600_000; // absolute Obergrenze (90 Tage) in ms

describe('Session-Cookie: Zeitstempel + absolute Obergrenze', () => {
  it('neues Format: Zeitstempel und CT-Cookie werden getrennt', () => {
    const issued = 1_750_000_000_000;
    const parsed = parseSessionValue(`${issued}|ChurchTools_abc=xyz123`);
    expect(parsed.issuedAt).toBe(issued);
    expect(parsed.ctCookie).toBe('ChurchTools_abc=xyz123');
  });

  it('CT-Cookie darf selbst | und = enthalten (nur der ERSTE Trenner zählt)', () => {
    const parsed = parseSessionValue(`1750000000000|ChurchTools_a=b|c=d`);
    expect(parsed.ctCookie).toBe('ChurchTools_a=b|c=d');
  });

  it('Altformat (ohne Zeitstempel): Cookie bleibt erhalten, Lebensdauer zählt ab jetzt', () => {
    const now = 1_750_000_000_000;
    const parsed = parseSessionValue('ChurchTools_abc=xyz123', now);
    expect(parsed.ctCookie).toBe('ChurchTools_abc=xyz123');
    expect(parsed.issuedAt).toBe(now); // → wird beim nächsten Rollieren gestempelt
  });

  it('Altformat: führende Ziffern ohne | werden NICHT als Zeitstempel missverstanden', () => {
    const now = 42;
    const parsed = parseSessionValue('12345678901234567890', now);
    expect(parsed.ctCookie).toBe('12345678901234567890');
    expect(parsed.issuedAt).toBe(now);
  });

  it('innerhalb von 90 Tagen: nicht abgelaufen', () => {
    const issued = 1_000_000;
    expect(isSessionExpired(issued, issued + TAG - 1)).toBe(false);
  });

  it('nach über 90 Tagen: abgelaufen (Rollieren verlängert nicht unbegrenzt)', () => {
    const issued = 1_000_000;
    expect(isSessionExpired(issued, issued + TAG + 1)).toBe(true);
  });
});
