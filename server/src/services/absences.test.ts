import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Absence } from '@shared/types/index';

/**
 * #177 Verfügbarkeit – die drei Regeln des Kerns, jede einzeln:
 *  1. Nur Marker-Einträge gelten als „eigene" und dürfen gelöscht werden.
 *  2. Derselbe Zeitraum wird nicht doppelt angelegt.
 *  3. Die Personen-ID kommt aus der Sitzung – jeder ChurchTools-Aufruf trägt die Konto-ID, nie eine
 *     aus dem Request.
 */
vi.mock('./ctRead.js', () => ({ getAbsences: vi.fn(), getEvents: vi.fn() }));
vi.mock('./ctWrite.js', () => ({ createAbsence: vi.fn(), deleteAbsence: vi.fn() }));

const { getAbsences, getEvents } = await import('./ctRead.js');
const { createAbsence, deleteAbsence } = await import('./ctWrite.js');
const a = await import('./absences.js');

const COOKIE = 'ChurchTools_sid=x';
const EIGENE = {
  id: 1,
  startDate: '2026-10-04',
  endDate: '2026-10-04',
  comment: '[Musikteam] Urlaub',
};
const MANUELL = {
  id: 2,
  startDate: '2026-10-11',
  endDate: '2026-10-18',
  comment: 'Kur',
  absenceReason: { id: 3, name: 'Urlaub' },
};

beforeEach(() => vi.clearAllMocks());

describe('zuAbsence – Marker entscheidet, was „eigene" ist', () => {
  it('Marker-Eintrag: eigene, Freitext ohne Marker', () => {
    expect(a.zuAbsence(EIGENE)).toEqual({
      id: 1,
      startDate: '2026-10-04',
      endDate: '2026-10-04',
      comment: 'Urlaub',
      reason: null,
      eigene: true,
    });
  });
  it('manueller Eintrag: nicht eigene, Kommentar und Grund bleiben', () => {
    expect(a.zuAbsence(MANUELL)).toMatchObject({ comment: 'Kur', reason: 'Urlaub', eigene: false });
  });
  it('Marker ohne Freitext ergibt leeren Kommentar', () => {
    expect(a.zuAbsence({ ...EIGENE, comment: '[Musikteam]' }).comment).toBe('');
  });
});

describe('absenceBody – Prüfung und Rumpf', () => {
  it('setzt Grund aus der Konfiguration und den Marker', () => {
    expect(
      a.absenceBody({ startDate: '2026-10-04', endDate: '2026-10-05', comment: ' Reise ' }),
    ).toEqual({
      startDate: '2026-10-04',
      endDate: '2026-10-05',
      absenceReasonId: 1,
      comment: '[Musikteam] Reise',
    });
  });
  it('Ende vor Anfang → 400', () => {
    expect(() => a.absenceBody({ startDate: '2026-10-05', endDate: '2026-10-04' })).toThrow(
      /Ende liegt vor dem Anfang/,
    );
  });
  it('kaputtes Datum → 400', () => {
    expect(() => a.absenceBody({ startDate: '04.10.2026', endDate: '2026-10-04' })).toThrow(
      /Datum/,
    );
  });
  it('länger als ein Jahr → 400', () => {
    expect(() => a.absenceBody({ startDate: '2026-01-01', endDate: '2027-01-02' })).toThrow(
      /ein Jahr/,
    );
    expect(a.tageInklusive('2026-01-01', '2026-12-31')).toBe(365);
  });
});

describe('zuEvents – Schnellauswahl', () => {
  it('zieht den Tag heraus und sortiert nach Beginn', () => {
    const out = a.zuEvents([
      { id: 2, name: 'Gottesdienst', startDate: '2026-10-11T10:00:00Z', endDate: '' },
      { id: 1, name: 'Gottesdienst', startDate: '2026-10-04T10:00:00Z', endDate: '' },
    ]);
    expect(out.map((e) => e.date)).toEqual(['2026-10-04', '2026-10-11']);
  });
});

describe('abwesenheitAnlegen – kein Doppel, eigene Konto-ID', () => {
  it('legt an und liefert den neuen Eintrag mit ID', async () => {
    vi.mocked(getAbsences).mockResolvedValue([]);
    vi.mocked(createAbsence).mockResolvedValue(77);
    const r = await a.abwesenheitAnlegen(COOKIE, 1009, {
      startDate: '2026-10-04',
      endDate: '2026-10-04',
      comment: 'Urlaub',
    });
    expect(r.neu).toBe(true);
    expect(r.absence).toMatchObject({ id: 77, comment: 'Urlaub', eigene: true });
    // Die Personen-ID ist die der Sitzung – bei Lesen UND Schreiben.
    expect(vi.mocked(getAbsences).mock.calls[0][1]).toBe(1009);
    expect(vi.mocked(createAbsence).mock.calls[0][1]).toBe(1009);
  });
  it('derselbe Zeitraum ein zweites Mal legt NICHTS an', async () => {
    vi.mocked(getAbsences).mockResolvedValue([EIGENE]);
    const r = await a.abwesenheitAnlegen(COOKIE, 1009, {
      startDate: '2026-10-04',
      endDate: '2026-10-04',
    });
    expect(r.neu).toBe(false);
    expect(r.absence.id).toBe(1);
    expect(createAbsence).not.toHaveBeenCalled();
  });
  it('ein manueller Eintrag im selben Zeitraum zählt nicht als Doppel', async () => {
    vi.mocked(getAbsences).mockResolvedValue([
      { ...MANUELL, startDate: '2026-10-04', endDate: '2026-10-04' },
    ]);
    vi.mocked(createAbsence).mockResolvedValue(78);
    const r = await a.abwesenheitAnlegen(COOKIE, 1009, {
      startDate: '2026-10-04',
      endDate: '2026-10-04',
    });
    expect(r.neu).toBe(true);
  });
});

describe('abwesenheitLoeschen – nur Marker-Einträge', () => {
  it('löscht einen eigenen Eintrag über die Konto-ID', async () => {
    vi.mocked(getAbsences).mockResolvedValue([EIGENE, MANUELL]);
    await a.abwesenheitLoeschen(COOKIE, 1009, 1);
    expect(deleteAbsence).toHaveBeenCalledWith(COOKIE, 1009, 1);
  });
  it('einen manuellen Eintrag NICHT – 403 mit Erklärung', async () => {
    vi.mocked(getAbsences).mockResolvedValue([EIGENE, MANUELL]);
    await expect(a.abwesenheitLoeschen(COOKIE, 1009, 2)).rejects.toMatchObject({ status: 403 });
    expect(deleteAbsence).not.toHaveBeenCalled();
  });
  it('unbekannte ID → 404', async () => {
    vi.mocked(getAbsences).mockResolvedValue([EIGENE]);
    await expect(a.abwesenheitLoeschen(COOKIE, 1009, 999)).rejects.toMatchObject({ status: 404 });
  });
});

describe('kommendeTermine', () => {
  it('fragt ab heute für die gewünschten Wochen', async () => {
    vi.mocked(getEvents).mockResolvedValue([]);
    await a.kommendeTermine(COOKIE, 2, new Date('2026-10-01T12:00:00Z'));
    expect(getEvents).toHaveBeenCalledWith(COOKIE, '2026-10-01', '2026-10-15');
  });
});

// Typ-Wächter: die App-Sicht bleibt frei von Excel – dieses Feld darf es nie geben.
const _keinExcel = (x: Absence): void => void x;
void _keinExcel;

/**
 * **Ändern** (Wunsch Alwin, 05.09.2026). ChurchTools kann Abwesenheiten nicht ändern – der Server
 * legt neu an und löscht dann den alten Eintrag. Geprüft wird genau diese Reihenfolge (andersherum
 * wäre nach einem Fehlschlag alles weg), der Schutz fremder Einträge und die Doppel-Regel, die den
 * eigenen Eintrag ausnehmen muss.
 */
describe('abwesenheitAendern – neu anlegen, dann alten entfernen (#177)', () => {
  const NEU = { startDate: '2026-10-05', endDate: '2026-10-06', comment: 'Kurzreise' };

  it('legt zuerst an und löscht erst danach – die Reihenfolge ist der Schutz', async () => {
    const folge: string[] = [];
    vi.mocked(getAbsences).mockResolvedValue([EIGENE]);
    vi.mocked(createAbsence).mockImplementation(async () => {
      folge.push('anlegen');
      return 99;
    });
    vi.mocked(deleteAbsence).mockImplementation(async () => {
      folge.push('loeschen');
    });

    const ergebnis = await a.abwesenheitAendern(COOKIE, 42, 1, NEU);

    expect(folge).toEqual(['anlegen', 'loeschen']);
    expect(vi.mocked(createAbsence).mock.calls[0][1]).toBe(42);
    expect(vi.mocked(createAbsence).mock.calls[0][2]).toMatchObject({
      startDate: '2026-10-05',
      endDate: '2026-10-06',
      comment: '[Musikteam] Kurzreise',
    });
    expect(vi.mocked(deleteAbsence)).toHaveBeenCalledWith(COOKIE, 42, 1);
    expect(ergebnis).toMatchObject({ id: 99, comment: 'Kurzreise', eigene: true });
  });

  it('ein manueller ChurchTools-Eintrag lässt sich nicht ändern (403), und nichts wird geschrieben', async () => {
    vi.mocked(getAbsences).mockResolvedValue([MANUELL]);
    await expect(a.abwesenheitAendern(COOKIE, 42, 2, NEU)).rejects.toMatchObject({ status: 403 });
    expect(vi.mocked(createAbsence)).not.toHaveBeenCalled();
    expect(vi.mocked(deleteAbsence)).not.toHaveBeenCalled();
  });

  it('der eigene Eintrag zählt NICHT als Doppel – nur den Kommentar ändern geht', async () => {
    vi.mocked(getAbsences).mockResolvedValue([EIGENE]);
    vi.mocked(createAbsence).mockResolvedValue(98);
    await expect(
      a.abwesenheitAendern(COOKIE, 42, 1, {
        startDate: EIGENE.startDate,
        endDate: EIGENE.endDate,
        comment: 'anderer Text',
      }),
    ).resolves.toMatchObject({ id: 98 });
  });

  it('ein FREMDER eigener Eintrag auf demselben Zeitraum bleibt ein Doppel (409)', async () => {
    const zweiter = {
      id: 7,
      startDate: '2026-10-05',
      endDate: '2026-10-06',
      comment: '[Musikteam] X',
    };
    vi.mocked(getAbsences).mockResolvedValue([EIGENE, zweiter]);
    await expect(a.abwesenheitAendern(COOKIE, 42, 1, NEU)).rejects.toMatchObject({ status: 409 });
    expect(vi.mocked(createAbsence)).not.toHaveBeenCalled();
  });

  it('scheitert das Löschen, wird das ehrlich gemeldet – der neue Eintrag steht schon', async () => {
    vi.mocked(getAbsences).mockResolvedValue([EIGENE]);
    vi.mocked(createAbsence).mockResolvedValue(97);
    vi.mocked(deleteAbsence).mockRejectedValue(new Error('ChurchTools sagt nein'));
    await expect(a.abwesenheitAendern(COOKIE, 42, 1, NEU)).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('alte Eintrag'),
    });
  });
});
