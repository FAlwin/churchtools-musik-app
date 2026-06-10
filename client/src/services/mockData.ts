/**
 * Mock-Daten – ersetzen in Schritt 8 die echten ChurchTools-Aufrufe.
 * Struktur entspricht den geteilten Typen, damit der Austausch später nahtlos ist.
 */
import type { Service, SetlistSong } from '@shared/types/index';

export const MOCK_SONGS: SetlistSong[] = [
  {
    id: 1,
    arrangementId: 101,
    title: 'Unendlich Groß',
    author: 'ECG Worship',
    originalKey: 'G',
    targetKey: 'G',
    bpm: 74,
    timeSig: '4/4',
    ccli: null,
    chordpro: `{start_of_verse: Verse 1}
[G]Wenn ich die [D]Weite des [Em]Himmels seh
[C]Und die [G]Sterne in der [D]Nacht
[G]Dann denk ich [D]daran wie [Em]groß du bist
[C]Und ich [G]staune über [D]deine Macht
{end_of_verse}
{start_of_chorus: Chorus}
[G]Unendlich groß, [D]unendlich weit
[Em]Dein Name steht für [C]Ewigkeit
[G]Unendlich treu, [D]unendlich nah
[Em]Du bist es Gott, [C]du warst stets [D]da
[G] [D] [Em] [C]
{end_of_chorus}
{start_of_verse: Verse 2}
[G]In allem was ich [D]seh und [Em]kenn
[C]Spür ich [G]deine Gegen[D]wart
[G]Du hältst die Welt [D]in deiner [Em]Hand
[C]Bist größer [G]als mein [D]Verstand
{end_of_verse}
{start_of_bridge: Bridge}
[Em]Holy, [C]holy, [G]holy is the Lord
[Em]Holy, [C]holy, [D]holy is the Lord
[Em]Holy, [C]holy, [G]holy is the Lord
[Em]Forever and [C]ever, [D]Amen, [G]Amen
{end_of_bridge}`,
  },
  {
    id: 2,
    arrangementId: 102,
    title: 'Du Bist Heilig',
    author: 'ECG Worship',
    originalKey: 'E',
    targetKey: 'D',
    bpm: 68,
    timeSig: '4/4',
    ccli: null,
    chordpro: `{start_of_verse: Verse 1}
[E]Du bist [F#m]heilig, [A]du bist [B]heilig
[E]Herr und [F#m]Gott, du [A]bist hei[B]lig
[E]Dein Name [F#m]steht, dein [A]Name [B]steht
[E]Über [F#m]allem, [A]du re[B]gierst
{end_of_verse}
{start_of_chorus: Chorus}
[A]Heilig, heilig, [E]heilig
[B]Heilig ist der [F#m]Herr
[A]Heilig, heilig, [E]heilig
[B]Heilig ist der [F#m7]Herr
[A]Gott Ze[E/G#]baoth
[F#m]Himmel und [B]Erde
[A]Sind voll von [E]deiner Herrlich[B]keit
{end_of_chorus}
{start_of_bridge: Bridge}
[A]Würdig bist du, [E]würdig bist du
[B]Würdig ist das [C#m]Lamm
[A]Der da war und [E]der da ist
[B]Und der da [E]kommt
[A] [E] [B] [E]
{end_of_bridge}`,
  },
  {
    id: 3,
    arrangementId: 103,
    title: 'Großer Gott',
    author: 'ECG Worship',
    originalKey: 'D',
    targetKey: 'D',
    bpm: 80,
    timeSig: '4/4',
    ccli: null,
    chordpro: `{start_of_verse: Verse 1}
[D]Wenn der Morgen graut und [A]neue Hoffnung trägt
[Bm]Wenn das Licht des Tages [G]meine Dunkel wegt
[D]Dann will ich dir sagen [A]Herr, du bist so treu
[G]Deine Gnade ist jeden [A]Morgen neu
{end_of_verse}
{start_of_chorus: Chorus}
[D]Großer Gott wir loben [A]dich
[Bm]Herr wir preisen [G]deine Stärk
[D]Vor dir neigt die Erde [A]sich
[G]Und bewundert deine [A]Werk
{end_of_chorus}
{start_of_bridge: Bridge}
[Bm]Heilig, [G]heilig, [D]heilig
[A]Herr Gott [Bm]Sabaoth
[G]Himmel und [D]Erde sind
[A]Voll von deinem [D]Ruhm
{end_of_bridge}`,
  },
  {
    id: 4,
    arrangementId: 104,
    title: 'Komm Heiliger Geist',
    author: 'ECG Worship',
    originalKey: 'C',
    targetKey: 'C',
    bpm: 72,
    timeSig: '4/4',
    ccli: null,
    chordpro: `{start_of_verse: Verse 1}
[C]Komm Heiliger [Am]Geist, komm [F]fülle diesen [G]Raum
[C]Komm mit deiner [Am]Kraft, komm [F]mach aus uns was [G]du kannst
[Am]Wir öffnen uns für [F]dich
[C]Du bist es der uns [G]trägt
{end_of_verse}
{start_of_chorus: Chorus}
[C]Komm [G]Feuer komm [Am]Geist komm [F]Herr
[C]Komm [G]wie der Wind [Am]weht durch die [F]Nacht
[C]Komm [G]Heiliger [Am]Geist komm [F]jetzt
[C]Und zeig wie groß [G]du bist, wie [C]groß
{end_of_chorus}`,
  },
  {
    // Beispiel im SongSelect-Dialekt ({comment: …}) zum Testen beider Formate
    id: 5,
    arrangementId: 105,
    title: 'Treu',
    author: 'Tobias Gerster',
    originalKey: 'E',
    targetKey: 'E',
    bpm: 72,
    timeSig: '4/4',
    ccli: '4328979',
    chordpro: `{title: Treu}
{artist: Tobias Gerster}
{key: E}
{tempo: 72}
{ccli: 4328979}

{comment: Vers}
Du [E]bleibst an meiner Seite    du [F#m7]schämst dich nicht für mich
Du [A]gehst an meiner [E]Seite    und [B]trägst mich

{comment: Chorus}
Du bist [E]treu Herr    an [A]jedem neuen Tag
Du bist [E]treu Herr    in [B]allem was ich [C#m]sag
[E] [A] [E] [B]`,
  },
];

export const MOCK_SERVICES: Service[] = [
  {
    id: 1,
    day: '14',
    month: 'Jun',
    weekday: 'Sonntag',
    name: 'Sonntagsgottesdienst',
    date: '2026-06-14',
    time: '10:00 Uhr',
    location: 'Haupthalle',
    songCount: 4,
  },
  {
    id: 2,
    day: '21',
    month: 'Jun',
    weekday: 'Sonntag',
    name: 'Sonntagsgottesdienst',
    date: '2026-06-21',
    time: '10:00 Uhr',
    location: 'Haupthalle',
    songCount: 3,
  },
  {
    id: 3,
    day: '26',
    month: 'Jun',
    weekday: 'Freitag',
    name: 'Gebetsabend',
    date: '2026-06-26',
    time: '19:30 Uhr',
    location: 'Café-Raum',
    songCount: 5,
  },
];

/** Welche Songs zu welchem Gottesdienst gehören (Mock). */
export const MOCK_SETLISTS: Record<number, number[]> = {
  1: [1, 2, 3, 4],
  2: [2, 1, 4],
  3: [5, 3, 1, 2, 4],
};
