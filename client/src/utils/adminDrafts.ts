import type { NoteRolePerm } from '@shared/types/index';

/**
 * Vergleiche für die Verwaltungs-Entwürfe (#251 – vorher inline in `pages/Settings.tsx`).
 *
 * Sie entscheiden, ob „Speichern" erscheint und ob der Fuß-Knopf „Abbrechen" (verwerfen) oder nur
 * „Schließen" heißt. Beide müssen **reihenfolgeunabhängig** sein: Die Auswahl entsteht durch
 * Antippen, die Reihenfolge sagt also nichts aus. Ein reihenfolge-abhängiger Vergleich hätte einen
 * Entwurf als geändert gemeldet, obwohl inhaltlich alles gleich ist – der Nutzer bekäme dann eine
 * Verwerfen-Warnung für nichts.
 */

/** Gleiche Menge von IDs, unabhängig von der Reihenfolge? */
export function sameIdSet(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

/**
 * Gleiche Rollen-Freigaben? Gruppen **ohne** Rollen zählen dabei als nicht vorhanden – im Entwurf
 * bleibt beim Abwählen der letzten Rolle sonst ein leerer Eintrag zurück, der als „geändert" gälte.
 */
export function sameRolePerms(a: readonly NoteRolePerm[], b: readonly NoteRolePerm[]): boolean {
  const norm = (rs: readonly NoteRolePerm[]): string =>
    JSON.stringify(
      [...rs]
        .filter((r) => r.roles.length > 0)
        .sort((x, y) => x.groupId - y.groupId)
        .map((r) => ({ g: r.groupId, roles: [...r.roles].sort((x, y) => x - y) })),
    );
  return norm(a) === norm(b);
}
