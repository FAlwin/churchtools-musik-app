import type { SetlistSong } from '@shared/types/index';
import { ChordChart } from '../pages/ChordChart';

/**
 * NUR Entwicklung (?demo=chart): mountet ChordChart mit mehreren Testliedern (ohne CT-Login),
 * um den durchgehenden 2-up-Seitenstrom (Querformat) und die PDF-Liedansicht zu prüfen.
 */

function song(id: number, title: string, key: string, chordpro: string): SetlistSong {
  return {
    id,
    arrangementId: id,
    title,
    author: 'Demo',
    originalKey: key,
    targetKey: key,
    bpm: 72,
    timeSig: '4/4',
    ccli: null,
    chordpro,
    chordproEdited: null,
    documents: [],
  };
}

const SONGS: SetlistSong[] = [
  song(
    999001,
    'Großer Gott wir loben dich',
    'G',
    `{title: Großer Gott wir loben dich}
{comment: Vers 1}
[G]Großer Gott, wir [D]loben dich,
[Em]Herr, wir [C]preisen deine [G]Stärke.
{comment: Refrain}
[C]Halleluja, [G]singt dem Herrn,
[D]preist ihn, alle [Em]Welt.`,
  ),
  song(
    999002,
    'Welch ein Freund ist unser Jesus',
    'G',
    `{title: Welch ein Freund ist unser Jesus}
{comment: Vers 1}
[G]Welch ein Freund ist unser Jesus, [C]o wie hoch ist er erhöht.
[G]Er hat uns mit Gott versöhnet [C]und vertritt uns im Gebet.
{comment: Vers 2}
[G]Wenn des Feindes Macht uns drohet [C]und manch Sturm rings um uns weht,
[G]brauchen wir uns nicht zu fürchten, [C]stehn wir gläubig im Gebet.`,
  ),
  song(
    999003,
    'Treu',
    'E',
    `{title: Treu}
{comment: Vers}
[E]Du bleibst an meiner Seite [F#m7]du schämst dich nicht für mich
[A]Du weißt ich bin untreu [B]und dennoch gehst du nicht
{comment: Chorus}
[E]Du bist treu Herr [A]an jedem neuen Tag
[E]Du bist treu Herr [F#m7]auch wenn ich ver - sag [B]`,
  ),
];

export function DemoChart() {
  return (
    <ChordChart songs={SONGS} startIndex={0} onBack={() => undefined} canEditSong theme="light" fontId="system" />
  );
}
