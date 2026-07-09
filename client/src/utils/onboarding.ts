import type { CoachStep } from '../components/Coachmarks';

/**
 * Merker + Schrittdefinitionen der geführten Einführung (#Onboarding). Der „gesehen"-Zustand liegt
 * in localStorage (pro Gerät); „Einführung nochmal ansehen" im Mehr-Tab setzt ihn zurück.
 */
const PREFIX = 'worship:onboard-';
export const TOUR_TERMINE = 'termine-v1';
// chart-v2: Schritt „Team-Anmerkungen" (#124) ergänzt – Version erhöht, damit Bestandsnutzer
// den neuen Schritt beim ersten Öffnen nach dem Update sehen.
export const TOUR_CHART = 'chart-v2';
export const TOUR_SETLIST = 'setlist-v1';
export const TOUR_SETLIST_EDIT = 'setlist-edit-v1';

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

/** Gruppe 2 – Chart-Ansicht (beim ersten Öffnen eines Liedes). */
export const CHART_STEPS: CoachStep[] = [
  {
    selector: '[data-tour="chart-blaettern"]',
    title: 'Blättern & Zoomen',
    body: 'Wische seitwärts, um zwischen den Seiten zu blättern. Mit zwei Fingern zoomst du rein und wieder heraus.',
  },
  {
    selector: '[data-tour="chart-lied"]',
    title: 'Lied-Optionen',
    body: 'Tippe auf den Titel, um die Tonart zu ändern, eine Version zu wählen oder zu transponieren.',
  },
  {
    selector: '[data-tour="chart-aussehen"]',
    title: 'Darstellung',
    body: 'Hier passt du Schriftgröße und Spaltenzahl an.',
  },
  {
    selector: '[data-tour="chart-anmerken"]',
    title: 'Anmerkungen',
    body: 'Zeichne oder schreibe Notizen direkt auf die Seite – sie werden pro Konto gespeichert.',
  },
  // Nur für Team-Berechtigte sichtbar (sonst existiert der Knopf nicht → Schritt wird übersprungen).
  {
    selector: '[data-tour="chart-team"]',
    title: 'Notizen von anderen',
    body: 'Sieh dir die geteilten Anmerkungen deiner Team-Mitglieder an – in deren Ansicht – und übernimm sie bei Bedarf in deine eigenen. Deine Anmerkungen teilst du unter „Mehr → Team-Notizen".',
  },
];

/** Gruppe 3 – Ablauf-Ansicht (beim ersten Öffnen eines Gottesdienstes). */
export const SETLIST_STEPS: CoachStep[] = [
  {
    selector: '[data-tour="setlist-song"]',
    title: 'Lieder öffnen',
    body: 'Tippe ein Lied im Ablauf an, um seine Akkord-Blätter zu öffnen.',
  },
  {
    selector: '[data-tour="setlist-share"]',
    title: 'Als PDF teilen',
    body: 'Alle Lieder dieses Gottesdienstes auf einmal als PDF teilen – z. B. per Mail oder zum Drucken.',
  },
  {
    selector: '[data-tour="setlist-edit"]',
    title: 'Ablauf bearbeiten',
    body: 'Reihenfolge ändern, Punkte hinzufügen oder anpassen. Tippe hier, um in den Bearbeiten-Modus zu wechseln.',
  },
];

/** Gruppe 4 – Ablauf-Bearbeiten (beim ersten Wechsel in den Bearbeiten-Modus). */
export const SETLIST_EDIT_STEPS: CoachStep[] = [
  {
    selector: '[data-tour="edit-drag"]',
    title: 'Sortieren',
    body: 'Ziehe einen Punkt an diesem Griff, um die Reihenfolge zu ändern.',
  },
  {
    selector: '[data-tour="edit-item"]',
    title: 'Punkt bearbeiten',
    body: 'Tippe einen Eintrag an, um Titel, Dauer, Zuständige zu ändern oder ein Lied zu verknüpfen.',
  },
  {
    selector: '[data-tour="edit-add"]',
    title: 'Hinzufügen',
    body: 'Füge unten einen neuen Punkt oder ein Lied zum Ablauf hinzu.',
  },
];
