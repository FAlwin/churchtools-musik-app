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
      reasonId: null,
      vonApp: true,
    });
  });
  it('manueller Eintrag: nicht eigene, Kommentar und Grund bleiben', () => {
    expect(a.zuAbsence(MANUELL)).toMatchObject({ comment: 'Kur', reason: 'Urlaub', vonApp: false });
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
    expect(r.absence).toMatchObject({ id: 77, comment: 'Urlaub', vonApp: true });
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

describe('abwesenheitLoeschen – jeder eigene Eintrag (05.09.2026)', () => {
  it('löscht einen eigenen Eintrag über die Konto-ID', async () => {
    vi.mocked(getAbsences).mockResolvedValue([EIGENE, MANUELL]);
    await a.abwesenheitLoeschen(COOKIE, 1009, 1);
    expect(deleteAbsence).toHaveBeenCalledWith(COOKIE, 1009, 1);
  });
  /**
   * **Auch einen ohne Marker** – die frühere 403-Sperre ist weg (Entscheidung Alwin, 05.09.2026:
   * „können wir nicht in unserer App die Daten aus ChurchTools bearbeiten?"). Es sind die Daten des
   * angemeldeten Kontos; die Rückfrage vor dem Löschen leistet die Oberfläche (`AbsenceSheet`).
   */
  it('auch einen manuellen ChurchTools-Eintrag – es sind die eigenen Daten', async () => {
    vi.mocked(getAbsences).mockResolvedValue([EIGENE, MANUELL]);
    await a.abwesenheitLoeschen(COOKIE, 1009, 2);
    expect(deleteAbsence).toHaveBeenCalledWith(COOKIE, 1009, 2);
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
    expect(ergebnis).toMatchObject({ id: 99, comment: 'Kurzreise', vonApp: true });
  });

  /**
   * **Ein fremder Eintrag behält Grund UND Herkunft.** Beides ist wichtig: Ein „Urlaub" (Grund 3)
   * darf nicht zu „Abwesend" werden, und er darf keinen `[Musikteam]`-Marker bekommen – sonst würde
   * der Excel-Sync ihn für seinen halten und beim nächsten Lauf löschen, weil er in der Excel fehlt.
   */
  it('ein ChurchTools-Eintrag ist änderbar – Grund und fehlender Marker bleiben', async () => {
    vi.mocked(getAbsences).mockResolvedValue([MANUELL]);
    vi.mocked(createAbsence).mockResolvedValue(55);
    const ergebnis = await a.abwesenheitAendern(COOKIE, 42, 2, {
      startDate: '2026-10-12',
      endDate: '2026-10-19',
      comment: 'Kur verlängert',
    });
    expect(vi.mocked(createAbsence).mock.calls[0][2]).toEqual({
      startDate: '2026-10-12',
      endDate: '2026-10-19',
      absenceReasonId: 3, // der Grund des Eintrags, NICHT der App-Standard
      comment: 'Kur verlängert', // ohne Marker
    });
    expect(ergebnis.vonApp).toBe(false);
    expect(vi.mocked(deleteAbsence)).toHaveBeenCalledWith(COOKIE, 42, 2);
  });

  it('ein gewünschter Grund aus der App gewinnt gegen den alten', async () => {
    vi.mocked(getAbsences).mockResolvedValue([MANUELL]);
    vi.mocked(createAbsence).mockResolvedValue(56);
    await a.abwesenheitAendern(COOKIE, 42, 2, { ...NEU, reasonId: 2 });
    expect(vi.mocked(createAbsence).mock.calls[0][2]).toMatchObject({ absenceReasonId: 2 });
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

/**
 * Die Abwesenheitsgründe kommen aus derselben `getMasterData`-Antwort wie die Lied-Kategorien
 * (gemessen 05.09.2026 – die `/api/`-Welt hat keinen Endpunkt dafür). Genau diese Struktur kam
 * zurück: ein OBJEKT, IDs als Zeichenkette, Name in `bezeichnung`, Reihenfolge über `sortkey`.
 */
describe('zuGruende – die gemessene Struktur der alten Schnittstelle (#177)', () => {
  const ROH = {
    '1': { id: '1', bezeichnung: 'absent.reason.absence', sortkey: '2' },
    '2': { id: '2', bezeichnung: 'absent.reason.vacation', sortkey: '1' },
    '3': { id: '3', bezeichnung: 'absent.reason.sick', sortkey: '0' },
  };

  it('macht Zahlen aus den IDs, übersetzt die Schlüssel und sortiert wie ChurchTools', () => {
    expect(a.zuGruenden(ROH)).toEqual([
      { id: 3, name: 'Krank', standard: false },
      { id: 2, name: 'Urlaub', standard: false },
      { id: 1, name: 'Abwesend', standard: true },
    ]);
  });

  it('ein eigener Grund der Gemeinde behält seinen Namen', () => {
    expect(a.zuGruenden({ '7': { id: '7', bezeichnung: 'Fortbildung', sortkey: '5' } })).toEqual([
      { id: 7, name: 'Fortbildung', standard: false },
    ]);
  });

  it('unbrauchbares wird weggelassen, statt Halbes anzuzeigen', () => {
    expect(a.zuGruenden({ x: { bezeichnung: 'ohne id' }, y: { id: '9' } })).toEqual([]);
    expect(a.zuGruenden(undefined)).toEqual([]);
    expect(a.zuGruenden('kaputt')).toEqual([]);
  });
});
