import { describe, it, expect } from 'vitest';
import { hasOpaquePixel } from './canvas';

describe('hasOpaquePixel', () => {
  it('false bei komplett transparenten Pixeln', () => {
    expect(hasOpaquePixel([0, 0, 0, 0, 255, 255, 255, 0])).toBe(false);
  });
  it('true, sobald ein Pixel Alpha > 0 hat', () => {
    expect(hasOpaquePixel([0, 0, 0, 0, 10, 20, 30, 200])).toBe(true);
  });
  it('false bei leeren Daten', () => {
    expect(hasOpaquePixel([])).toBe(false);
  });
});
