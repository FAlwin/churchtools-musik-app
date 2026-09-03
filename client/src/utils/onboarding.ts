import type { CoachStep } from '../components/Coachmarks';

/**
 * Merker + Schrittdefinitionen der geführten Einführung (#Onboarding). Der „gesehen"-Zustand liegt
 * in localStorage (pro Gerät); „Einführung nochmal ansehen" im Mehr-Tab setzt ihn zurück.
 */
const PREFIX = 'worship:onboard-';
//
// ═══ Wann die Version erhöht werden MUSS ═══════════════════════════════════════════════════════
// Nur wenn die bisherige Fassung **ausgeliefert** war: Wer die Tour einmal weggeklickt hat, sieht
// einen nachgezogenen Text sonst nie wieder. War sie nie draußen, kennt sie niemand – dann genügt
// das Nachziehen. **Diese Frage wird gemessen, nicht geschätzt** (siehe chart-v4 unten, wo die
// Schätzung falsch war): `git show <letzter-Tag>:client/src/utils/onboarding.ts | grep <version>`.
//
// termine-v3: Der Schritt „Die Bereiche" nennt jetzt das Anlegen neuer Lieder (#322) – der +-Knopf
// im Liederheft ist neu und sieht nach nichts aus. Version erhöht, damit Bestandsnutzer den
// geänderten Schritt sehen.
// (termine-v2 hatte den Schritt „geändert"-Hinweis (#143) ergänzt.)
// #378 (14.08.2026): Der Schritt nannte kurz den Quellen-Umschalter „Bibliothek | Liedtexte |
// SongSelect" – der ist am 03.09.2026 wieder weg (Rückmeldung Alwin). Der Text beschreibt jetzt, was
// das Liederheft tut: ein Suchfeld, darunter das Angebot „Auch in den Liedtexten suchen". **Ohne
// Versionssprung, belegt:** `termine-v3` steckt in v2.22.0 (Prod) mit einem Text, der genau dieses
// Verhalten beschreibt („durchsuchst du alle Lieder"); der Umschalter-Text war nie draußen. Für
// Bestandsnutzer hat sich am Liederheft nichts geändert – ein erneutes Zeigen wäre Lärm.
export const TOUR_TERMINE = 'termine-v3';
// chart-v4: Der Tempo-Knopf oeffnet jetzt ein MENUE (#145 Folge) statt nur den Puls zu schalten –
// und er ist neuerdings auch bei Liedern OHNE gepflegtes Tempo da, weil man genau dort eins
// antippen will. Beides sieht man dem Knopf nicht an, also gehoert es in die Einfuehrung.
// Die spaeteren Textaenderungen (Metronom-Menue, „Lied-Optionen" mit der Dateiverwaltung #321,
// „Notizen von anderen" mit dem Umschalter) wurden NACHGEZOGEN, ohne die Version zu erhoehen –
// begruendet damit, chart-v4 sei „nie in Produktion" gewesen.
// ACHTUNG, diese Begruendung war falsch (gemessen am 13.08.2026 im ausgelieferten Bundle): chart-v4
// steckt seit v2.18.0 im Code, und produktiv laeuft v2.20.0. Die Fassung IST also draussen.
// chart-v5 (13.08.2026): Der Schritt „Lied-Optionen" nennt jetzt auch die **Stammdaten** (#322,
// Schritt 11) – Name, Kategorie, Autor, CCLI-Nummer und Copyright aendert man in der App. Hier wurde
// die Version deshalb wirklich erhoeht: Wer die Tour unter v2.20.0 weggeklickt hat, saehe einen
// nachgezogenen Text sonst nie.
// chart-v3: Der Tipp in die Mitte blendet jetzt die Leisten aus (#319) – die Geste findet man
// sonst nicht von selbst. Version erhöht, damit Bestandsnutzer den geänderten Schritt sehen.
// (chart-v2 hatte den Schritt „Team-Anmerkungen" (#124) ergänzt.)
export const TOUR_CHART = 'chart-v5';

/**
 * Einmaliger Hinweis, wenn die Leisten zum ersten Mal ausgeblendet werden (#319).
 *
 * Ohne ihn kann man feststecken: Mit ausgeblendeten Leisten ist auch der Zurück-Knopf weg, und
 * dass ein weiterer Tipp in die Mitte sie zurückholt, sieht man dem Blatt nicht an. Nutzt bewusst
 * dieselbe Merker-Mechanik wie die Touren, statt eine zweite daneben zu bauen.
 */
export const HINT_VOLLBILD = 'hinweis-vollbild';
export const TOUR_SETLIST = 'setlist-v1';
// setlist-edit-v2: „Hinzufügen" kann jetzt auch ein Lied ANLEGEN (#322) – bisher konnte man nur
// vorhandene wählen. Version erhöht, damit Bestandsnutzer den geänderten Schritt sehen.
// #378 (14.08.2026): Der Schritt sprach von „bei SongSelect gesucht oder selbst eingetippt" – das
// war die **Wegwahl**, die es nicht mehr gibt. Kurz nannte er den Umschalter (nie ausgeliefert).
// setlist-edit-v3 (03.09.2026): Jetzt nennt er das eine Suchfeld mit den Angeboten darunter – und
// hier ist der Sprung nötig, **gemessen**: `git show v2.22.0:client/src/utils/onboarding.ts` enthält
// `setlist-edit-v2` mit dem Wegwahl-Text, und v2.22.0 läuft produktiv. Wer die Tour dort weggeklickt
// hat, sähe den geänderten Einfüge-Dialog sonst nie erklärt. (Die Begründung „nie ausgeliefert" ist
// genau die, die bei chart-v4 schon einmal falsch war – siehe oben.)
export const TOUR_SETLIST_EDIT = 'setlist-edit-v3';

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
    selector: '[data-tour="setlist-geaendert"]',
    title: 'Was sich geändert hat',
    body: 'Der blaue Punkt erscheint, wenn sich der Ablauf geändert hat, seit du den Termin zuletzt geöffnet hast – wie bei ungelesenen Nachrichten. Er verschwindet, sobald du wieder reingeschaut hast.',
  },
  {
    selector: '[data-tour="offline"]',
    title: 'Auch ohne Netz da',
    body: 'Der nächste Gottesdienst wird automatisch für den Offline-Gebrauch vorbereitet. Die Wolke zeigt, dass er auch ohne Internet verfügbar ist.',
  },
  {
    selector: '[data-tour="tabbar"]',
    title: 'Die Bereiche',
    body: 'Unter „Lieder" durchsuchst du alle Lieder; findet der Titel nichts, kannst du darunter auch in den Liedtexten suchen. Über „Neues Lied" legst du eines an, wenn du in ChurchTools Lieder bearbeiten darfst. Unter „Mehr" findest du Einstellungen und kannst diese Einführung erneut starten.',
  },
];

/** Gruppe 2 – Chart-Ansicht (beim ersten Öffnen eines Liedes). */
export const CHART_STEPS: CoachStep[] = [
  {
    selector: '[data-tour="chart-blaettern"]',
    title: 'Blättern & Zoomen',
    body: 'Wische seitwärts, um zwischen den Seiten zu blättern. Mit zwei Fingern zoomst du rein und wieder heraus. Ein Tipp in die Mitte blendet die Leisten aus – dann hat das Blatt die ganze Fläche.',
  },
  {
    selector: '[data-tour="chart-lied"]',
    title: 'Lied-Optionen',
    body: 'Tippe auf den Titel, um die Tonart zu ändern, eine Version zu wählen oder zu transponieren. Unter „Dateien …" verwaltest du die Notenblätter des Arrangements, unter „Stammdaten …" Name, Kategorie, Autor und Copyright des Liedes.',
  },
  {
    selector: '[data-tour="chart-aussehen"]',
    title: 'Darstellung',
    body: 'Hier passt du Schriftgröße und Spaltenzahl an.',
  },
  {
    selector: '[data-tour="chart-tempo"]',
    title: 'Tempo',
    body: 'Hinter dem Metronom steckt alles zum Tempo. Oben stellst du es ein – mit − und +, durch Eintippen oder indem du im Takt mittippst. Unter „Schläge je Takt" stellst du ein, wie viele Schläge du je Takt zählst – ein 6/8-Stück zählt man meist in zwei, ein schnelles 4/4 auch. Darunter ein sichtbarer Puls und ein hörbarer Klick; beide gelten nur für dich. Nur der Knopf ganz unten speichert das Tempo in ChurchTools – dann sehen es alle.',
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
    body: 'Sieh dir die geteilten Anmerkungen deiner Team-Mitglieder an – in deren Ansicht – und übernimm sie bei Bedarf in deine eigenen. In der Leiste unten wechselst du dann Arrangement, Version oder die Person. Deine Anmerkungen teilst du unter „Mehr → Team-Notizen".',
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
    body: 'Füge unten einen neuen Punkt oder ein Lied zum Ablauf hinzu. Ein Suchfeld genügt: Zuerst findest du eure eigenen Lieder, darunter kannst du in den Liedtexten oder bei SongSelect weitersuchen – und ist ein Lied bei euch nicht da, sucht SongSelect von selbst mit. Ein SongSelect-Treffer wird als neues Lied angelegt und in den Ablauf eingetragen.',
  },
];
