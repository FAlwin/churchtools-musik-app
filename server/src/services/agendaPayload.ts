/**
 * Schreib-Payload für einen Ablaufpunkt in ChurchTools – die riskanteste reine Funktion des
 * Projekts (#212).
 *
 * **Warum das eigene Modul:** Die Funktion lag privat in `churchtools.ts` und war damit nur über
 * Netzwerk-Mocks erreichbar – sie hatte null Tests, obwohl seit #200 JEDES Speichern eines
 * Lied-Punkts darüber läuft. Nach `setlistBuilder.ts` konnte sie nicht wandern: das Modul
 * importiert selbst aus `churchtools.ts`, das wäre ein Zirkelbezug. Der Typ-Import hier zurück ist
 * `import type` und existiert zur Laufzeit nicht.
 *
 * **Die Gefahr:** ChurchTools ignoriert ein verschachteltes `song`-Objekt und stuft den Punkt dann
 * **unwiderruflich auf `text` herab** – die Lied-Verknüpfung ist weg. Deshalb MUSS die
 * Verknüpfung als **top-level `arrangementId`** mitgeschickt werden, zusammen mit `type: 'song'`.
 */
import type { CtAgendaItem } from './ctTypes.js';

export interface AgendaItemOverrides {
  title?: string;
  note?: string;
  position?: number;
  arrangementId?: number;
  unlink?: boolean;
  responsible?: string;
  /** Neue Dauer in Sekunden (CT-Einheit); überschreibt die bestehende. */
  durationSec?: number;
}

/**
 * Baut den Schreib-Payload aus den Live-Daten des Punkts plus den gewünschten Änderungen.
 *  - `responsible` bleibt Text (Personen-Zuordnungen in ChurchTools bleiben erhalten),
 *  - `arrangementId` wird **top-level** gesetzt (siehe Modul-Kommentar),
 *  - ohne `overrides` beschreibt das Ergebnis den unveränderten Punkt (wichtig beim Umsortieren:
 *    dort wird die ganze Liste zurückgeschrieben und darf nichts nebenbei verändern).
 */
export function agendaItemWritePayload(
  it: CtAgendaItem,
  overrides: AgendaItemOverrides = {},
): Record<string, unknown> {
  // Lied-Verknüpfung: ein übergebenes arrangementId hebt den Punkt auf type 'song' an
  // (verifiziert: PUT mit type 'song' + top-level arrangementId wandelt einen text-Punkt
  // sauber um, ohne Herabstufung); sonst bleibt eine vorhandene Verknüpfung erhalten.
  // unlink=true löst die Verknüpfung wieder (verifiziert: type 'text' ohne arrangementId).
  const arrangementId = overrides.unlink
    ? undefined
    : (overrides.arrangementId ?? it.song?.arrangementId);
  const isSong = !overrides.unlink && (overrides.arrangementId !== undefined || !!it.song);
  return {
    title: overrides.title ?? it.title,
    type: isSong ? 'song' : overrides.unlink ? 'text' : it.type,
    note: overrides.note ?? it.note ?? '',
    duration: overrides.durationSec ?? it.duration ?? 0,
    isBeforeEvent: it.isBeforeEvent ?? false,
    // responsible ist ein Textfeld; ChurchTools löst Dienst-Tokens wie „[Musik]" selbst
    // zu den im Dienstplan zugewiesenen Personen auf.
    responsible: overrides.responsible ?? it.responsible?.text ?? '',
    ...(overrides.position !== undefined ? { position: overrides.position } : {}),
    ...(arrangementId ? { arrangementId } : {}),
  };
}
