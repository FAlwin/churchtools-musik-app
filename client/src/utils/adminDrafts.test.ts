import { describe, it, expect } from 'vitest';
import { sameIdSet, sameRolePerms } from './adminDrafts';

/**
 * #251: Diese beiden Vergleiche entstanden bei jedem Render neu in `pages/Settings.tsx` und waren
 * ungetestet. Sie entscheiden, ob „Speichern" erscheint und ob beim Schließen eine Verwerfen-Warnung
 * kommt – ein falsches „geändert" nervt den Admin bei jedem Öffnen.
 */
describe('sameIdSet – Gruppen-Auswahl', () => {
  it('gleiche Mengen sind gleich, egal in welcher Reihenfolge angetippt', () => {
    // Die Reihenfolge entsteht durchs Antippen und sagt nichts aus.
    expect(sameIdSet([3, 1, 2], [2, 3, 1])).toBe(true);
  });

  it('unterschiedliche Länge ist verschieden', () => {
    expect(sameIdSet([1, 2], [1, 2, 3])).toBe(false);
  });

  it('gleiche Länge, andere IDs ist verschieden', () => {
    expect(sameIdSet([1, 2], [1, 3])).toBe(false);
  });

  it('zwei leere Auswahlen sind gleich', () => {
    expect(sameIdSet([], [])).toBe(true);
  });

  it('vergleicht ohne die Eingaben zu verändern', () => {
    const a = [3, 1];
    const b = [1, 3];
    sameIdSet(a, b);
    expect(a).toEqual([3, 1]); // nicht in-place sortiert
    expect(b).toEqual([1, 3]);
  });
});

describe('sameRolePerms – Rollen-Freigaben', () => {
  const perm = (groupId: number, roles: number[]) => ({ groupId, roles });

  it('Reihenfolge der Gruppen UND der Rollen ist unerheblich', () => {
    expect(sameRolePerms([perm(2, [9, 8]), perm(1, [5])], [perm(1, [5]), perm(2, [8, 9])])).toBe(
      true,
    );
  });

  it('eine Gruppe OHNE Rollen zählt als nicht vorhanden', () => {
    // Beim Abwählen der letzten Rolle bleibt im Entwurf ein leerer Eintrag zurück – der darf den
    // Entwurf nicht als „geändert" melden.
    expect(sameRolePerms([perm(1, [5]), perm(2, [])], [perm(1, [5])])).toBe(true);
  });

  it('eine zusätzliche Rolle ist eine echte Änderung', () => {
    expect(sameRolePerms([perm(1, [5, 6])], [perm(1, [5])])).toBe(false);
  });

  it('dieselbe Rolle in einer ANDEREN Gruppe ist eine Änderung', () => {
    expect(sameRolePerms([perm(1, [5])], [perm(2, [5])])).toBe(false);
  });

  it('zwei leere Freigaben sind gleich', () => {
    expect(sameRolePerms([], [])).toBe(true);
    expect(sameRolePerms([perm(1, [])], [])).toBe(true);
  });
});
