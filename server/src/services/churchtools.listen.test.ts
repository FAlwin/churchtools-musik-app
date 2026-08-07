import { describe, it, expect, vi, afterEach } from 'vitest';
import { getActiveMemberships } from './ctCapabilities.js';
import { getAllSongs } from './ctRead.js';

/**
 * Zwei Abrufe, die bis #280 **ohne jedes Testnetz** waren – und beide haben mehr Logik, als der Name
 * vermuten lässt:
 *
 * - `getActiveMemberships` **filtert**: nur laufende Mitgliedschaften zählen. Diese Liste entscheidet
 *   in `getCapabilities` mit darüber, wer Abläufe bearbeiten darf – ein zu großzügiger Filter gäbe
 *   Rechte an Ausgetretene.
 * - `getAllSongs` **blättert**. Ein stiller Abbruch würde einfach Lieder verschwinden lassen, ohne
 *   dass irgendwo ein Fehler auftaucht.
 *
 * Geschrieben, BEVOR die Funktionen in eigene Module umziehen: Ein Umzug ohne Netz merkt niemand.
 */
function jsonRes(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => vi.restoreAllMocks());

describe('getActiveMemberships – nur laufende Mitgliedschaften', () => {
  it('liefert Gruppe und Rolle einer aktiven Mitgliedschaft', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonRes([
        { group: { domainIdentifier: '12' }, groupTypeRoleId: 3, groupMemberStatus: 'active' },
      ]),
    );
    expect(await getActiveMemberships('cookie', 7)).toEqual([{ groupId: 12, roleId: 3 }]);
  });

  it('eine nicht aktive Mitgliedschaft (z. B. angefragt) zählt NICHT', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonRes([
        { group: { domainIdentifier: 12 }, groupTypeRoleId: 3, groupMemberStatus: 'requested' },
      ]),
    );
    expect(await getActiveMemberships('cookie', 7)).toEqual([]);
  });

  it('ein gesetztes Austrittsdatum zählt NICHT – auch wenn der Status noch „active" ist', async () => {
    // Der Fall, der Rechte an Ausgetretene geben würde: ChurchTools lässt den Status stehen und
    // trägt nur ein Enddatum ein.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonRes([
        {
          group: { domainIdentifier: 12 },
          groupTypeRoleId: 3,
          groupMemberStatus: 'active',
          memberEndDate: '2026-01-01',
        },
      ]),
    );
    expect(await getActiveMemberships('cookie', 7)).toEqual([]);
  });

  it('unbrauchbare IDs werden übersprungen statt als NaN durchgereicht', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonRes([
        {
          group: { domainIdentifier: 'keine-zahl' },
          groupTypeRoleId: 3,
          groupMemberStatus: 'active',
        },
        { group: {}, groupTypeRoleId: 3, groupMemberStatus: 'active' },
        { group: { domainIdentifier: 9 }, groupTypeRoleId: 1, groupMemberStatus: 'active' },
      ]),
    );
    expect(await getActiveMemberships('cookie', 7)).toEqual([{ groupId: 9, roleId: 1 }]);
  });

  it('eine leere Antwort ergibt eine leere Liste (kein Wurf)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonRes([]));
    expect(await getActiveMemberships('cookie', 7)).toEqual([]);
  });
});

describe('getAllSongs – Blättern', () => {
  /** Erzeugt `n` Lied-Einträge ab `ab`. */
  function lieder(n: number, ab = 0) {
    return Array.from({ length: n }, (_, i) => ({
      id: ab + i,
      name: `Lied ${ab + i}`,
      author: null,
      arrangements: [],
    }));
  }

  it('eine unvolle Seite beendet das Blättern', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonRes(lieder(42)));
    expect(await getAllSongs('cookie')).toHaveLength(42);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('eine VOLLE Seite führt zur nächsten – sonst fehlten stillschweigend Lieder', async () => {
    const f = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonRes(lieder(100)))
      .mockResolvedValueOnce(jsonRes(lieder(7, 100)));
    expect(await getAllSongs('cookie')).toHaveLength(107);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('die Seiten werden aufsteigend angefordert', async () => {
    const seiten: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const s = new URL(String(url)).searchParams.get('page') ?? '?';
      seiten.push(s);
      return Promise.resolve(jsonRes(seiten.length < 3 ? lieder(100) : lieder(1)));
    });
    await getAllSongs('cookie');
    expect(seiten).toEqual(['1', '2', '3']);
  });

  it('bei lauter vollen Seiten wird nach 50 abgebrochen (Endlos-Schutz)', async () => {
    // Die Grenze ist Absicht: Ein Fehler auf ChurchTools-Seite, der immer eine volle Seite liefert,
    // darf den Server nicht endlos beschäftigen. 50 × 100 = 5.000 Lieder sind weit über allem
    // Realistischen.
    // Je Aufruf eine FRISCHE Response: Ein Rumpf lässt sich nur einmal lesen.
    const f = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(jsonRes(lieder(100))));
    expect(await getAllSongs('cookie')).toHaveLength(5000);
    expect(f).toHaveBeenCalledTimes(50);
  });
});
