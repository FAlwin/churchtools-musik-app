import { describe, it, expect } from 'vitest';
import { agendaItemWritePayload } from './agendaPayload.js';
import type { CtAgendaItem } from './ctTypes.js';

/**
 * #212: Der riskanteste Schreibpfad des Projekts. ChurchTools ignoriert ein verschachteltes
 * `song`-Objekt und stuft den Punkt dann **unwiderruflich auf `text`** herab – die Lied-Verknüpfung
 * wäre weg. Diese Tests nageln fest, dass die Verknüpfung als top-level `arrangementId` mitgeht
 * und `type: 'song'` erhalten bleibt. Seit #200 läuft JEDES Speichern eines Lied-Punkts hier durch.
 */
const songItem = (over: Partial<CtAgendaItem> = {}): CtAgendaItem =>
  ({
    id: 1,
    title: 'Lied',
    type: 'song',
    note: 'Bitte langsam',
    duration: 240,
    isBeforeEvent: false,
    responsible: { text: '[Musik]' },
    song: { songId: 42, arrangementId: 77, title: 'Du großer Gott' },
    ...over,
  }) as CtAgendaItem;

const textItem = (over: Partial<CtAgendaItem> = {}): CtAgendaItem =>
  ({
    id: 2,
    title: 'Begrüßung',
    type: 'text',
    note: '',
    duration: 600,
    isBeforeEvent: false,
    responsible: { text: 'Willi' },
    song: null,
    ...over,
  }) as CtAgendaItem;

describe('agendaItemWritePayload – Lied-Verknüpfung bewahren', () => {
  it('Titel-Änderung an einem Lied-Punkt behält arrangementId UND type song (#200)', () => {
    const p = agendaItemWritePayload(songItem(), { title: 'Lobpreis 1' });
    expect(p.title).toBe('Lobpreis 1');
    expect(p.type).toBe('song');
    expect(p.arrangementId).toBe(77); // top-level – sonst Herabstufung auf text!
  });

  it('ohne Änderungen bleibt der Punkt exakt wie er ist (wichtig beim Umsortieren)', () => {
    const p = agendaItemWritePayload(songItem());
    expect(p).toMatchObject({
      title: 'Lied',
      type: 'song',
      note: 'Bitte langsam',
      duration: 240,
      responsible: '[Musik]',
      arrangementId: 77,
    });
    expect(p.position).toBeUndefined(); // nur beim Reorder gesetzt
  });

  it('jede andere Feld-Änderung lässt die Verknüpfung unberührt', () => {
    for (const over of [
      { note: 'neu' },
      { responsible: '[Predigt]' },
      { durationSec: 300 },
      { position: 3 },
    ]) {
      const p = agendaItemWritePayload(songItem(), over);
      expect(p.type, JSON.stringify(over)).toBe('song');
      expect(p.arrangementId, JSON.stringify(over)).toBe(77);
    }
  });
});

describe('agendaItemWritePayload – Verknüpfen und Aufheben', () => {
  it('arrangementId hebt einen Text-Punkt auf type song an', () => {
    const p = agendaItemWritePayload(textItem(), { arrangementId: 99 });
    expect(p.type).toBe('song');
    expect(p.arrangementId).toBe(99);
  });

  it('unlink macht type text OHNE arrangementId', () => {
    const p = agendaItemWritePayload(songItem(), { unlink: true });
    expect(p.type).toBe('text');
    expect(p.arrangementId).toBeUndefined();
  });

  it('unlink + neuer Titel: beides zusammen (Verknüpfung lösen und umbenennen)', () => {
    const p = agendaItemWritePayload(songItem(), { unlink: true, title: 'Instrumental' });
    expect(p.type).toBe('text');
    expect(p.title).toBe('Instrumental');
    expect(p.arrangementId).toBeUndefined();
  });

  it('unlink schlägt eine gleichzeitig übergebene arrangementId', () => {
    const p = agendaItemWritePayload(songItem(), { unlink: true, arrangementId: 99 });
    expect(p.type).toBe('text');
    expect(p.arrangementId).toBeUndefined();
  });
});

describe('agendaItemWritePayload – position und Standardwerte', () => {
  it('position wird nur gesetzt, wenn sie übergeben wurde', () => {
    expect(agendaItemWritePayload(textItem(), { position: 0 }).position).toBe(0); // auch 0!
    expect(agendaItemWritePayload(textItem()).position).toBeUndefined();
  });

  it('fehlende Felder werden zu leeren Standardwerten (CT verlangt sie)', () => {
    const bare = { id: 3, title: 'X', type: 'text', song: null } as unknown as CtAgendaItem;
    const p = agendaItemWritePayload(bare);
    expect(p).toMatchObject({ note: '', duration: 0, responsible: '', isBeforeEvent: false });
  });

  it('Überschrift behält ihren Typ', () => {
    const header = textItem({ type: 'header', title: 'Lobpreis' });
    expect(agendaItemWritePayload(header, { title: 'Anbetung' })).toMatchObject({
      type: 'header',
      title: 'Anbetung',
    });
  });

  it('Dauer 0 wird übernommen (Dauer entfernen), nicht als „fehlend" behandelt', () => {
    expect(agendaItemWritePayload(songItem(), { durationSec: 0 }).duration).toBe(0);
  });
});
