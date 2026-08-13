import { describe, it, expect, vi } from 'vitest';
import { createGebuendelterLauf } from './gebuendelterLauf.js';

/**
 * Der teuerste Fall zuerst: **Fünf gleichzeitige Anfragen dürfen EINEN Lauf ergeben.** Genau das
 * Gegenteil hat in #300 das ChurchTools-Limit gerissen – fünf iPads, fünf volle Läufe, rund 1.235
 * Anfragen statt 250. Danach scheiterten Anmeldung, Rechte und Speichern gleichzeitig.
 */
describe('createGebuendelterLauf – bündeln', () => {
  it('startet bei fünf gleichzeitigen Aufrufen genau einen Lauf', async () => {
    const b = createGebuendelterLauf<number>(1000);
    const lauf = vi.fn(() => Promise.resolve(42));

    const alle = await Promise.all(Array.from({ length: 5 }, () => b.fuehreAus(lauf)));

    expect(lauf).toHaveBeenCalledTimes(1);
    expect(alle).toEqual([42, 42, 42, 42, 42]);
  });

  it('lässt danach einen NEUEN Lauf zu', async () => {
    const b = createGebuendelterLauf<number>(1000);
    const lauf = vi.fn(() => Promise.resolve(1));
    await b.fuehreAus(lauf);
    await b.fuehreAus(lauf);
    expect(lauf).toHaveBeenCalledTimes(2);
  });

  it('gibt die Bahn auch nach einem FEHLER frei', async () => {
    /**
     * Ohne `finally` hinge hier jeder weitere Aufruf an einem Versprechen, das nie erfüllt wird – die
     * Liederliste würde für immer laden, obwohl niemand mehr etwas tut.
     */
    const b = createGebuendelterLauf<number>(1000);
    const kaputt = vi.fn(() => Promise.reject(new Error('CT weg')));
    await expect(b.fuehreAus(kaputt)).rejects.toThrow('CT weg');

    // Der Beweis, dass die Bahn frei ist: Ein neuer Lauf kommt durch und liefert SEIN Ergebnis.
    const gut = vi.fn(() => Promise.resolve(7));
    expect(await b.fuehreAus(gut)).toBe(7);
    expect(gut).toHaveBeenCalledTimes(1);
  });

  it('hängt sich an einen laufenden an, statt einen zweiten zu starten', async () => {
    /**
     * Mit einem Lauf, der noch nicht fertig ist – das ist der Alltag: Fünf iPads treffen ein, während
     * der erste Aufbau läuft. Sie müssen dasselbe Ergebnis bekommen, ohne einen zweiten Lauf.
     */
    const b = createGebuendelterLauf<number>(1000);
    let loesen: (n: number) => void = () => undefined;
    const lauf = vi.fn(() => new Promise<number>((r) => (loesen = r)));

    const ersteAnfrage = b.fuehreAus(lauf);
    const zweiteAnfrage = b.fuehreAus(lauf);
    loesen(3);

    expect(await ersteAnfrage).toBe(3);
    expect(await zweiteAnfrage).toBe(3);
    expect(lauf).toHaveBeenCalledTimes(1);
  });
});

describe('createGebuendelterLauf – Sperrfrist', () => {
  it('sperrt für die vereinbarte Dauer und gibt die Restzeit an', () => {
    vi.useFakeTimers();
    try {
      const b = createGebuendelterLauf<number>(120_000);
      expect(b.istGesperrt()).toBe(false);

      b.sperren();
      expect(b.istGesperrt()).toBe(true);
      expect(b.restMs()).toBe(120_000);

      vi.advanceTimersByTime(119_999);
      expect(b.istGesperrt()).toBe(true);
      vi.advanceTimersByTime(1);
      expect(b.istGesperrt()).toBe(false);
      expect(b.restMs()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ein geglückter Lauf hebt die Sperre auf', () => {
    const b = createGebuendelterLauf<number>(120_000);
    b.sperren();
    b.entsperren();
    expect(b.istGesperrt()).toBe(false);
  });

  it('die Sperre hindert `fuehreAus` NICHT – das entscheidet der Aufrufer', async () => {
    /**
     * Absicht: Die beiden Nutzer gehen mit einer Sperre unterschiedlich um. Die Statistik liefert den
     * letzten bekannten Stand aus (besser als keine Zahlen), der Suchindex meldet „bitte kurz warten".
     * Diese Entscheidung gehört zum Fach, nicht in den Baustein.
     */
    const b = createGebuendelterLauf<number>(1000);
    b.sperren();
    expect(await b.fuehreAus(() => Promise.resolve(5))).toBe(5);
  });
});
