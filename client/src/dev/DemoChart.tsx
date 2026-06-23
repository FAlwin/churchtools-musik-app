import { useState } from 'react';
import type { SetlistSong } from '@shared/types/index';
import { ChordChart } from '../pages/ChordChart';
import type { Theme } from '../types/index';

/**
 * NUR Entwicklung: rendert den ChordChart mit Testdaten (ohne ChurchTools-Login),
 * damit das Seiten-/Skalier-Layout (#25) im Browser-Preview prüfbar ist.
 * Aktiv über `?demo=chart` und nur unter `import.meta.env.DEV` (siehe main.tsx) –
 * geht nie in den Produktiv-Build.
 */

const DEMO_CHORDPRO = `{title: Demolied}
{key: G}

{comment: Vers 1}
[G]Großer Gott, wir [D]loben dich,
[Em]Herr, wir [C]preisen deine [G]Stärke.
[G]Vor dir neigt die [D]Erde sich
[Em]und bewundert [C]deine [G]Werke.
[C]Wie du warst vor [G]aller Zeit,
[D]so bleibst du in [G]Ewigkeit.

{comment: Refrain}
[C]Halleluja, [G]singt dem Herrn,
[D]preist ihn, alle [Em]Welt.
[C]Halleluja, [G]lobt den Herrn,
[D]der uns treu er[G]hält.

{comment: Vers 2}
[G]Alles, was dich [D]preisen kann,
[Em]Cherubim und [C]Serafi[G]nen,
[G]stimmen dir ein [D]Loblied an,
[Em]alle Engel, [C]die dir [G]dienen.
[C]Rufen dir stets [G]ohne Ruh':
[D]Heilig, heilig, [G]heilig zu.

{comment: Bridge}
[Am]Herr, erbarme [C]dich,
[G]führe uns zu [D]dir.
[Am]Lass uns ewig [C]leben
[D]in deiner Gegen[G]wart.

{comment: Refrain}
[C]Halleluja, [G]singt dem Herrn,
[D]preist ihn, alle [Em]Welt.
[C]Halleluja, [G]lobt den Herrn,
[D]der uns treu er[G]hält.

{comment: Schluss}
[G]Amen, [D]amen, [C]amen, [G]amen.
`;

const DEMO_SONG: SetlistSong = {
  id: 999001,
  arrangementId: 999001,
  title: 'Demolied',
  author: 'Demo-Autor',
  originalKey: 'G',
  targetKey: 'G',
  bpm: 72,
  timeSig: '4/4',
  ccli: null,
  chordpro: DEMO_CHORDPRO,
  chordproEdited: null,
  documents: [],
};

const DEMO_SONG_2: SetlistSong = {
  ...DEMO_SONG,
  id: 999002,
  arrangementId: 999002,
  title: 'Zweites Demolied',
  targetKey: 'D',
  chordpro: DEMO_CHORDPRO.replace('{title: Demolied}', '{title: Zweites Demolied}'),
};

export function DemoChart() {
  const [theme] = useState<Theme>('light');
  return (
    <ChordChart
      songs={[DEMO_SONG, DEMO_SONG_2]}
      startIndex={0}
      onBack={() => undefined}
      canEditSong
      theme={theme}
      fontId="system"
    />
  );
}
