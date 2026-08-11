import { describe, it, expect } from 'vitest';
import { dateiGroesse } from './dateiGroesse';

/**
 * #321: Die Größe steht in der Dateiliste. Zwei Fälle sind dabei die eigentlichen:
 *
 *  - **`null` heißt „unbekannt", nicht „leer".** ChurchTools liefert die Größe nicht immer mit.
 *    „0 KB" wäre eine Behauptung über die Datei, ein Gedankenstrich ist die Wahrheit.
 *  - **Deutsches Dezimalkomma.** Die App spricht Deutsch; „1.4 MB" liest hier niemand.
 */
describe('dateiGroesse', () => {
  it('macht aus einer fehlenden Größe einen Gedankenstrich, nicht eine Null', () => {
    expect(dateiGroesse(null)).toBe('–');
  });

  it('zeigt eine wirklich leere Datei als 0 B – das ist eine echte Aussage', () => {
    expect(dateiGroesse(0)).toBe('0 B');
  });

  it('rechnet Bytes, Kilobyte und Megabyte', () => {
    expect(dateiGroesse(512)).toBe('512 B');
    expect(dateiGroesse(2048)).toBe('2 KB');
    expect(dateiGroesse(412 * 1024)).toBe('412 KB');
  });

  it('schreibt Megabyte mit Komma, nicht mit Punkt', () => {
    expect(dateiGroesse(1.4 * 1024 * 1024)).toBe('1,4 MB');
    expect(dateiGroesse(15 * 1024 * 1024)).toBe('15,0 MB');
  });

  it('springt genau an der Grenze um', () => {
    // 1023 B bleibt B, 1024 wird KB – sonst stünde irgendwo „1024 B".
    expect(dateiGroesse(1023)).toBe('1023 B');
    expect(dateiGroesse(1024)).toBe('1 KB');
    expect(dateiGroesse(1024 * 1024 - 1)).toBe('1024 KB');
    expect(dateiGroesse(1024 * 1024)).toBe('1,0 MB');
  });
});
