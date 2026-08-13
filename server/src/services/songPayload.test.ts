import { describe, expect, it } from 'vitest';
import { songWritePayload } from './songPayload.js';
import type { CtSong } from './ctTypes.js';

/**
 * Der gefährlichste Test dieses Moduls ist der auf **Erhalt**: `PUT /api/songs/{id}` ersetzt den
 * ganzen Datensatz, alles Nicht-Gesendete ist danach leer.
 *
 * Gemessen an der ChurchTools-Test-Instanz (13.08.2026): Ein `PUT { name, categoryId }` setzte Autor,
 * CCLI-Nummer und Copyright auf `null` und `shouldPractice` auf `false`. Eine Umbenennung darf also
 * nicht nebenbei das Copyright löschen – für das ganze Team, über die App nicht wiederherstellbar.
 */
const lied = (over: Partial<CtSong> = {}): CtSong => ({
  id: 7,
  name: 'Treu',
  author: 'Autor A',
  ccli: '5841527',
  copyright: '2019 Beispielverlag',
  shouldPractice: true,
  category: { id: 0, name: 'Aktive Songs' },
  arrangements: [],
  ...over,
});

describe('songWritePayload – nichts nebenbei löschen', () => {
  it('schickt ALLE erhaltenswerten Felder mit', () => {
    const body = songWritePayload(lied(), { name: 'Treu (neu)' });
    expect(body.name).toBe('Treu (neu)');
    expect(body.author).toBe('Autor A');
    expect(body.ccli).toBe('5841527');
    expect(body.copyright).toBe('2019 Beispielverlag');
    expect(body.shouldPractice).toBe(true);
  });

  it('rechnet die gelesene `category` in das beschreibbare `categoryId` um', () => {
    // Beim Lesen ein Objekt, beim Schreiben eine Zahl. Ohne diese Umrechnung fehlte das Pflichtfeld,
    // und ChurchTools würde mit 400 antworten.
    const body = songWritePayload(lied());
    expect(body.categoryId).toBe(0);
    expect('category' in body).toBe(false);
  });

  it('behält Kategorie 0 – sie ist echt, nicht „nichts"', () => {
    expect(songWritePayload(lied({ category: { id: 0, name: 'Aktive Songs' } })).categoryId).toBe(
      0,
    );
  });

  it('schickt `note` nicht mit', () => {
    // ChurchTools markiert das Feld am Lied als deprecated und speichert es nicht (gemessen). Es
    // mitzuschicken würde einen Wert behaupten, den niemand liest.
    expect('note' in songWritePayload(lied())).toBe(false);
  });
});

describe('songWritePayload – Änderungen', () => {
  it('übernimmt die geänderten Felder getrimmt', () => {
    const body = songWritePayload(lied(), { author: '  Autor B  ', ccli: ' 999 ' });
    expect(body.author).toBe('Autor B');
    expect(body.ccli).toBe('999');
  });

  it('verschiebt in eine andere Kategorie', () => {
    expect(songWritePayload(lied(), { categoryId: 1 }).categoryId).toBe(1);
  });

  it('leert ein Feld, indem es weggelassen wird', () => {
    /**
     * Der Kern der Entwurfsentscheidung: `''` heißt „löschen". Statt zu hoffen, dass ChurchTools ein
     * gesendetes `''` als Leerung versteht (ungemessen), wird die **gemessene** Eigenschaft genutzt –
     * was im Payload fehlt, ist danach `null`.
     */
    const body = songWritePayload(lied(), { author: '', copyright: '   ' });
    expect('author' in body).toBe(false);
    expect('copyright' in body).toBe(false);
    // Der Rest bleibt selbstverständlich stehen.
    expect(body.ccli).toBe('5841527');
  });

  it('unterscheidet „nicht geändert" von „leeren"', () => {
    const unveraendert = songWritePayload(lied(), { name: 'Treu' });
    expect(unveraendert.author).toBe('Autor A');
    const geleert = songWritePayload(lied(), { name: 'Treu', author: '' });
    expect('author' in geleert).toBe(false);
  });
});

describe('songWritePayload – Pflichtfelder', () => {
  it('wirft ohne Namen, statt ein namenloses Lied zu schreiben', () => {
    expect(() => songWritePayload(lied({ name: '' }))).toThrow(/ohne Namen/);
  });

  it('wirft, wenn der Name geleert werden soll', () => {
    expect(() => songWritePayload(lied(), { name: '   ' })).toThrow(/ohne Namen/);
  });

  it('wirft ohne Kategorie, statt eine zu raten', () => {
    // Ein `?? 0` hier hätte das Lied stillschweigend nach „Aktive Songs" verschoben.
    expect(() => songWritePayload(lied({ category: null }))).toThrow(/ohne Kategorie/);
  });

  it('nimmt eine mitgegebene Kategorie, wenn das gelesene Lied keine hat', () => {
    expect(songWritePayload(lied({ category: null }), { categoryId: 2 }).categoryId).toBe(2);
  });
});
