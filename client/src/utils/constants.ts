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

export const DRAW_COLORS = ['#EB5E28', '#00616E', '#14110F', '#c0392b', '#5898A0'];

export function fontFamilyById(id: string): string {
  return (FONTS.find((f) => f.id === id) ?? FONTS[0]).family;
}
