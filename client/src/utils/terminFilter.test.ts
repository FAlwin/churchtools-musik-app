import { describe, expect, it } from 'vitest';
import type { AbsenceEvent, TerminArt } from '@shared/types/index';
import {
  SONSTIGE_ID,
  artVon,
  filtereTermine,
  knoepfeAus,
  umschalten,
  wirksameAuswahl,
} from './terminFilter';

/**
 * Der Termin-Filter (#400) als reine Regeln – Termin-Arten mit Suchwörtern, „Sonstige" für den Rest.
 *
 * Die wichtigsten stehen unten: Eine Auswahl, auf die kein Knopf passt, gilt als „alle" (sonst eine
 * leere Liste ohne Grund), und es gibt **genau eine Art oder alles** – ein zweiter Knopf ersetzt den
 * ersten, ein Tipp auf den gewählten hebt ihn auf (Alwin, 20.09.2026 spät).
 */
const ev = (id: number, name: string): AbsenceEvent => ({
  id,
  name,
  date: '2026-10-04',
  startDate: '2026-10-04T10:00:00Z',
  endDate: '2026-10-04T11:30:00Z',
});
const GD: TerminArt = { id: 'gd', name: 'Gottesdienst', suchwort: 'Gottesdienst' };
const GA: TerminArt = { id: 'ga', name: 'Gebetsabend', suchwort: 'gebetsabend' };
const ARTEN = [GD, GA];

describe('artVon', () => {
  it('findet das Suchwort im Namen – Groß-/Kleinschreibung egal', () => {
    expect(artVon(ev(1, 'Gottesdienst mit Abendmahl'), ARTEN)).toBe('gd');
    expect(artVon(ev(2, 'GEBETSABEND'), ARTEN)).toBe('ga');
  });

  it('die ERSTE passende Art gewinnt – die Reihenfolge des Admins zählt', () => {
    const jugend: TerminArt = { id: 'j', name: 'Jugend', suchwort: 'Jugend' };
    expect(artVon(ev(1, 'Jugendgottesdienst'), [GD, jugend])).toBe('gd');
    expect(artVon(ev(1, 'Jugendgottesdienst'), [jugend, GD])).toBe('j');
  });

  it('ohne Treffer: Sonstige', () => {
    expect(artVon(ev(1, 'Probe'), ARTEN)).toBe(SONSTIGE_ID);
  });

  it('ein leeres Suchwort trifft nichts – sonst gehörte JEDER Termin dazu', () => {
    expect(artVon(ev(1, 'Probe'), [{ id: 'x', name: 'X', suchwort: '  ' }])).toBe(SONSTIGE_ID);
  });
});

describe('knoepfeAus', () => {
  it('zeigt nur Arten, zu denen es Termine gibt – in der Reihenfolge des Admins', () => {
    const k = knoepfeAus(ARTEN, [ev(1, 'Gebetsabend'), ev(2, 'Gottesdienst')]);
    expect(k.map((x) => x.name)).toEqual(['Gottesdienst', 'Gebetsabend']);
  });

  it('hängt „Sonstige" an, wenn ein Termin nirgends hineinpasst', () => {
    const k = knoepfeAus(ARTEN, [ev(1, 'Gottesdienst'), ev(2, 'Probe')]);
    expect(k.map((x) => x.id)).toEqual(['gd', SONSTIGE_ID]);
  });

  it('ohne Arten gibt es höchstens „Sonstige" – also nichts zu filtern', () => {
    expect(knoepfeAus([], [ev(1, 'Gottesdienst')]).map((x) => x.id)).toEqual([SONSTIGE_ID]);
  });
});

describe('wirksameAuswahl', () => {
  const knoepfe = [
    { id: 'gd', name: 'Gottesdienst' },
    { id: 'ga', name: 'Gebetsabend' },
  ];

  it('lässt eine Wahl fallen, zu der es keinen Knopf gibt', () => {
    expect(wirksameAuswahl(['99'], knoepfe)).toEqual([]);
    expect(wirksameAuswahl(['gd', '99'], knoepfe)).toEqual(['gd']);
  });

  it('kürzt eine gemerkte Mehrfachauswahl (Zwischenfassung) auf den ersten gültigen Eintrag', () => {
    expect(wirksameAuswahl(['gd', 'ga'], knoepfe)).toEqual(['gd']);
    expect(wirksameAuswahl(['99', 'ga', 'gd'], knoepfe)).toEqual(['ga']);
  });
});

describe('filtereTermine', () => {
  const alle = [ev(1, 'Gottesdienst'), ev(2, 'Gebetsabend'), ev(3, 'Probe')];

  it('ohne Auswahl bleibt alles', () => {
    expect(filtereTermine(alle, [], ARTEN)).toHaveLength(3);
  });

  it('mit Auswahl nur die passenden – „Sonstige" ist eine eigene Wahl', () => {
    expect(filtereTermine(alle, ['ga'], ARTEN).map((e) => e.id)).toEqual([2]);
    expect(filtereTermine(alle, [SONSTIGE_ID], ARTEN).map((e) => e.id)).toEqual([3]);
  });

  it('die Filterung selbst könnte mehrere – die Auswahl gibt nur eine her (siehe umschalten)', () => {
    expect(filtereTermine(alle, ['gd', SONSTIGE_ID], ARTEN).map((e) => e.id)).toEqual([1, 3]);
  });
});

describe('umschalten', () => {
  const knoepfe = [
    { id: 'gd', name: 'Gottesdienst' },
    { id: 'ga', name: 'Gebetsabend' },
    { id: SONSTIGE_ID, name: 'Sonstige' },
  ];

  it('wählt genau einen – ein zweiter Knopf ERSETZT den ersten', () => {
    expect(umschalten([], 'gd', knoepfe)).toEqual(['gd']);
    expect(umschalten(['gd'], 'ga', knoepfe)).toEqual(['ga']);
  });

  it('ein Tipp auf den gewählten Knopf hebt die Wahl auf – dann gilt „alle"', () => {
    expect(umschalten(['gd'], 'gd', knoepfe)).toEqual([]);
  });
});
