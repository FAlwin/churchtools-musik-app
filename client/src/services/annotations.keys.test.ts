import { describe, it, expect } from 'vitest';
import { KEY_RE } from './annotations';

/**
 * Der Sync-Filter KEY_RE MUSS zum Schlüsselschema aus PageDeck (zoomKeyFor/drawKeyFor) passen.
 * Genau eine Drift zwischen beiden hat den Zoom-Sync im Querformat lahmgelegt: der Zoom-Schlüssel
 * endet auf die Layout-Ziffer (_dlarge2 im 2-up), die KEY_RE früher NICHT erlaubte → pushField hat
 * den Zoom verworfen. Diese Tests zementieren das Schema, damit es nicht wieder auseinanderläuft.
 */
describe('KEY_RE (Server-Sync-Filter für Anmerkungen)', () => {
  it('akzeptiert Lied-Anmerkungsschlüssel (Striche/Text) ohne Layout-Suffix', () => {
    expect(KEY_RE.test('song12_voriginal_0')).toBe(true);
    expect(KEY_RE.test('song7_vakustik-2024_3')).toBe(true);
  });

  it('akzeptiert Zoom-Schlüssel mit Geräteklasse + Layout-Ziffer (Kernfall Querformat/2-up)', () => {
    expect(KEY_RE.test('song12_voriginal_0_dlarge2')).toBe(true); // iPad Querformat (2-up)
    expect(KEY_RE.test('song12_voriginal_0_dlarge1')).toBe(true); // iPad Hochformat
    expect(KEY_RE.test('song12_voriginal_0_dphone1')).toBe(true); // Handy Hochformat
    expect(KEY_RE.test('song12_voriginal_0_dlarge')).toBe(true); // Altbestand ohne Ziffer
  });

  it('lehnt Dokument-Schlüssel (fileId-basiert) ab – die bleiben bewusst nur lokal', () => {
    expect(KEY_RE.test('98765_0')).toBe(false);
    expect(KEY_RE.test('98765_1_dlarge2')).toBe(false);
  });

  it('lehnt offensichtlich kaputte Schlüssel ab', () => {
    expect(KEY_RE.test('')).toBe(false);
    expect(KEY_RE.test('song12_0')).toBe(false); // fehlendes _v<version>
    expect(KEY_RE.test('foo')).toBe(false);
  });
});
