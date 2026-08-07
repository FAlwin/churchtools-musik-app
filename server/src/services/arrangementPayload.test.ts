import { describe, expect, it } from 'vitest';
import { arrangementWritePayload } from './arrangementPayload.js';
import type { CtArrangement } from './ctTypes.js';

/**
 * Der gefährlichste Test dieses Moduls ist der auf **Erhalt**: `PUT` ersetzt das ganze Arrangement,
 * alles Nicht-Gesendete wird `null`. Ein Tempo-Wechsel darf also nicht nebenbei die Tonart löschen –
 * und zwar für das ganze Team, unwiederbringlich über die App.
 *
 * Empirisch gegen die ChurchTools-Test-Instanz festgestellt (08.08.2026): Ein `PUT` mit nur
 * `{ name, bpm: 99 }` setzte Tonart, zweite Tonart und Dauer auf `null` – und `bpm` selbst blieb
 * ebenfalls leer, weil das beschreibbare Feld `tempo` heißt.
 */
const arrangement = (
  over: Record<string, unknown> = {},
): CtArrangement & Record<string, unknown> => ({
  id: 7,
  name: 'Standard-Arrangement',
  key: 'C',
  keyOfArrangement: 'C',
  bpm: 120,
  beat: '4/4',
  isDefault: true,
  files: [],
  duration: 300,
  note: 'Kapo 2',
  ...over,
});

describe('arrangementWritePayload – nichts nebenbei löschen', () => {
  it('schickt ALLE erhaltenswerten Felder zurück', () => {
    const body = arrangementWritePayload(arrangement(), { tempo: 96 });
    expect(body.name).toBe('Standard-Arrangement');
    expect(body.key).toBe('C');
    expect(body.keyOfArrangement).toBe('C');
    expect(body.beat).toBe('4/4');
    expect(body.duration).toBe(300);
    expect(body.note).toBe('Kapo 2');
    expect(body.isDefault).toBe(true);
  });

  it('setzt das neue Tempo', () => {
    expect(arrangementWritePayload(arrangement(), { tempo: 96 }).tempo).toBe(96);
  });

  it('behält das bestehende Tempo, wenn keines übergeben wird', () => {
    expect(arrangementWritePayload(arrangement()).tempo).toBe(120);
  });

  it('schreibt `tempo`, NICHT `bpm` – bpm ist abgeleitet und nicht beschreibbar', () => {
    const body = arrangementWritePayload(arrangement(), { tempo: 96 });
    expect(body.tempo).toBe(96);
    expect(body.bpm).toBeUndefined();
  });

  it('verträgt das Tempo als Zeichenkette – so liefert ChurchTools es', () => {
    expect(arrangementWritePayload(arrangement({ bpm: '134' })).tempo).toBe(134);
  });

  it('bevorzugt `tempo` gegenüber `bpm`, wenn beide da sind', () => {
    expect(arrangementWritePayload(arrangement({ bpm: '120', tempo: 118 })).tempo).toBe(118);
  });
});

describe('arrangementWritePayload – leere Felder', () => {
  it('lässt leere Felder weg, statt sie als null zu schicken', () => {
    const body = arrangementWritePayload(arrangement({ key: null, note: null }), { tempo: 90 });
    expect('key' in body).toBe(false);
    expect('note' in body).toBe(false);
  });

  it('kommt ohne jedes Tempo aus – dann steht auch keins im Payload', () => {
    const body = arrangementWritePayload(arrangement({ bpm: null }));
    expect('tempo' in body).toBe(false);
  });

  it('schickt kein `files` mit – das ist eine eigene Ressource', () => {
    expect('files' in arrangementWritePayload(arrangement())).toBe(false);
  });
});

describe('arrangementWritePayload – Notbremse', () => {
  it('bricht ab, wenn der Name fehlt, statt ein namenloses Arrangement zu schreiben', () => {
    expect(() => arrangementWritePayload(arrangement({ name: '' }), { tempo: 90 })).toThrow();
  });
});
