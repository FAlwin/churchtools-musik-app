// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ArrangementAnsicht, SongSource } from '@shared/types/index';

/**
 * Das Arrangement-Fenster – **gegen die echte Komponente** (#396).
 *
 * Der Grund steht in `ChordEditor.test.tsx`: Am 04.09.2026 war ein Speichern-Knopf dauerhaft grau,
 * während 1034 Tests grün waren – weil die Blätter darüber den Editor mockten. Ein Formular prüft
 * man an seinen Knöpfen, nicht an seinen Props.
 *
 * Die drei Behauptungen, die hier zählen:
 *  1. „Speichern" ist gesperrt, solange sich nichts geändert hat – und geht auf, sobald etwas
 *     geändert wird.
 *  2. Eine Liednummer ohne Quelle sperrt und wird **erklärt**, statt in eine Fehlermeldung zu laufen.
 *  3. „Zum Standard machen" und „Löschen" erscheinen nur, wo sie etwas bewirken.
 */
vi.mock('../hooks/useOverlayKeyboardInset', () => ({ useOverlayKeyboardInset: () => undefined }));

const { ArrangementSheet } = await import('./ArrangementSheet');

const QUELLEN: SongSource[] = [{ id: 2, name: 'Unser Liederbuch', shorty: 'ULB' }];

const ARR: ArrangementAnsicht = {
  id: 71,
  name: 'Akustik',
  isDefault: false,
  key: 'G',
  tempo: 120,
  beat: '4/4',
  duration: 245,
  description: null,
  source: null,
  sourceReference: null,
  dateien: 0,
};

function zeige(props: Partial<Parameters<typeof ArrangementSheet>[0]> = {}) {
  const onSave = vi.fn();
  render(
    <ArrangementSheet
      arrangement={ARR}
      quellen={QUELLEN}
      speichert={false}
      fehler={null}
      onSave={onSave}
      onClose={vi.fn()}
      {...props}
    />,
  );
  return {
    onSave,
    speichern: () => screen.getByRole<HTMLButtonElement>('button', { name: 'Speichern' }),
    feld: (label: string) => screen.getByLabelText<HTMLInputElement>(label),
  };
}

describe('ArrangementSheet – Speichern', () => {
  it('sperrt, solange sich nichts geändert hat', () => {
    expect(zeige().speichern().disabled).toBe(true);
  });

  it('gibt frei, sobald ein Feld geändert wird', () => {
    const { speichern } = zeige();
    const name = screen.getByDisplayValue('Akustik');
    fireEvent.change(name, { target: { value: 'Akustik neu' } });
    expect(speichern().disabled).toBe(false);
  });

  it('schickt nur die Änderung – nicht das ganze Formular', () => {
    const { onSave, speichern } = zeige();
    fireEvent.change(screen.getByDisplayValue('G'), { target: { value: 'A' } });
    fireEvent.click(speichern());
    expect(onSave).toHaveBeenCalledWith({ name: 'Akustik', key: 'A' });
  });

  it('rechnet die Länge in Sekunden um, bevor sie hinausgeht', () => {
    const { onSave, speichern } = zeige({ arrangement: { ...ARR, duration: null } });
    fireEvent.change(screen.getByLabelText('Länge in Minuten'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Länge in Sekunden'), { target: { value: '5' } });
    fireEvent.click(speichern());
    expect(onSave).toHaveBeenCalledWith({ name: 'Akustik', duration: 245 });
  });

  it('beim Anlegen sperrt der fehlende Name, und ein Name gibt frei', () => {
    const { speichern } = zeige({ arrangement: null });
    expect(speichern().disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('z. B. Akustik'), {
      target: { value: 'Akustik' },
    });
    expect(speichern().disabled).toBe(false);
  });
});

describe('ArrangementSheet – Quelle und Liednummer', () => {
  it('sperrt bei einer Liednummer ohne Quelle und sagt, warum', () => {
    const { speichern } = zeige();
    fireEvent.change(screen.getByPlaceholderText('Optional, z. B. 142'), {
      target: { value: '142' },
    });
    expect(speichern().disabled).toBe(true);
    expect(screen.getByText(/nur zusammen mit einer Quelle/)).toBeTruthy();
  });

  it('gibt frei, sobald eine Quelle gewählt ist', () => {
    const { speichern } = zeige();
    fireEvent.change(screen.getByPlaceholderText('Optional, z. B. 142'), {
      target: { value: '142' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Unser Liederbuch' }));
    expect(speichern().disabled).toBe(false);
  });

  it('zeigt Quelle und Liednummer gar nicht, wenn die Gemeinde keine Liederbücher führt', () => {
    zeige({ quellen: [] });
    expect(screen.queryByPlaceholderText('Optional, z. B. 142')).toBeNull();
  });
});

describe('ArrangementSheet – Standard und Löschen', () => {
  it('zeigt beide Knöpfe, wenn der Aufrufer sie erlaubt', () => {
    zeige({ onStandard: vi.fn(), onLoeschen: vi.fn() });
    expect(screen.getByRole('button', { name: 'Zum Standard machen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Arrangement löschen/ })).toBeTruthy();
  });

  it('lässt sie weg, wenn sie nichts bewirken würden', () => {
    zeige();
    expect(screen.queryByRole('button', { name: 'Zum Standard machen' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Arrangement löschen/ })).toBeNull();
  });

  it('zeigt sie beim Anlegen nicht – auch wenn der Aufrufer sie mitgibt', () => {
    // Ein Arrangement, das es noch nicht gibt, kann weder Standard werden noch verschwinden.
    zeige({ arrangement: null, onStandard: vi.fn(), onLoeschen: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Zum Standard machen' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Arrangement löschen/ })).toBeNull();
  });
});
