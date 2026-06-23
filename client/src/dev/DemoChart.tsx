import type { SetlistSong } from '@shared/types/index';
import { ChordChart } from '../pages/ChordChart';

/**
 * NUR Entwicklung (?demo=chart): mountet ChordChart mit Testdaten (ohne CT-Login), um die
 * neue vereinheitlichte PDF-Liedansicht (ChordPro → erzeugte PDF im Viewer) zu prüfen.
 */

const CHORDPRO = `{title: Großer Gott wir loben dich}
{key: G}

{comment: Vers 1}
[G]Großer Gott, wir [D]loben dich,
[Em]Herr, wir [C]preisen deine [G]Stärke.
[G]Vor dir neigt die [D]Erde sich
[Em]und bewundert [C]deine [G]Werke.

{comment: Refrain}
[C]Halleluja, [G]singt dem Herrn,
[D]preist ihn, alle [Em]Welt.`;

const SONG: SetlistSong = {
  id: 999001,
  arrangementId: 999001,
  title: 'Großer Gott wir loben dich',
  author: 'Demo',
  originalKey: 'G',
  targetKey: 'G',
  bpm: 72,
  timeSig: '4/4',
  ccli: null,
  chordpro: CHORDPRO,
  chordproEdited: null,
  documents: [],
};

export function DemoChart() {
  return (
    <ChordChart songs={[SONG]} startIndex={0} onBack={() => undefined} canEditSong theme="light" fontId="system" />
  );
}
