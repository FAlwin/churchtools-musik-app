import { describe, expect, it } from 'vitest';
import type { SetlistSong } from '@shared/types/index';
import { notierteTonart } from './songVersions';

/**
 * #398: Jede Version kennt ihre Tonart – und diese Funktion ist die EINE Stelle, die sie nennt.
 *
 * Vorher stand in der Anzeige überall `song.originalKey`, für jede Version. Eine in D geschriebene
 * Fassung eines G-Liedes wurde damit von G aus verschoben. Wer den Versatz an einer zweiten Stelle
 * rechnet, muss hier durch – sonst ist es wieder die halbe Regel.
 */
const song = (over: Partial<SetlistSong> = {}): SetlistSong =>
  ({
    id: 1,
    originalKey: 'G',
    targetKey: 'G',
    chordpro: '[G]Original',
    versions: [
      { key: 'akustik', name: 'Akustik', text: '{key: D}\n[D]Text', writtenKey: 'D' },
      { key: 'alt', name: 'Alt', text: '[G]Text', writtenKey: null },
    ],
    documents: [],
    ...over,
  }) as unknown as SetlistSong;

describe('notierteTonart', () => {
  it('das Original steht immer in originalKey', () => {
    expect(notierteTonart(song(), 'original')).toBe('G');
  });

  it('eine Version mit eigener Tonart-Zeile steht in DIESER Tonart', () => {
    expect(notierteTonart(song(), 'akustik')).toBe('D');
  });

  it('ohne eigene Zeile gilt die Tonart des Originals', () => {
    expect(notierteTonart(song(), 'alt')).toBe('G');
  });

  it('eine unbekannte Version fällt auf das Original zurück – nicht auf einen leeren Wert', () => {
    expect(notierteTonart(song(), 'gibt-es-nicht')).toBe('G');
  });
});
