import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * #236: `{title: …}` / `{artist: …}` aus der ChordPro-Datei müssen den ChurchTools-Liednamen
 * schlagen – genau wie `{key}` und `{time}` es schon taten.
 *
 * Geprüft wird über `getSongChart`, weil `buildSong` selbst nicht exportiert ist. Damit hängt der
 * Test an der **Verdrahtung** und nicht nur an `metaValue`: Es war ja gerade die fehlende
 * Verdrahtung, die den Fehler ausgemacht hat.
 */
vi.mock('./churchtools.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./churchtools.js')>()),
  getSong: vi.fn(),
  downloadFileText: vi.fn(),
}));

import { getSongChart } from './setlistBuilder.js';
import { getSong, downloadFileText, type CtSong } from './churchtools.js';

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
  } as unknown as CtSong;
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
