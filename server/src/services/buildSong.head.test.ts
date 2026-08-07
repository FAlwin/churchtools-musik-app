import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * #236: `{title: …}` / `{artist: …}` aus der ChordPro-Datei müssen den ChurchTools-Liednamen
 * schlagen – genau wie `{key}` und `{time}` es schon taten.
 *
 * Geprüft wird über `getSongChart`, weil `buildSong` selbst nicht exportiert ist. Damit hängt der
 * Test an der **Verdrahtung** und nicht nur an `metaValue`: Es war ja gerade die fehlende
 * Verdrahtung, die den Fehler ausgemacht hat.
 */
// Zwei Module, weil `getSong` (lesen) und `downloadFileText` (Dateien) seit #280 getrennt liegen.
vi.mock('./ctRead.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ctRead.js')>()),
  getSong: vi.fn(),
}));
vi.mock('./ctFiles.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ctFiles.js')>()),
  downloadFileText: vi.fn(),
}));

import { getSongChart } from './setlistBuilder.js';
import { downloadFileText } from './ctFiles.js';
import { getSong } from './ctRead.js';
import type { CtSong } from './ctTypes.js';
import { HttpError } from '../middleware/errorHandler.js';

const mockedGetSong = vi.mocked(getSong);
const mockedDownload = vi.mocked(downloadFileText);

beforeEach(() => {
  mockedGetSong.mockReset();
  mockedDownload.mockReset();
});

/** Lied mit einem Standard-Arrangement und einer Original-ChordPro-Datei. */
function ctSong(over: { name?: string; author?: string | null } = {}): CtSong {
  return {
    id: 42,
    name: over.name ?? 'Mottosong AC26',
    author: over.author === undefined ? 'CT-Autor' : over.author,
    ccli: null,
    arrangements: [
      {
        id: 7,
        name: 'Standard',
        isDefault: true,
        key: 'C',
        keyOfArrangement: 'C',
        bpm: null,
        beat: null,
        files: [{ name: 'Mottosong AC26.chordpro', fileUrl: 'https://x/?id=1' }],
      },
    ],
  };
}

describe('getSongChart – Kopfangaben aus der ChordPro-Datei (#236)', () => {
  it('übernimmt {title} und {artist} statt Liedname/Autor aus ChurchTools', async () => {
    mockedGetSong.mockResolvedValue(ctSong());
    mockedDownload.mockResolvedValue(
      '{title: Mottosong AC26 - Auf dich will ich bauen}\n{artist: Echter Autor}\n[C]Text\n',
    );

    const chart = await getSongChart('cookie', 42);
    expect(chart.title).toBe('Mottosong AC26 - Auf dich will ich bauen');
    expect(chart.author).toBe('Echter Autor');
  });

  it('ohne {title}/{artist} bleiben Liedname und Autor aus ChurchTools stehen', async () => {
    mockedGetSong.mockResolvedValue(ctSong());
    mockedDownload.mockResolvedValue('[C]Text ohne Kopfangaben\n');

    const chart = await getSongChart('cookie', 42);
    expect(chart.title).toBe('Mottosong AC26');
    expect(chart.author).toBe('CT-Autor');
  });

  it('ein leeres {title: } lässt den Liednamen stehen (halb getippte Kopfzeile)', async () => {
    mockedGetSong.mockResolvedValue(ctSong());
    mockedDownload.mockResolvedValue('{title: }\n[C]Text\n');

    expect((await getSongChart('cookie', 42)).title).toBe('Mottosong AC26');
  });

  it('ohne Autor in ChurchTools und ohne {artist} bleibt die Autorenzeile leer', async () => {
    mockedGetSong.mockResolvedValue(ctSong({ author: null }));
    mockedDownload.mockResolvedValue('{title: Nur Titel}\n[C]Text\n');

    const chart = await getSongChart('cookie', 42);
    expect(chart.title).toBe('Nur Titel');
    expect(chart.author).toBe('');
  });
});

/**
 * #274: Ein Download-Fehler darf nicht zu einem stillen leeren Lied werden.
 *
 * Vorher lieferte jeder Fehler schlicht `''`. Eine Zeitüberschreitung ergab damit ein leeres Blatt
 * ohne ein Wort – und weil `Setlist.tsx` Lieder mit leerem Text aus der Sammel-PDF filtert, fehlte
 * das Lied dort ganz. Seit #248 haben alle ChurchTools-Aufrufe eine Zeitgrenze, der Fall ist also
 * erreichbar geworden.
 *
 * Unterschieden werden zwei Dinge, die vorher gleich aussahen:
 *  - **404** = die Datei ist in ChurchTools wirklich weg → leer ist die Wahrheit, kein Kennzeichen
 *  - alles andere = vorübergehend → `chordproFailed`, damit die App es sagen kann
 */
describe('getSongChart – nicht ladbare Akkord-Datei (#274)', () => {
  /** Lied mit Original + einer benannten Version (zwei Downloads). */
  function ctSongMitVersion(): CtSong {
    const s = ctSong();
    s.arrangements[0].files.push({
      name: 'Mottosong AC26 — Akustik (App).chordpro',
      fileUrl: 'https://x/?id=2',
    });
    return s;
  }

  it('Zeitüberschreitung: Lied wird als „nicht geladen" gekennzeichnet, nicht als leer', async () => {
    mockedGetSong.mockResolvedValue(ctSong());
    mockedDownload.mockRejectedValue(new HttpError(504, 'ChurchTools antwortet gerade nicht.'));

    const chart = await getSongChart('cookie', 42);
    expect(chart.chordproFailed).toBe(true);
    expect(chart.chordpro).toBe(''); // der Text fehlt weiterhin – aber jetzt sagt es jemand
  });

  it('Serverfehler (502) kennzeichnet ebenfalls', async () => {
    mockedGetSong.mockResolvedValue(ctSong());
    mockedDownload.mockRejectedValue(new HttpError(502, 'Datei-Download fehlgeschlagen (500).'));

    expect((await getSongChart('cookie', 42)).chordproFailed).toBe(true);
  });

  it('404 kennzeichnet NICHT – die Datei ist wirklich weg, leer ist die Wahrheit', async () => {
    // Wichtig für die Abgrenzung: Sonst würde jedes Lied ohne Datei dauerhaft eine Meldung erzeugen.
    mockedGetSong.mockResolvedValue(ctSong());
    mockedDownload.mockRejectedValue(new HttpError(404, 'Datei-Download fehlgeschlagen (404).'));

    const chart = await getSongChart('cookie', 42);
    expect(chart.chordproFailed).toBeUndefined();
    expect(chart.chordpro).toBe('');
  });

  it('Normalfall trägt das Kennzeichen gar nicht (Antwort bleibt unverändert)', async () => {
    mockedGetSong.mockResolvedValue(ctSong());
    mockedDownload.mockResolvedValue('[C]Text\n');

    expect((await getSongChart('cookie', 42)).chordproFailed).toBeUndefined();
  });

  it('scheitert nur eine VERSION, wird das Lied trotzdem gekennzeichnet', async () => {
    // Sonst hätte man die Akkorde vor sich, aber die gewählte Version wäre still leer.
    mockedGetSong.mockResolvedValue(ctSongMitVersion());
    mockedDownload.mockImplementation((_cookie: string, url: string) =>
      url.includes('id=2')
        ? Promise.reject(new HttpError(504, 'weg'))
        : Promise.resolve('{title: Original}\n[C]Text\n'),
    );

    const chart = await getSongChart('cookie', 42);
    expect(chart.chordproFailed).toBe(true);
    expect(chart.chordpro).toContain('[C]Text'); // Original ist da …
    expect(chart.versions[0]?.text).toBe(''); // … die Version nicht
  });

  it('ein Fehlschlag beim Original hindert die Version nicht am Laden', async () => {
    mockedGetSong.mockResolvedValue(ctSongMitVersion());
    mockedDownload.mockImplementation((_cookie: string, url: string) =>
      url.includes('id=1')
        ? Promise.reject(new HttpError(504, 'weg'))
        : Promise.resolve('{title: Akustik-Fassung}\n[G]Version\n'),
    );

    const chart = await getSongChart('cookie', 42);
    expect(chart.chordproFailed).toBe(true);
    expect(chart.versions[0]?.text).toContain('[G]Version');
    // Kopfangaben fallen auf die erste Version zurück – wie ohne Original.
    expect(chart.title).toBe('Akustik-Fassung');
  });
});
