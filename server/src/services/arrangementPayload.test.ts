import { describe, expect, it } from 'vitest';
import {
  arrangementWritePayload,
  nummerOhneQuelle,
  quelleAufloesen,
} from './arrangementPayload.js';
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
    expect(body.isDefault).toBe(true);
  });

  /**
   * **`note` und `description` sind DASSELBE Feld** (#396, gemessen 20.09.2026): ChurchTools nennt
   * `note` selbst `@deprecated` und meint `description`; wer beides schickt, bekommt nur
   * `description` zurück. Beide im Payload wären zwei Namen für einen Wert – und welcher gewinnt,
   * entschiede ChurchTools. Der gelesene Wert muss trotzdem erhalten bleiben.
   */
  it('rettet eine nur unter `note` gelesene Beschreibung nach `description`', () => {
    const body = arrangementWritePayload(arrangement({ description: null, note: 'Kapo 2' }));
    expect(body.description).toBe('Kapo 2');
    expect('note' in body).toBe(false);
  });

  it('bevorzugt `description`, wenn beide dastehen – und schickt `note` nicht mit', () => {
    const body = arrangementWritePayload(arrangement({ description: 'Neu', note: 'Alt' }));
    expect(body.description).toBe('Neu');
    expect('note' in body).toBe(false);
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

  /**
   * Unfug in `bpm` darf **kein `NaN`** in den Payload bringen: `JSON.stringify(NaN)` ist `null`,
   * das Tempo wäre für das ganze Team gelöscht. Bis zum 21.09.2026 tat diese Stelle genau das (eine
   * von drei Kopien der Umrechnung); jetzt geht sie über `arrangementTempo`.
   */
  it('schreibt aus einem unsinnigen `bpm` gar kein Tempo – niemals `NaN`', () => {
    const body = arrangementWritePayload(arrangement({ bpm: 'irgendwas', tempo: null }));
    expect(body.tempo).toBeUndefined();
    expect(Number.isNaN(body.tempo as number)).toBe(false);
  });

  it('bevorzugt `tempo` gegenüber `bpm`, wenn beide da sind', () => {
    expect(arrangementWritePayload(arrangement({ bpm: '120', tempo: 118 })).tempo).toBe(118);
  });
});

describe('arrangementWritePayload – leere Felder', () => {
  it('lässt leere Felder weg, statt sie als null zu schicken', () => {
    const body = arrangementWritePayload(
      arrangement({ key: null, note: null, description: null }),
      { tempo: 90 },
    );
    expect('key' in body).toBe(false);
    expect('description' in body).toBe(false);
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

/**
 * Die Felder aus #396 – **jedes einzeln**, und für jedes die drei Zustände: nicht genannt, gesetzt,
 * geleert. Der gefährliche davon ist „geleert": Es geht nur, weil `PUT` ersetzt und ein
 * weggelassenes Feld danach `null` ist. Wer das für einen Fehler hält und `null` mitschickt, bekommt
 * von ChurchTools bei manchen Feldern eine Ablehnung.
 */
describe('arrangementWritePayload – alle Felder ändern (#396)', () => {
  it('setzt Name, Tonart, Takt, Länge und Beschreibung', () => {
    const body = arrangementWritePayload(arrangement(), {
      name: 'Akustik',
      key: 'G',
      beat: '3/4',
      duration: 245,
      description: 'Ohne Schlagzeug',
    });
    expect(body.name).toBe('Akustik');
    expect(body.key).toBe('G');
    expect(body.beat).toBe('3/4');
    expect(body.duration).toBe(245);
    expect(body.description).toBe('Ohne Schlagzeug');
  });

  it('zieht `keyOfArrangement` mit, wenn die Tonart wechselt – es ist derselbe Wert', () => {
    const body = arrangementWritePayload(arrangement(), { key: 'G' });
    expect(body.keyOfArrangement).toBe('G');
  });

  it('wird die Tonart geleert, muss auch der alte Name verschwinden', () => {
    const body = arrangementWritePayload(arrangement(), { key: null });
    expect('key' in body).toBe(false);
    expect('keyOfArrangement' in body).toBe(false);
  });

  it('leert ein Feld über `null` – durch Weglassen, weil PUT ersetzt', () => {
    const body = arrangementWritePayload(arrangement(), { duration: null, beat: null });
    expect('duration' in body).toBe(false);
    expect('beat' in body).toBe(false);
  });

  it('behandelt eine leere Zeichenkette wie `null`', () => {
    const body = arrangementWritePayload(arrangement(), { beat: '   ' });
    expect('beat' in body).toBe(false);
  });

  it('lässt ungenannte Felder unangetastet', () => {
    const body = arrangementWritePayload(arrangement(), { name: 'Akustik' });
    expect(body.key).toBe('C');
    expect(body.duration).toBe(300);
    expect(body.beat).toBe('4/4');
  });

  it('trimmt, was der Nutzer eintippt', () => {
    expect(arrangementWritePayload(arrangement(), { name: '  Akustik  ' }).name).toBe('Akustik');
  });
});

/**
 * Quelle und Liednummer – **die Regel, die ChurchTools stillschweigend durchsetzt** (#396):
 * Eine Liednummer wird nur mit einer Quelle gespeichert. Gemessen antwortet ein `PUT` mit
 * `sourceReference` ohne `sourceId` mit 200 und legt `null` ab; genau solche stillen Verluste
 * sollen hier auffallen.
 */
describe('quelleAufloesen und die Liednummer (#396)', () => {
  const mitQuelle = arrangement({
    source: { id: 2, name: 'Unser Liederbuch', shorty: 'ULB' },
    sourceReference: '142',
  });

  it('behält Quelle und Nummer, wenn nichts dazu gesagt wird', () => {
    expect(quelleAufloesen(mitQuelle, {})).toEqual({ sourceId: 2, sourceReference: '142' });
  });

  it('nimmt die Nummer mit, wenn die Quelle entfernt wird', () => {
    expect(quelleAufloesen(mitQuelle, { sourceId: null })).toEqual({
      sourceId: null,
      sourceReference: null,
    });
  });

  it('meldet eine Nummer ohne Quelle', () => {
    expect(nummerOhneQuelle(arrangement(), { sourceReference: '142' })).toBe(true);
  });

  it('meldet nichts, wenn die Quelle im selben Zug gesetzt wird', () => {
    expect(nummerOhneQuelle(arrangement(), { sourceId: 2, sourceReference: '142' })).toBe(false);
  });

  it('meldet auch die vorhandene Nummer, wenn nur die Quelle wegfällt – sie geht ja mit', () => {
    // Kein Fehler: Die Nummer wird zusammen mit der Quelle entfernt, nicht heimatlos zurückgelassen.
    expect(nummerOhneQuelle(mitQuelle, { sourceId: null })).toBe(true);
  });

  it('schreibt die Nummer nur zusammen mit der Quelle in den Payload', () => {
    const body = arrangementWritePayload(arrangement(), { sourceId: 2, sourceReference: '142' });
    expect(body.sourceId).toBe(2);
    expect(body.sourceReference).toBe('142');
  });

  it('lässt beides weg, wenn die Quelle entfernt wird', () => {
    const body = arrangementWritePayload(mitQuelle, { sourceId: null });
    expect('sourceId' in body).toBe(false);
    expect('sourceReference' in body).toBe(false);
  });
});
