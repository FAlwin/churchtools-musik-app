/** Auswählbare Schriftarten für die Chord-Chart-Anzeige. */
export interface FontOption {
  id: string;
  label: string;
  family: string;
  desc: string;
}

export const FONTS: FontOption[] = [
  { id: 'inter', label: 'Inter', family: "'Inter', sans-serif", desc: 'Klar · Modern (Standard)' },
  { id: 'atkinson', label: 'Atkinson Hyperlegible', family: "'Atkinson Hyperlegible', sans-serif", desc: 'Maximale Lesbarkeit' },
  { id: 'lato', label: 'Lato', family: "'Lato', sans-serif", desc: 'Freundlich · Ruhig' },
  { id: 'merriweather', label: 'Merriweather', family: "'Merriweather', serif", desc: 'Serifenschrift · Buchstil' },
  { id: 'georgia', label: 'Georgia', family: "'Georgia', serif", desc: 'Traditionell · Serif' },
];

// Voreingestellte Anmerkungs-Farben: Orange + Petrol (CD) + Schwarz/Weiß.
// '#14110F' wird im Dunkelmodus auf Creme gemappt (siehe ChordChart) → „adaptiv".
// Beliebige Farben gibt es zusätzlich über den freien Farbwähler in der Werkzeugleiste.
export const DRAW_COLORS = ['#EB5E28', '#00616E', '#14110F'];

/** Rotierende Akzentfarben der Noten-Kacheln (ChurchTools-Markenpalette). */
export const ACCENTS = ['#0061A1', '#12B2A2', '#F2820C', '#B22247'];

export function fontFamilyById(id: string): string {
  return (FONTS.find((f) => f.id === id) ?? FONTS[0]).family;
}
