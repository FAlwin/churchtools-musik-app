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
/** Wie eine Ebene für den Wähler aussieht – `arrangementId` bewusst weit, sonst engt TS auf `null` ein. */
interface Ebene {
  versionKey: string;
  lyr: boolean;
  arrangementId: number | null;
  pages: number[];
}
const LEVELS: Ebene[] = [
  { versionKey: 'original', lyr: false, arrangementId: null, pages: [0, 1] },
  { versionKey: 'akustik', lyr: true, arrangementId: null, pages: [2] },
];

function setup(
  over: {
    sharers?: { id: number; name: string; songs: number[] }[];
    pickerPerson?: { id: number; name: string } | null;
    levels?: Ebene[];
    arrangementName?: (id: number | null) => string | null;
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
      // Standard: ein Lied mit nur EINEM Arrangement – dann steht es bewusst nicht in der Zeile.
      arrangementName={over.arrangementName ?? (() => null)}
      levelKey={(g) => `${g.arrangementId ?? ''}|${g.versionKey}|${g.lyr ? 1 : 0}`}
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
    expect(screen.getByText('Version: Original · Anzeige: Akkorde & Text')).toBeTruthy();
    expect(screen.getByText('Version: Akustik · Anzeige: Nur Text')).toBeTruthy();
    expect(screen.getByText('2 Seiten')).toBeTruthy();
    expect(screen.getByText('1 Seite')).toBeTruthy(); // Einzahl, nicht „1 Seiten"
  });

  it('meldet die gewählte Ebene vollständig zurück', () => {
    const h = setup({ pickerPerson: PERSON });
    screen.getByText('Version: Akustik · Anzeige: Nur Text').click();
    expect(h.onPickLevel).toHaveBeenCalledWith({
      versionKey: 'akustik',
      lyr: true,
      arrangementId: null,
      pages: [2],
    });
  });

  /**
   * Von Alwin gemeldet (11.08.2026): Zwei Zeilen sahen **identisch** aus – „Version „Original" ·
   * Akkorde & Text", zweimal, 1 Seite. Es waren zwei verschiedene Arrangements; das Arrangement kam
   * in der Zeile nur nicht vor. Eine Auswahl, in der zwei Einträge gleich heißen, ist keine Auswahl.
   */
  const ZWEI_ARRANGEMENTS: Ebene[] = [
    { versionKey: 'original', lyr: false, arrangementId: 45, pages: [0] },
    { versionKey: 'original', lyr: false, arrangementId: 46, pages: [0] },
  ];
  const NAMEN = (id: number | null) =>
    id === 45 ? 'Standard-Arrangement' : id === 46 ? 'Test' : 'Ohne Arrangement';

  it('unterscheidet zwei Arrangements mit derselben Version', () => {
    setup({ pickerPerson: PERSON, levels: ZWEI_ARRANGEMENTS, arrangementName: NAMEN });
    expect(screen.getByText('Arrangement: Standard-Arrangement')).toBeTruthy();
    expect(screen.getByText('Arrangement: Test')).toBeTruthy();
  });

  it('benennt Bestandsnotizen ohne Arrangement, statt sie namenlos zu lassen', () => {
    setup({
      pickerPerson: PERSON,
      levels: [{ versionKey: 'original', lyr: false, arrangementId: null, pages: [0] }],
      arrangementName: NAMEN,
    });
    expect(screen.getByText('Arrangement: Ohne Arrangement')).toBeTruthy();
  });

  it('bei nur EINEM Arrangement bleibt die Zeile kurz', () => {
    // So von Alwin entschieden: Wo nichts zu unterscheiden ist, macht der Name die Zeile nur länger.
    setup({ pickerPerson: PERSON, levels: ZWEI_ARRANGEMENTS, arrangementName: () => null });
    expect(screen.getAllByText('Version: Original · Anzeige: Akkorde & Text')).toHaveLength(2);
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
