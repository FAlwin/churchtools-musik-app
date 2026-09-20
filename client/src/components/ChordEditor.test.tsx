// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * Der Speichern-Knopf des Editors – gegen die **echte** Komponente, nicht gegen eine Attrappe.
 *
 * Gefunden am 04.09.2026 im Browser: Mit `mitVersionsname={false}` (Original-Notenblatt) blieb
 * „Speichern" dauerhaft grau, weil `canSave` den Versionsnamen verlangte, den es gar nicht abfragt.
 * 1034 Tests waren grün – `NewSongSheet.test` und `EditSongSheet.test` mocken den Editor. Deshalb hier
 * die Regel selbst: Der Name sperrt nur, wenn er auch gefragt wird; leerer Text sperrt immer.
 */
vi.mock('./ChordProInput', () => ({ ChordProInput: () => <div data-testid="eingabe" /> }));
vi.mock('./PdfPreview', () => ({ PdfPreview: () => null }));
vi.mock('../hooks/useOverlayKeyboardInset', () => ({ useOverlayKeyboardInset: () => undefined }));

const { ChordEditor } = await import('./ChordEditor');

function zeige(props: Partial<Parameters<typeof ChordEditor>[0]> = {}) {
  const onSave = vi.fn();
  render(
    <ChordEditor
      songTitle="Treu"
      initialText={'{title: Treu}\n[D]Zeile'}
      initialName=""
      isNew
      saving={false}
      error={null}
      onSave={onSave}
      onClose={vi.fn()}
      {...props}
    />,
  );
  return {
    onSave,
    speichern: () => screen.getByRole<HTMLButtonElement>('button', { name: 'Speichern' }),
  };
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

describe('ChordEditor – Speichern ohne Versionsname-Feld (04.09.2026)', () => {
  it('ohne das Feld sperrt der fehlende Name nicht – Speichern liefert Text und leeren Namen', () => {
    const { onSave, speichern } = zeige({ mitVersionsname: false });
    expect(screen.queryByLabelText('Versionsname')).toBeNull();
    expect(speichern().disabled).toBe(false);
    fireEvent.click(speichern());
    expect(onSave).toHaveBeenCalledWith('{title: Treu}\n[D]Zeile', '');
  });

  it('mit dem Feld bleibt die Regel: ohne Namen kein Speichern', () => {
    const { speichern } = zeige();
    expect(screen.getByLabelText('Versionsname')).not.toBeNull();
    expect(speichern().disabled).toBe(true);
  });

  it('leerer Text sperrt immer – auch ohne das Feld', () => {
    const { speichern } = zeige({ mitVersionsname: false, initialText: '   ' });
    expect(speichern().disabled).toBe(true);
  });
});

/**
 * #398: Der Editor sagt an, in welcher Tonart der Text steht – und mit Kapo auch, wie gegriffen
 * wird. Ohne die Zeile rätselt man, warum das Blatt andere Akkorde zeigt als der Editor.
 */
describe('ChordEditor – Tonart-Zeile (#398)', () => {
  it('nennt die Tonart des Texts', () => {
    zeige({ tonart: 'D' });
    expect(screen.getByText('D', { selector: 'strong' })).toBeTruthy();
    expect(screen.queryByText(/gegriffen als/)).toBeNull();
  });

  it('nennt mit Kapo auch die gegriffene Tonart', () => {
    zeige({ tonart: 'D', kapo: 2 });
    expect(screen.getByText(/mit Kapo 2 gegriffen als/)).toBeTruthy();
    expect(screen.getByText('C', { selector: 'strong' })).toBeTruthy();
  });

  it('zeigt ohne Tonart keine Zeile – beim Original-Notenblatt gibt es sie nicht', () => {
    zeige();
    expect(screen.queryByText(/^Tonart/)).toBeNull();
  });
});
