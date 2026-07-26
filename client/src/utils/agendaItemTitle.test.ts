import { describe, it, expect } from 'vitest';
import { itemTitleParts, itemLabel } from './agendaItemTitle';

/** Regeln der Anzeige-Bezeichnung (#200) – gelten in Liste, Vollansicht und Dialogen gleich. */
describe('itemTitleParts', () => {
  it('ohne Lied: nur der eigene Titel', () => {
    expect(itemTitleParts({ title: 'Begrüßung', song: null })).toEqual({
      title: 'Begrüßung',
      songName: null,
    });
  });

  it('mit Lied und eigenem Titel: beides (CT-Format)', () => {
    expect(itemTitleParts({ title: 'Lied', song: { title: 'Du großer Gott' } })).toEqual({
      title: 'Lied',
      songName: 'Du großer Gott',
    });
  });

  it('leerer Titel: der Liedname wird die Bezeichnung', () => {
    expect(itemTitleParts({ title: '   ', song: { title: 'Würdig ist das Lamm' } })).toEqual({
      title: 'Würdig ist das Lamm',
      songName: null,
    });
  });

  it('Titel gleich Liedname: keine Dopplung', () => {
    expect(itemTitleParts({ title: 'Ruft zu dem Herrn', song: { title: 'Ruft zu dem Herrn' } })).toEqual(
      { title: 'Ruft zu dem Herrn', songName: null },
    );
  });

  it('Dopplung wird auch bei abweichender Groß-/Kleinschreibung und Rand-Leerzeichen erkannt', () => {
    expect(itemTitleParts({ title: ' du GROSSER gott ', song: { title: 'Du grosser Gott' } })).toEqual(
      { title: 'Du grosser Gott', songName: null },
    );
  });

  it('Titel wird für die Anzeige getrimmt', () => {
    expect(itemTitleParts({ title: '  Lobpreis 1  ', song: { title: 'Ruft zu dem Herrn' } })).toEqual(
      { title: 'Lobpreis 1', songName: 'Ruft zu dem Herrn' },
    );
  });
});

describe('itemLabel', () => {
  it('verbindet Titel und Liedname mit Gedankenstrich', () => {
    expect(itemLabel({ title: 'Lied', song: { title: 'Du großer Gott' } })).toBe(
      'Lied – Du großer Gott',
    );
  });

  it('nur der Titel, wenn der Liedname nichts hinzufügt', () => {
    expect(itemLabel({ title: 'Predigt', song: null })).toBe('Predigt');
    expect(itemLabel({ title: '', song: { title: 'Würdig ist das Lamm' } })).toBe(
      'Würdig ist das Lamm',
    );
  });
});
