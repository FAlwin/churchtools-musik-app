/**
 * Kleine, reine Farb-Hilfen für das Laufzeit-Branding.
 * Wandeln eine Hex-Markenfarbe in die abgeleiteten CSS-Werte (rgba, aufgehellt) um.
 */

/** '#00616E' → {r,g,b}. Akzeptiert mit/ohne führendem #. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Hex + Alpha → 'rgba(r, g, b, a)'. */
export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Mischt eine Hex-Farbe mit Weiß (amount 0..1) → hellere Hex-Variante. */
export function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const toHex = (c: number) => c.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}
