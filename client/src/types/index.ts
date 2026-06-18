/** Welcher Screen aktuell sichtbar ist. */
export type Screen = 'login' | 'agenda' | 'setlist' | 'chart' | 'songs' | 'songchart' | 'settings';

/** Tatsächlich angewandtes Erscheinungsbild. */
export type Theme = 'light' | 'dark';
/** Vom Nutzer gewählte Voreinstellung – „system" folgt dem Gerät. */
export type ThemePref = 'light' | 'dark' | 'system';

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
