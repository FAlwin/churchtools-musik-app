import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  addArrangementFile,
  listArrangementFiles,
  removeArrangementFile,
} from './setlistBuilder.js';
import { __resetSessionMemosForTests } from './ctSessionMemos.js';

/**
 * #321: Die drei Wege der Dateiverwaltung – auflisten, hinzufügen, löschen.
 *
 * **Der Kern dieser Datei ist der Löschweg.** `DELETE /api/files/{id}` in ChurchTools löscht anhand
 * der Nummer allein; ChurchTools prüft dabei, ob man Lieder bearbeiten darf, **nicht welche Datei
 * gemeint war**. Ohne die Zugehörigkeitsprüfung wäre unser Endpunkt also ein „lösche irgendeine Datei
 * in ChurchTools" – man müsste nur eine Nummer raten. Dieselbe Sorge wie bei `assertCtFileUrl` (#199),
 * und deshalb steht sie hier als Test, nicht nur als Kommentar.
 *
 * Gemockt wird `fetch`, damit die echten Pfade und Methoden mitgeprüft werden: Ein Test gegen
 * gemockte Service-Funktionen hätte eine falsche URL nie bemerkt.
 */
const COOKIE = 'ChurchTools_sid=abc';

/** Eine Datei, wie ChurchTools sie in einem Arrangement liefert. */
const datei = (name: string, id: number, size?: number | string) => ({
  name,
  fileUrl: `https://x.church.tools/?q=public/filedownload&id=${id}`,
  ...(size === undefined ? {} : { size }),
});

/** Lied 12 mit zwei Arrangements – 500 hat Dateien, 501 gehört zum selben Lied. */
const LIED = {
  id: 12,
  name: 'Treu',
  arrangements: [
    {
      id: 500,
      name: 'Standard',
      key: 'D',
      keyOfArrangement: 'D',
      bpm: 75,
      beat: null,
      files: [datei('Treu.chordpro', 1, 2048), datei('Treu - E.pdf', 2, '4096')],
    },
    { id: 501, name: 'Test', key: 'D', keyOfArrangement: 'D', bpm: 75, beat: null, files: [] },
  ],
};

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Beantwortet Lied-Abrufe und Token, protokolliert jeden Schreibvorgang. */
function mockCt() {
  const schreibvorgaenge: { method: string; url: string }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    if (u.includes('/api/csrftoken')) return Promise.resolve(jsonRes('token'));
    if (method === 'GET' && /\/api\/songs\/12$/.test(u)) return Promise.resolve(jsonRes(LIED));
    schreibvorgaenge.push({ method, url: u });
    return Promise.resolve(jsonRes(null, 200));
  });
  return schreibvorgaenge;
}

afterEach(() => {
  vi.restoreAllMocks();
  __resetSessionMemosForTests();
});

describe('listArrangementFiles', () => {
  it('listet alle Dateien des Arrangements samt Art und Größe', async () => {
    mockCt();
    await expect(listArrangementFiles(COOKIE, 12, 500)).resolves.toEqual([
      {
        fileId: 1,
        name: 'Treu.chordpro',
        // Sprechende Bezeichnung kommt vom SERVER: Der Versionsname steckt im `(App)`-Marker, und
        // diese Grammatik im Client nachzubauen hätte ihre Altlasten verloren (#321).
        label: 'Notenblatt (ChordPro)',
        size: 2048,
        kind: 'chordpro-original',
      },
      { fileId: 2, name: 'Treu - E.pdf', label: 'Treu - E.pdf', size: 4096, kind: 'pdf' },
    ]);
  });

  it('ein leeres Arrangement ist eine leere Liste, kein Fehler', async () => {
    mockCt();
    await expect(listArrangementFiles(COOKIE, 12, 501)).resolves.toEqual([]);
  });

  it('ein fremdes Arrangement gibt es nicht (404)', async () => {
    mockCt();
    await expect(listArrangementFiles(COOKIE, 12, 999)).rejects.toThrow(
      /Arrangement nicht gefunden/,
    );
  });
});

describe('addArrangementFile', () => {
  it('lädt an das richtige Arrangement hoch und gibt die frische Liste zurück', async () => {
    const w = mockCt();
    const liste = await addArrangementFile(COOKIE, 12, 500, {
      filename: 'neu.pdf',
      mime: 'application/pdf',
      inhalt: new Uint8Array([1, 2, 3]),
    });

    expect(w).toHaveLength(1);
    expect(w[0].method).toBe('POST');
    expect(w[0].url).toContain('/api/files/song_arrangement/500');
    // Die Liste kommt frisch zurück – der Client braucht die neue Datei-ID, ohne selbst noch
    // einmal zu fragen (#300: jede vermeidbare Anfrage zählt).
    expect(liste).toHaveLength(2);
  });

  it('reinigt den Dateinamen – er kommt aus dem Browser und ist nicht zu glauben', async () => {
    mockCt();
    // Der Name landet nur im Multipart, nicht in der URL; geprüft wird, dass es nicht scheitert und
    // der Weg derselbe bleibt. Die Reinigung selbst ist in `safeFileName` einzeln geprüft.
    await expect(
      addArrangementFile(COOKIE, 12, 500, {
        filename: '../../geheim.pdf',
        mime: 'application/pdf',
        inhalt: new Uint8Array([1]),
      }),
    ).resolves.toBeDefined();
  });

  it('lehnt einen Namen ab, von dem nach der Reinigung nichts übrig ist', async () => {
    const w = mockCt();
    await expect(
      addArrangementFile(COOKIE, 12, 500, {
        filename: '///',
        mime: 'application/pdf',
        inhalt: new Uint8Array([1]),
      }),
    ).rejects.toThrow(/Dateinamen/);
    // Und zwar BEVOR irgendetwas geschrieben wurde.
    expect(w).toHaveLength(0);
  });

  it('lädt nicht an ein Arrangement, das nicht zu diesem Lied gehört', async () => {
    const w = mockCt();
    await expect(
      addArrangementFile(COOKIE, 12, 999, {
        filename: 'a.pdf',
        mime: 'application/pdf',
        inhalt: new Uint8Array([1]),
      }),
    ).rejects.toThrow(/Arrangement nicht gefunden/);
    expect(w).toHaveLength(0);
  });
});

describe('removeArrangementFile – die Zugehörigkeit ist die Sicherung', () => {
  it('löscht eine Datei des Lieds', async () => {
    const w = mockCt();
    await removeArrangementFile(COOKIE, 12, 2);

    expect(w).toHaveLength(1);
    expect(w[0].method).toBe('DELETE');
    expect(w[0].url).toContain('/api/files/2');
  });

  it('löscht NICHTS, wenn die Datei nicht zu diesem Lied gehört', async () => {
    // Der eigentliche Grund dieser Datei: Ohne die Prüfung wäre 4711 (z. B. das Foto einer Person)
    // über unseren Endpunkt löschbar, nur weil jemand die Nummer kennt.
    const w = mockCt();
    await expect(removeArrangementFile(COOKIE, 12, 4711)).rejects.toThrow(/Datei nicht gefunden/);
    expect(w).toHaveLength(0);
  });

  it('findet auch eine Datei aus einem anderen Arrangement DESSELBEN Lieds', async () => {
    // Gelöscht wird über das Lied, nicht über das Arrangement – wer im Menü eines Arrangements
    // steht, darf trotzdem keine Datei eines fremden LIEDS treffen, aber eine des eigenen schon.
    const w = mockCt();
    await removeArrangementFile(COOKIE, 12, 1);
    expect(w[0].url).toContain('/api/files/1');
  });
});
