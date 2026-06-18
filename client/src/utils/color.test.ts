import { describe, it, expect } from 'vitest';
import { hexToRgb, rgba, lighten } from './color';

describe('hexToRgb', () => {
  it('zerlegt einen Hex-Wert', () => {
    expect(hexToRgb('#00616E')).toEqual({ r: 0, g: 97, b: 110 });
  });
  it('akzeptiert auch ohne führendes #', () => {
    expect(hexToRgb('EB5E28')).toEqual({ r: 235, g: 94, b: 40 });
  });
  it('erkennt Schwarz und Weiß', () => {
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe('rgba', () => {
  it('baut einen rgba-String mit Alpha', () => {
    expect(rgba('#EB5E28', 0.1)).toBe('rgba(235, 94, 40, 0.1)');
  });
});

describe('lighten', () => {
  it('mischt Richtung Weiß', () => {
    expect(lighten('#000000', 0.5)).toBe('#808080');
  });
  it('lässt Weiß unverändert', () => {
    expect(lighten('#FFFFFF', 0.35)).toBe('#ffffff');
  });
  it('hält das Hex-Format mit führender Null', () => {
    // kleiner Kanalwert -> zweistellig mit führender Null
    expect(lighten('#000010', 0)).toBe('#000010');
  });
});
