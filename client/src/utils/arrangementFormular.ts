/**
 * Das Formular „Arrangement" – als **reine Funktionen** (#396).
 *
 * Dieselbe Aufteilung wie bei `liedFormular.ts`: Was sich rechnen lässt, steht hier und ist in
 * Sekunden prüfbar; die Komponente bleibt Anzeige. Drei Dinge sind hier gefährlicher, als sie
 * aussehen:
 *
 *  1. **Die Länge.** ChurchTools führt sie in **Sekunden** (gemessen: 245 → 4:05), der Dialog zeigt
 *     Minuten:Sekunden. Diese Umrechnung steht genau einmal – an zwei Stellen gerechnet wäre sie
 *     die Wiederholung des PDF-Fehlers vom 31.07.2026 (drei Rechnungen, einer fehlte der Kapo-Abzug).
 *  2. **Der Unterschied zwischen „unverändert" und „leeren".** Der Server versteht `undefined` als
 *     „nicht anfassen" und `null` als „leeren". Ein Formular kennt nur Text – die Übersetzung macht
 *     `auftragAus`, und nur sie.
 *  3. **Quelle und Liednummer gehören zusammen.** Wer die Quelle wegnimmt, verliert die Nummer; das
 *     entscheidet der Server (`arrangementPayload.ts`), aber die Oberfläche muss es **vorher sagen**,
 *     statt den Nutzer in eine Fehlermeldung laufen zu lassen.
 */
import {
  ARRANGEMENT_GRENZEN,
  type ArrangementAnsicht,
  type ArrangementAuftrag,
} from '@shared/types/index';

/** Das Formular – alle Felder als Text, wie die Eingabefelder sie liefern. */
export interface ArrangementFormular {
  name: string;
  key: string;
  tempo: string;
  beat: string;
  /** Minuten-Anteil der Länge. */
  laengeMin: string;
  /** Sekunden-Anteil der Länge. */
  laengeSek: string;
  description: string;
  /** Die gewählte Quelle; `null` = keine. */
  sourceId: number | null;
  sourceReference: string;
}

export const LEERES_ARRANGEMENT: ArrangementFormular = {
  name: '',
  key: '',
  tempo: '',
  beat: '',
  laengeMin: '',
  laengeSek: '',
  description: '',
  sourceId: null,
  sourceReference: '',
};

/**
 * Sekunden → Minuten und Sekunden, für die beiden Eingabefelder.
 *
 * `null` gibt zwei leere Felder – nicht „0:00". Eine Länge, die niemand eingetragen hat, ist etwas
 * anderes als eine Länge von null Sekunden.
 */
export function laengeTeile(sekunden: number | null): { min: string; sek: string } {
  if (sekunden === null || !Number.isFinite(sekunden) || sekunden <= 0) return { min: '', sek: '' };
  const min = Math.floor(sekunden / 60);
  const sek = sekunden % 60;
  return { min: String(min), sek: String(sek).padStart(2, '0') };
}

/**
 * Minuten und Sekunden → Sekunden, oder `null`, wenn nichts (Sinnvolles) dasteht.
 *
 * **Beide Felder leer heißt `null`, nicht 0** – sonst würde jedes Speichern eines Arrangements ohne
 * Länge eine Länge von null Sekunden eintragen.
 */
export function laengeSekunden(min: string, sek: string): number | null {
  const m = min.trim() === '' ? 0 : Number(min);
  const s = sek.trim() === '' ? 0 : Number(sek);
  if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0) return null;
  const gesamt = Math.round(m) * 60 + Math.round(s);
  if (gesamt <= 0) return null;
  // Über der Grenze wird nicht stillschweigend gekürzt: Der Server lehnt ab, und das ist ehrlicher
  // als eine Länge, die jemand eingetippt hat und die nachher anders dasteht.
  return gesamt;
}

/** Die Länge als Text für die Liste – „4:05". Leer, wenn keine eingetragen ist. */
export function laengeText(sekunden: number | null): string {
  const { min, sek } = laengeTeile(sekunden);
  return min === '' ? '' : `${min}:${sek}`;
}

/**
 * Die Unterzeile der Liste – Tonart, Tempo, Takt, Länge, Quelle, durch Punkte getrennt.
 *
 * Sie lässt weg, was nicht gesetzt ist: Ein Arrangement ohne Tempo soll nicht „· ·" anzeigen. Als
 * reine Funktion steht sie hier und nicht in der Klammer eines `<span>` – dort wäre sie nur durch
 * Anklicken prüfbar.
 */
export function unterzeile(arr: ArrangementAnsicht): string {
  const teile: string[] = [];
  if (arr.key) teile.push(arr.key);
  if (arr.tempo !== null) teile.push(`${arr.tempo} bpm`);
  if (arr.beat) teile.push(arr.beat);
  const laenge = laengeText(arr.duration);
  if (laenge) teile.push(laenge);
  if (arr.source) {
    // Das Kürzel, wenn es eines gibt – „ULB 142" ist kürzer und genauso eindeutig wie der volle Name.
    const quelle = arr.source.shorty || arr.source.name;
    teile.push(arr.sourceReference ? `${quelle} ${arr.sourceReference}` : quelle);
  }
  return teile.join(' · ');
}

/** Füllt das Formular aus einem vorhandenen Arrangement. */
export function formularAusArrangement(arr: ArrangementAnsicht): ArrangementFormular {
  const { min, sek } = laengeTeile(arr.duration);
  return {
    name: arr.name,
    key: arr.key ?? '',
    tempo: arr.tempo === null ? '' : String(arr.tempo),
    beat: arr.beat ?? '',
    laengeMin: min,
    laengeSek: sek,
    description: arr.description ?? '',
    sourceId: arr.source?.id ?? null,
    sourceReference: arr.sourceReference ?? '',
  };
}

/** Ein Name muss sein, alles andere ist frei (dieselbe Grenze wie im Zod-Schema des Servers). */
export function arrangementBereit(f: ArrangementFormular): boolean {
  const name = f.name.trim();
  return name.length >= ARRANGEMENT_GRENZEN.name.min && name.length <= ARRANGEMENT_GRENZEN.name.max;
}

/**
 * Was der Nutzer sehen soll, **bevor** er speichert – oder `null`, wenn alles stimmt.
 *
 * Zwei Fälle:
 *  1. Eine **Liednummer ohne Quelle**. ChurchTools nimmt sie an und wirft sie weg (gemessen); der
 *     Server lehnt sie deshalb ab.
 *  2. Ein **Tempo außerhalb von `ARRANGEMENT_GRENZEN.tempo`** – demselben Bereich, den Metronom und
 *     Tipp-Tempo kennen. Ohne diesen Hinweis ließ sich ein Tempo von 5 speichern, das danach jeder
 *     Puls stillschweigend verwarf (Code-Check 21.09.2026).
 *
 * Beides steht hier und nicht in der Komponente, damit `bereit` es sperrt statt erst der Server.
 */
export function arrangementHinweis(f: ArrangementFormular): string | null {
  if (f.sourceReference.trim() !== '' && f.sourceId === null) {
    return 'Eine Liednummer speichert ChurchTools nur zusammen mit einer Quelle.';
  }
  const tempo = f.tempo.trim() === '' ? null : Number(f.tempo);
  const { min, max } = ARRANGEMENT_GRENZEN.tempo;
  if (tempo !== null && Number.isFinite(tempo) && (tempo < min || tempo > max)) {
    return `Das Tempo muss zwischen ${min} und ${max} Schlägen je Minute liegen.`;
  }
  return null;
}

/** Ein leeres Eingabefeld heißt „löschen" (`null`), ein unverändertes bleibt weg (`undefined`). */
function textFeld(neu: string, ist: string | null): string | null | undefined {
  const wert = neu.trim();
  const alt = ist ?? '';
  if (wert === alt.trim()) return undefined;
  return wert === '' ? null : wert;
}

/**
 * Baut den Auftrag aus **nur den geänderten** Feldern (#396).
 *
 * Ohne Vergleichsstand (`ist = null`, also beim Anlegen) geht alles mit, was ausgefüllt ist –
 * leere Felder haben dort nichts zu löschen.
 */
export function auftragAus(
  f: ArrangementFormular,
  ist: ArrangementAnsicht | null,
): ArrangementAuftrag & { name: string } {
  const name = f.name.trim();
  const tempo = f.tempo.trim() === '' ? null : Math.round(Number(f.tempo));
  const dauer = laengeSekunden(f.laengeMin, f.laengeSek);
  const nummer = f.sourceReference.trim();

  if (ist === null) {
    const auftrag: ArrangementAuftrag & { name: string } = { name };
    if (f.key.trim()) auftrag.key = f.key.trim();
    if (tempo !== null && Number.isFinite(tempo)) auftrag.tempo = tempo;
    if (f.beat.trim()) auftrag.beat = f.beat.trim();
    if (dauer !== null) auftrag.duration = dauer;
    if (f.description.trim()) auftrag.description = f.description.trim();
    if (f.sourceId !== null) {
      auftrag.sourceId = f.sourceId;
      if (nummer) auftrag.sourceReference = nummer;
    }
    return auftrag;
  }

  const auftrag: ArrangementAuftrag & { name: string } = { name };
  const key = textFeld(f.key, ist.key);
  if (key !== undefined) auftrag.key = key;
  const beat = textFeld(f.beat, ist.beat);
  if (beat !== undefined) auftrag.beat = beat;
  const beschreibung = textFeld(f.description, ist.description);
  if (beschreibung !== undefined) auftrag.description = beschreibung;

  const tempoNeu = tempo !== null && Number.isFinite(tempo) ? tempo : null;
  if (tempoNeu !== ist.tempo) auftrag.tempo = tempoNeu;
  if (dauer !== ist.duration) auftrag.duration = dauer;

  const quelleIst = ist.source?.id ?? null;
  if (f.sourceId !== quelleIst) auftrag.sourceId = f.sourceId;
  const nummerNeu = nummer === '' ? null : nummer;
  // Die Nummer geht auch dann mit, wenn nur die QUELLE gewechselt hat: Sie gehört zu ihr, und der
  // Server baut den Payload aus beiden zusammen.
  if (nummerNeu !== (ist.sourceReference ?? null) || f.sourceId !== quelleIst) {
    auftrag.sourceReference = nummerNeu;
  }
  return auftrag;
}

/**
 * Hat sich überhaupt etwas geändert? Sonst bleibt „Speichern" gesperrt.
 *
 * Gerechnet wird über `auftragAus` – **nicht über einen zweiten Feldvergleich daneben.** Ein
 * eigener Vergleich wäre dieselbe Regel in zweiter Fassung, und die erste, die jemand korrigiert,
 * wäre die falsche.
 */
export function hatAenderung(f: ArrangementFormular, ist: ArrangementAnsicht): boolean {
  const auftrag = auftragAus(f, ist);
  const nurName = Object.keys(auftrag).length === 1;
  return !nurName || auftrag.name !== ist.name;
}
