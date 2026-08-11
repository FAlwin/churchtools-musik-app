// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { SetlistSong, SongArrangementOption } from '@shared/types/index';
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

function setup(
  over: {
    song?: SetlistSong;
    set?: Partial<SongSettings>;
    canEdit?: boolean;
    arrangements?: SongArrangementOption[];
  } = {},
) {
  const handlers = {
    onClose: vi.fn(),
    onOpenKeyPicker: vi.fn(),
    onOpenCapoPicker: vi.fn(),
    onOpenSectionTranspose: vi.fn(),
    onSharePdf: vi.fn(),
    onEditCurrent: vi.fn(),
    onOpenFiles: vi.fn(),
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
      arrangements={over.arrangements ?? []}
      ablaufArrangementId={1}
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

describe('SongMenu – Arrangement umschalten (#320)', () => {
  // Namen bewusst NICHT „Akustik": Die Test-Vorlage hat schon eine VERSION dieses Namens, und die
  // Verwechslung ist genau der Unterschied, den die Oberfläche erkennbar machen soll – Versionen
  // sind ChordPro-Dateien INNERHALB eines Arrangements.
  const arrs = [
    { arrangementId: 1, arrangementName: 'Band', key: null, bpm: null, isDefault: true },
    { arrangementId: 2, arrangementName: 'Unplugged', key: null, bpm: null, isDefault: false },
  ] as unknown as SongArrangementOption[];

  it('zeigt die Auswahl bei mehreren Arrangements', () => {
    setup({ arrangements: arrs, song: song({ arrangementId: 1 }) });
    expect(screen.getByText('Arrangement')).toBeTruthy();
    expect(screen.getByText('Band')).toBeTruthy();
    expect(screen.getByText('Unplugged')).toBeTruthy();
  });

  it('zeigt bei nur einem NICHTS – kein Bedienelement ohne Zweck', () => {
    setup({ arrangements: [arrs[0]], song: song({ arrangementId: 1 }) });
    expect(screen.queryByText('Arrangement')).toBeNull();
  });

  it('merkt eine Abweichung als Nummer', () => {
    const props = setup({ arrangements: arrs, song: song({ arrangementId: 1 }) });
    screen.getByText('Unplugged').click();
    expect(props.onChange).toHaveBeenCalledWith({ arrangementId: 2 });
  });

  it('merkt die Wahl auf das Ablauf-Arrangement als „keine Wahl"', () => {
    // Sonst hielte die App an einer Nummer fest, die einmal die richtige war: Ändert das Team den
    // Ablauf später, soll die App wieder folgen.
    const props = setup({ arrangements: arrs, song: song({ arrangementId: 2 }) });
    screen.getByText('Band').click();
    expect(props.onChange).toHaveBeenCalledWith({ arrangementId: null });
  });
});

/**
 * #321: Der Einstieg in die Dateiverwaltung.
 *
 * Zwei Zusagen: Er erscheint **nur** für Berechtigte (Dateien in ChurchTools zu ändern ist kein
 * Anzeige-Detail), und er erscheint **auch bei einem Dokument** – wer ein PDF ansieht, will genau
 * dort ein neues hochladen können. Der Bearbeiten-Punkt daneben ist an Akkorde gebunden, dieser
 * bewusst nicht.
 */
describe('SongMenu – Dateien (#321)', () => {
  it('zeigt „Dateien …" für Berechtigte und meldet den Klick', () => {
    const h = setup({ canEdit: true });
    screen.getByText('Dateien …').click();
    expect(h.onOpenFiles).toHaveBeenCalledTimes(1);
  });

  it('zeigt es NICHT ohne Berechtigung', () => {
    setup({ canEdit: false });
    expect(screen.queryByText('Dateien …')).toBeNull();
  });

  it('zeigt es auch, wenn gerade ein Dokument angesehen wird', () => {
    // `viewSource` ist dann eine Datei-ID statt 'chords'. „Bearbeiten" verschwindet hier zu Recht –
    // „Dateien" muss bleiben, sonst käme man beim PDF nicht an die Dateiverwaltung.
    setup({ canEdit: true, set: { viewSource: 4711 } });
    expect(screen.getByText('Dateien …')).toBeTruthy();
    expect(screen.queryByText('Bearbeiten (neue Version)')).toBeNull();
  });
});
