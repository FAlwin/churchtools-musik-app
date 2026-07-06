import type { CoachStep } from '../components/Coachmarks';

/**
 * Merker + Schrittdefinitionen der geführten Einführung (#Onboarding). Der „gesehen"-Zustand liegt
 * in localStorage (pro Gerät); „Einführung nochmal ansehen" im Mehr-Tab setzt ihn zurück.
 */
const PREFIX = 'worship:onboard-';
export const TOUR_TERMINE = 'termine-v1';

export function isTourDone(key: string): boolean {
  try {
    return localStorage.getItem(PREFIX + key) === '1';
  } catch {
    return true; // kein Speicher → Tour lieber nicht aufdrängen
  }
}

export function markTourDone(key: string): void {
  try {
    localStorage.setItem(PREFIX + key, '1');
  } catch {
    /* Speicher voll/gesperrt – dann eben erneut zeigen */
  }
}

/** Alle Touren zurücksetzen → erscheinen wieder („Einführung nochmal ansehen"). */
export function resetTours(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* ignorieren */
  }
}

/** Gruppe 1 – Termine. Zielt auf `[data-tour="…"]`-Elemente; fehlende werden übersprungen. */
export const TERMINE_STEPS: CoachStep[] = [
  {
    selector: '[data-tour="termine-liste"]',
    title: 'Eure Gottesdienste',
    body: 'Hier findest du die kommenden Gottesdienste mit ihrem Ablauf. Tippe einen an, um ihn zu öffnen.',
  },
  {
    selector: '[data-tour="songbook"]',
    title: 'Liedblätter öffnen',
    body: 'Tippe auf das Notensymbol, um direkt alle Lieder als Akkord-Blätter zu öffnen. Die kleine Zahl zeigt, wie viele es sind.',
  },
  {
    selector: '[data-tour="offline"]',
    title: 'Auch ohne Netz da',
    body: 'Der nächste Gottesdienst wird automatisch für den Offline-Gebrauch vorbereitet. Die Wolke zeigt, dass er auch ohne Internet verfügbar ist.',
  },
  {
    selector: '[data-tour="tabbar"]',
    title: 'Die Bereiche',
    body: 'Unter „Lieder" durchsuchst du alle Lieder, unter „Mehr" findest du Einstellungen – und kannst diese Einführung erneut starten.',
  },
];
