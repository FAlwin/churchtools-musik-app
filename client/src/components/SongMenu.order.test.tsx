// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { SongSettings } from '../utils/chartSettings';
import { SongMenu } from './SongMenu';

/**
 * #283: **Erst schließen, DANN handeln** – und zwar in genau dieser Reihenfolge.
 *
 * Lange war sie beliebig, weil jedes Overlay seine eigene Boolean-Flagge hatte. Seit alle Overlays im
 * `ChordChart` EIN Zustandsfeld teilen, setzt `onClose()` nach der Aktion deren `setOverlay(...)`
 * sofort wieder auf `null`: „Transponieren" schloss dann das Menü, **ohne** die Tonart-Auswahl zu
 * öffnen.
 *
 * Gefunden wurde das erst beim Durchklicken im Browser – Build, Lint und alle 672 Tests waren grün.
 * Genau deshalb steht die Reihenfolge jetzt hier fest: Sie ist eine Zusage an den Aufrufer, keine
 * Geschmacksfrage, und sie lässt sich sonst beim nächsten Aufräumen versehentlich umdrehen.
 */
const SETTINGS = {
  targetKey: 'G',
  capo: 0,
  cols: 1,
  fontSize: 20,
  lyricsOnly: false,
  viewSource: 'chords',
  versionKey: 'original',
  secShift: {},
} as unknown as SongSettings;

const VERSION = { key: 'original', name: 'Original' };

/** Mindest-Props, damit das Menü rendert; die Reihenfolge prüfen wir an `onOpenKeyPicker`. */
function renderMenu(spy: { onClose: () => void; onOpenKeyPicker: () => void }) {
  render(
    <SongMenu
      song={{ id: 1, title: 'Testlied', originalKey: 'G', documents: [] } as never}
      set={SETTINGS}
      curKey="G"
      sections={[{ name: 'Vers 1', lines: [] } as never]}
      arrangements={[]}
      ablaufArrangementId={1}
      versions={[VERSION]}
      currentVersion={VERSION}
      isOriginal
      hasVersions={false}
      canEditSong={false}
      onClose={spy.onClose}
      onOpenKeyPicker={spy.onOpenKeyPicker}
      onOpenCapoPicker={vi.fn()}
      onOpenSectionTranspose={vi.fn()}
      onSharePdf={vi.fn()}
      onEditCurrent={vi.fn()}
      onOpenFiles={vi.fn()}
      onNewVersion={vi.fn()}
      onDeleteVersion={vi.fn()}
      onChange={vi.fn()}
      onSelectVersion={vi.fn()}
    />,
  );
}

// Ohne globals:true in der Vitest-Konfiguration raeumt Testing Library nicht selbst auf -- sonst
// stapeln sich die Renders im gleichen Dokument und Selektoren finden alles doppelt.
afterEach(cleanup);

describe('SongMenu – Reihenfolge von Schließen und Aktion (#283)', () => {
  it('ruft onClose VOR der Aktion auf', () => {
    const reihenfolge: string[] = [];
    renderMenu({
      onClose: () => reihenfolge.push('close'),
      onOpenKeyPicker: () => reihenfolge.push('action'),
    });

    // Anker: „Abschnitte transponieren" enthält das Wort ebenfalls.
    fireEvent.click(screen.getByRole('button', { name: /^Transponieren/ }));

    expect(reihenfolge).toEqual(['close', 'action']);
  });

  it('beides wird überhaupt aufgerufen (kein Zweig verschluckt)', () => {
    const onClose = vi.fn();
    const onOpenKeyPicker = vi.fn();
    renderMenu({ onClose, onOpenKeyPicker });

    // Anker: „Abschnitte transponieren" enthält das Wort ebenfalls.
    fireEvent.click(screen.getByRole('button', { name: /^Transponieren/ }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onOpenKeyPicker).toHaveBeenCalledOnce();
  });
});
