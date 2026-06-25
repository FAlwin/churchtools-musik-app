/**
 * Geräteklasse für display-abhängige Einstellungen (Spalten, Schrift, Zoom).
 * Zwei Klassen: 'phone' (Handy) und 'large' (Tablet + Computer teilen sich dieselben Werte).
 * Klassifiziert nach der größeren Bildschirmkante (orientierungsunabhängig).
 */
export function deviceClass(): 'phone' | 'large' {
  const w = window.screen?.width ?? window.innerWidth;
  const h = window.screen?.height ?? window.innerHeight;
  const maxSide = Math.max(w || 0, h || 0);
  // Moderne Handys liegen bei max. ~956px (CSS), Tablets ab ~1080px aufwärts.
  return maxSide > 0 && maxSide <= 1024 ? 'phone' : 'large';
}
