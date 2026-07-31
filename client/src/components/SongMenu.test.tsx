// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { SetlistSong } from '@shared/types/index';
import { DEFAULT_SETTINGS, type SongSettings } from '../utils/chartSettings';
import { SongMenu } from './SongMenu';
import styles from '../pages/ChordChart.module.scss';

/**
 * #198: Das Lied-Menü, ausgelagert aus `pages/ChordChart.tsx`.
 *
 * Zwei Dinge sind hier wichtig und waren vorher nirgends festgehalten:
 *
 * 1. **Jede Auswahl schließt das Menü.** Vorher stand `setShowSongMenu(false)` elf Mal in den
 *    Handlern; ein vergessener Aufruf hätte das Menü offen über der Änderung stehen lassen.
 * 2. **Was bei einem Dokument NICHT erscheinen darf.** Zeigt das Lied ein hochgeladenes PDF/Bild,
 *    sind Abschnitts-Transponierung, Teilen, Bearbeiten und die Versionsliste sinnlos – sie
 *    beziehen sich alle auf den ChordPro-Text, der gerade nicht zu sehen ist.
 */
function song(over: Partial<SetlistSong> = {}): SetlistSong {
  return {
    id: 7,
    title: 'Testlied',
    documents: [],
    versions: [],
    originalKey: 'C',
    targetKey: 'C',
    bpm: null,
    ...over,
  } as unknown as SetlistSong;
}

const VERSIONS = [
  { key: 'original', name: 'Original' },
  { key: 'akustik', name: 'Akustik' },
];

function setup(over: { song?: SetlistSong; set?: Partial<SongSettings>; canEdit?: boolean } = {}) {
  const handlers = {
    onClose: vi.fn(),
    onOpenKeyPicker: vi.fn(),
    onOpenCapoPicker: vi.fn(),
    onOpenSectionTranspose: vi.fn(),
    onSharePdf: vi.fn(),
    onEditCurrent: vi.fn(),
    onNewVersion: vi.fn(),
    onDeleteVersion: vi.fn(),
    onChange: vi.fn(),
    onSelectVersion: vi.fn(),
  };
  const set = { ...DEFAULT_SETTINGS, ...over.set };
  render(
    <SongMenu
      song={over.song ?? song()}
      set={set}
      curKey="C"
      sections={[{ type: 'verse', label: 'Vers 1', lines: [] }] as never}
      versions={VERSIONS}
      currentVersion={VERSIONS.find((v) => v.key === set.versionKey) ?? VERSIONS[0]}
      isOriginal={set.versionKey === 'original'}
      hasVersions
      canEditSong={over.canEdit ?? true}
      {...handlers}
    />,
  );
  return handlers;
}

afterEach(cleanup);

describe('SongMenu – jede Auswahl schließt das Menü', () => {
  const cases: [string, keyof ReturnType<typeof setup>][] = [
    ['Transponieren', 'onOpenKeyPicker'],
    ['Kapo', 'onOpenCapoPicker'],
    ['Abschnitte transponieren', 'onOpenSectionTranspose'],
    ['Als PDF teilen', 'onSharePdf'],
    ['Neue Version…', 'onNewVersion'],
  ];

  for (const [label, handler] of cases) {
    it(`„${label}" löst die Aktion aus UND schließt`, () => {
      const h = setup();
      screen.getByText(label).click();
      expect(h[handler]).toHaveBeenCalledTimes(1);
      expect(h.onClose).toHaveBeenCalledTimes(1);
    });
  }

  it('ein Versionswechsel meldet den Schlüssel und schließt', () => {
    const h = setup();
    screen.getByText('Akustik').click();
    expect(h.onSelectVersion).toHaveBeenCalledWith('akustik');
    expect(h.onClose).toHaveBeenCalledTimes(1);
  });

  it('„Nur Text" schaltet Anzeige UND Textmodus in EINEM Schritt', () => {
    // Beides zusammen ist wichtig: Ein Dokument-Lied muss beim Wechsel auf „Nur Text" auch
    // wirklich auf die Akkord-Quelle zurückspringen.
    const h = setup({ set: { viewSource: 99 } });
    screen.getByText('Nur Text').click();
    expect(h.onChange).toHaveBeenCalledWith({ viewSource: 'chords', lyricsOnly: true });
    expect(h.onClose).toHaveBeenCalledTimes(1);
  });

  it('der Klick daneben (Scrim) schließt, ohne etwas zu ändern', () => {
    const h = setup();
    // Gezielt über die Klasse – ein „erstes div"-Selektor wäre auch grün, wenn er das Menü selbst
    // träfe, und würde damit nichts beweisen.
    const scrim = document.querySelector(`.${styles.scrim}`);
    expect(scrim).not.toBeNull();
    (scrim as HTMLElement).click();
    expect(h.onClose).toHaveBeenCalledTimes(1);
    expect(h.onChange).not.toHaveBeenCalled();
    expect(h.onSelectVersion).not.toHaveBeenCalled();
  });
});

describe('SongMenu – was zum angezeigten Inhalt passt', () => {
  it('bei einem Dokument entfallen Abschnitte, Teilen, Bearbeiten und die Versionsliste', () => {
    const withDoc = song({
      documents: [{ fileId: 99, name: 'Noten.pdf', type: 'pdf' }] as never,
    });
    setup({ song: withDoc, set: { viewSource: 99 } });
    expect(screen.queryByText('Abschnitte transponieren')).toBeNull();
    expect(screen.queryByText('Als PDF teilen')).toBeNull();
    expect(screen.queryByText('Bearbeiten (neue Version)')).toBeNull();
    expect(screen.queryByText('Akustik')).toBeNull();
    // Die Anzeige-Umschalter bleiben – sonst käme man vom Dokument nicht mehr weg.
    expect(screen.getByText('Akkorde & Text')).toBeTruthy();
    expect(screen.getByText('Noten.pdf', { exact: false })).toBeTruthy();
  });

  it('ohne Bearbeitungsrecht fehlen Bearbeiten, Neue Version und Löschen', () => {
    setup({ canEdit: false, set: { versionKey: 'akustik' } });
    expect(screen.queryByText('Bearbeiten (neue Version)')).toBeNull();
    expect(screen.queryByText('Neue Version…')).toBeNull();
    expect(screen.queryByText('„Akustik" löschen')).toBeNull();
  });

  it('das Original lässt sich nicht löschen, eine Version schon', () => {
    setup({ set: { versionKey: 'original' } });
    expect(screen.queryByText('„Original" löschen')).toBeNull();
    cleanup();
    setup({ set: { versionKey: 'akustik' } });
    expect(screen.getByText('„Akustik" löschen')).toBeTruthy();
  });
});

/**
 * Die Komponente importiert `ChordChart.module.scss` jetzt aus einem ANDEREN Verzeichnis. Wäre der
 * Pfad falsch, gäbe es keinen Fehler – CSS-Module liefern still `undefined`, und das Menü stünde
 * ohne Layout mitten auf der Seite.
 */
describe('CSS-Modul erreichbar', () => {
  it('die Einträge bekommen echte Klassennamen, nicht „undefined"', () => {
    setup();
    const cls = (screen.getByText('Transponieren').parentElement as HTMLElement).className;
    expect(cls).toBeTruthy();
    expect(cls).not.toContain('undefined');
  });
});
