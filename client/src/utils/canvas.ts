/** Reine Hilfsfunktionen rund um die Zeichen-Leinwand (gut testbar, ohne DOM). */

/**
 * Enthalten die RGBA-Pixeldaten mindestens einen nicht-transparenten Pixel?
 * (Prüft nur den Alpha-Kanal jedes 4er-Tupels.)
 */
export function hasOpaquePixel(data: Uint8ClampedArray | number[]): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return true;
  }
  return false;
}
