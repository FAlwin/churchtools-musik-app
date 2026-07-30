// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SharersSheet } from './SharersSheet';

/**
 * #198: Der Personen-/Ebenen-Wähler von „Notizen von …", ausgelagert aus `pages/ChordChart.tsx`.
 *
 * Der Wähler hat zwei Stufen, und die häufigste Verwechslung ist, in welcher man steckt: Ohne
 * gewählte Person die Personen, mit Person ihre Ebenen. Wer das durcheinanderbringt, zeigt eine
 * leere Liste ohne Erklärung. Deshalb ist hier vor allem festgehalten, dass **beide leeren Fälle
 * einen Satz dazu sagen** – eine stumme leere Liste ist eine Sackgasse.
 */
const PERSON = { id: 3, name: 'Anna' };
const LEVELS = [
  { versionKey: 'original', lyr: false, pages: [0, 1] },
  { versionKey: 'akustik', lyr: true, pages: [2] },
];

function setup(
  over: {
    sharers?: { id: number; name: string; songs: number[] }[];
    pickerPerson?: { id: number; name: string } | null;
    levels?: typeof LEVELS;
  } = {},
) {
  const handlers = {
    onPickPerson: vi.fn(),
    onPickLevel: vi.fn(),
    onBackToPersons: vi.fn(),
    onClose: vi.fn(),
  };
  render(
    <SharersSheet
      songTitle="Testlied"
      sharers={over.sharers ?? [{ ...PERSON, songs: [7] }]}
      pickerPerson={over.pickerPerson ?? null}
      levels={over.levels ?? LEVELS}
      versionName={(key) => (key === 'akustik' ? 'Akustik' : 'Original')}
      levelKey={(g) => `${g.versionKey}|${g.lyr ? 1 : 0}`}
      {...handlers}
    />,
  );
  return handlers;
}

afterEach(cleanup);

describe('SharersSheet – Stufe 1: Person wählen', () => {
  it('zeigt die Personen und meldet die Auswahl', () => {
    const h = setup();
    screen.getByText('Anna').click();
    expect(h.onPickPerson).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });

  it('teilt niemand etwas, sagt es das ausdrücklich (keine stumme leere Liste)', () => {
    setup({ sharers: [] });
    expect(screen.getByText('Zurzeit teilt niemand Anmerkungen zu diesem Lied.')).toBeTruthy();
  });

  it('in Stufe 1 gibt es keinen Zurück-Knopf', () => {
    setup();
    expect(screen.queryByText('Andere Person wählen')).toBeNull();
  });
});

describe('SharersSheet – Stufe 2: Ebene wählen', () => {
  it('nennt Version, Darstellungsart und Seitenzahl', () => {
    setup({ pickerPerson: PERSON });
    expect(screen.getByText('Version „Original" · Akkorde & Text')).toBeTruthy();
    expect(screen.getByText('Version „Akustik" · Nur Text')).toBeTruthy();
    expect(screen.getByText('2 Seiten')).toBeTruthy();
    expect(screen.getByText('1 Seite')).toBeTruthy(); // Einzahl, nicht „1 Seiten"
  });

  it('meldet die gewählte Ebene vollständig zurück', () => {
    const h = setup({ pickerPerson: PERSON });
    screen.getByText('Version „Akustik" · Nur Text').click();
    expect(h.onPickLevel).toHaveBeenCalledWith({
      versionKey: 'akustik',
      lyr: true,
      pages: [2],
    });
  });

  it('hat die Person keine Ebenen, steht auch dafür ein Satz da', () => {
    setup({ pickerPerson: PERSON, levels: [] });
    expect(screen.getByText('Keine Anmerkungen zu diesem Lied vorhanden.')).toBeTruthy();
  });

  it('der Weg zurück zu den Personen ist da', () => {
    const h = setup({ pickerPerson: PERSON });
    screen.getByText('Andere Person wählen').click();
    expect(h.onBackToPersons).toHaveBeenCalledTimes(1);
  });

  it('der Titel nennt die Person, sobald eine gewählt ist', () => {
    setup({ pickerPerson: PERSON });
    expect(screen.getByText('Notizen von Anna')).toBeTruthy();
  });
});
