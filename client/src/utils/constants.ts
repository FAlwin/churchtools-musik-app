/** Auswählbare Schriftarten für die Chord-Chart-Anzeige. */
export interface FontOption {
  id: string;
  label: string;
  family: string;
  desc: string;
}

export const FONTS: FontOption[] = [
  { id: 'jetbrains', label: 'JetBrains Mono', family: "'JetBrains Mono', monospace", desc: 'Standard · Technisch' },
  { id: 'ibm', label: 'IBM Plex Mono', family: "'IBM Plex Mono', monospace", desc: 'Klar & Modern' },
  { id: 'courier', label: 'Courier New', family: "'Courier New', monospace", desc: 'Klassisch · Vertraut' },
  { id: 'merriweather', label: 'Merriweather', family: "'Merriweather', serif", desc: 'Lesbar · Serifenschrift' },
  { id: 'georgia', label: 'Georgia', family: "'Georgia', serif", desc: 'Traditionell · Serif' },
];

export const DRAW_COLORS = ['#EB5E28', '#00616E', '#14110F', '#c0392b', '#5898A0'];

export function fontFamilyById(id: string): string {
  return (FONTS.find((f) => f.id === id) ?? FONTS[0]).family;
}
