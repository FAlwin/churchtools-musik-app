/** Welcher Screen aktuell sichtbar ist. */
export type Screen = 'login' | 'agenda' | 'setlist' | 'chart';

export type Theme = 'light' | 'dark';

/** Eine frei platzierte Text-Anmerkung auf einem Chart. */
export interface TextAnnotation {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
}

export type DrawTool = 'pen' | 'marker' | 'eraser' | 'text';
