// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Absence } from '@shared/types/index';
import { AbsenceSheet, schnellwahlZeitraum } from './AbsenceSheet';

/**
 * Das eine Fenster für Eintragen UND Ändern (#177, 05.09.2026). Geprüft wird, was Alwin an den
 * Entwürfen gewählt hat: Schnellwahl statt Vorab-Antippen, und Löschen dort, wo auch der Zeitraum
 * steht.
 */
const HEUTE = '2026-10-05'; // ein Montag

const EIGENE: Absence = {
  id: 7,
  startDate: '2026-11-02',
  endDate: '2026-11-04',
  comment: 'Reise',
  reason: null,
  eigene: true,
};

function zeige(props: Partial<Parameters<typeof AbsenceSheet>[0]> = {}) {
  const onSubmit = vi.fn();
  const onDelete = vi.fn();
  render(
    <AbsenceSheet
      entwurf={{ art: 'neu', tag: HEUTE }}
      heute={HEUTE}
      laeuft={false}
      loeschtGerade={false}
      onClose={vi.fn()}
      onSubmit={onSubmit}
      onDelete={onDelete}
      {...props}
    />,
  );
  return { onSubmit, onDelete };
}

describe('schnellwahlZeitraum – die vier Fälle, die es wirklich gibt', () => {
  it('„nur dieser Tag", eine und zwei Wochen zählen ab dem Starttag', () => {
    expect(schnellwahlZeitraum('tag', HEUTE)).toEqual({
      startDate: HEUTE,
      endDate: HEUTE,
    });
    expect(schnellwahlZeitraum('w1', HEUTE)).toEqual({
      startDate: HEUTE,
      endDate: '2026-10-11',
    });
    expect(schnellwahlZeitraum('w2', HEUTE)).toEqual({
      startDate: HEUTE,
      endDate: '2026-10-18',
    });
  });

  it('„Wochenende" ist Samstag+Sonntag dieser Woche – und das nächste, wenn es vorbei ist', () => {
    expect(schnellwahlZeitraum('we', HEUTE)).toEqual({
      startDate: '2026-10-10',
      endDate: '2026-10-11',
    });
    // Sonntag: das Wochenende läuft schon, also das kommende.
    expect(schnellwahlZeitraum('we', '2026-10-11')).toEqual({
      startDate: '2026-10-17',
      endDate: '2026-10-18',
    });
  });
});

describe('AbsenceSheet – eintragen', () => {
  it('öffnet mit „Nur dieser Tag" und dem angetippten Tag', () => {
    zeige();
    expect(screen.getByLabelText<HTMLInputElement>('Von').value).toBe(HEUTE);
    expect(screen.getByLabelText<HTMLInputElement>('Bis').value).toBe(HEUTE);
    expect(screen.getByRole('button', { name: 'Eintragen' })).not.toBeNull();
  });

  it('eine Schnellwahl setzt beide Datumsfelder und der Knopf nennt die Tage', () => {
    const { onSubmit } = zeige();
    fireEvent.click(screen.getByRole('button', { name: '1 Woche' }));
    expect(screen.getByLabelText<HTMLInputElement>('Bis').value).toBe('2026-10-11');
    fireEvent.click(screen.getByRole('button', { name: 'Eintragen (7 Tage)' }));
    expect(onSubmit).toHaveBeenCalledWith({
      startDate: HEUTE,
      endDate: '2026-10-11',
      comment: undefined,
    });
  });

  it('ein späteres „Von" schiebt „Bis" mit – ein verkehrter Zeitraum entsteht gar nicht erst', () => {
    zeige();
    fireEvent.change(screen.getByLabelText('Von'), { target: { value: '2026-10-20' } });
    expect(screen.getByLabelText<HTMLInputElement>('Bis').value).toBe('2026-10-20');
  });

  it('ein Ende vor dem Anfang sperrt den Knopf und sagt es', () => {
    zeige();
    fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '2026-10-01' } });
    expect(screen.getByText('Das Ende liegt vor dem Anfang.')).not.toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /Eintragen/ }).disabled).toBe(
      true,
    );
  });

  it('beim Eintragen gibt es kein Löschen', () => {
    zeige();
    expect(screen.queryByRole('button', { name: 'Löschen' })).toBeNull();
  });
});

describe('AbsenceSheet – ändern', () => {
  it('zeigt die Werte des Eintrags, speichert sie und bietet Löschen', () => {
    const { onSubmit, onDelete } = zeige({ entwurf: { art: 'aendern', absence: EIGENE } });
    expect(screen.getByLabelText<HTMLInputElement>('Von').value).toBe('2026-11-02');
    expect(screen.getByLabelText<HTMLInputElement>('Bis').value).toBe('2026-11-04');
    expect(screen.getByLabelText<HTMLInputElement>('Kommentar (optional)').value).toBe('Reise');

    fireEvent.change(screen.getByLabelText('Kommentar (optional)'), {
      target: { value: 'Kur' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(onSubmit).toHaveBeenCalledWith({
      startDate: '2026-11-02',
      endDate: '2026-11-04',
      comment: 'Kur',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(onDelete).toHaveBeenCalledWith(EIGENE);
  });
});
