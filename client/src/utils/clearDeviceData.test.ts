// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearDeviceData } from './clearDeviceData';

vi.mock('../queryClient', () => ({ clearPersistedCache: vi.fn().mockResolvedValue(undefined) }));

describe('clearDeviceData (Abmelde-Aufräumen, geteilte Geräte)', () => {
  beforeEach(() => localStorage.clear());

  it('entfernt Konto-Daten (worship_…), behält Geräte-Präferenzen (worship:… / musikapp:…)', async () => {
    localStorage.setItem('worship_docdraw_song1_voriginal_0', 'png…');
    localStorage.setItem('worship_doczoom_song1_voriginal_0', '{"x":1}');
    localStorage.setItem('worship_ver_5', 'original');
    localStorage.setItem('worship:onboard-termine-v1', '1');
    localStorage.setItem('worship:offline-auto', '1');
    localStorage.setItem('musikapp:kbHeight', '313');

    await clearDeviceData();

    expect(localStorage.getItem('worship_docdraw_song1_voriginal_0')).toBeNull();
    expect(localStorage.getItem('worship_doczoom_song1_voriginal_0')).toBeNull();
    expect(localStorage.getItem('worship_ver_5')).toBeNull();
    expect(localStorage.getItem('worship:onboard-termine-v1')).toBe('1');
    expect(localStorage.getItem('worship:offline-auto')).toBe('1');
    expect(localStorage.getItem('musikapp:kbHeight')).toBe('313');
  });

  it('leert das Offline-Verzeichnis', async () => {
    localStorage.setItem('worship:offline-services', JSON.stringify({ 7: { savedAt: 1, date: '2026-07-12' } }));
    await clearDeviceData();
    expect(localStorage.getItem('worship:offline-services')).toBe('{}');
  });

  it('löscht den persistierten Query-Cache (IndexedDB)', async () => {
    const { clearPersistedCache } = await import('../queryClient');
    await clearDeviceData();
    expect(clearPersistedCache).toHaveBeenCalled();
  });
});
