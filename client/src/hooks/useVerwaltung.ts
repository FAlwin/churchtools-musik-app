import { useState } from 'react';
import type { NoteRolePerm, SiteConfig } from '@shared/types/index';
import { sameIdSet, sameRolePerms } from '../utils/adminDrafts';
import { useGroups, useUpdateSiteConfig } from './useSiteConfig';

/** Welches Verwaltungs-Fenster gerade offen ist – je eins, gestapelt über „Anmerkungen". */
export interface VerwaltungsFenster {
  org: boolean;
  links: boolean;
  terminArten: boolean;
  notes: boolean;
  groups: boolean;
  roles: boolean;
}

/**
 * **Der Zustand der Verwaltung im Tab „Mehr"** (#407: aus `pages/Settings.tsx` herausgelöst).
 *
 * Zeilen und Fenster brauchen denselben Zustand, stehen aber an verschiedenen Orten: die Zeilen im
 * Inhalt, die Fenster in der Überlagerung des `SeitenGeruest` (neben dem Scroll-Bereich, sonst
 * scrollten sie mit). Deshalb liegt der Zustand hier, und `VerwaltungZeilen` / `VerwaltungFenster`
 * zeigen ihn nur an.
 *
 * Bewusst **sechs getrennte Schalter** statt eines Felds „welches Fenster": „Anmerkungen" bleibt offen,
 * während darüber Gruppen oder Rollen bearbeitet werden. Und eine Zusammenlegung hat hier schon
 * einmal einen Menüpunkt stumm gemacht (05.08.2026, Reihenfolge der Setter) – beim Aufteilen blieben
 * alle Setter und ihre Reihenfolge unverändert.
 */
export function useVerwaltung(site: SiteConfig, isAdmin: boolean) {
  const [showOrg, setShowOrg] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  // Verwaltung → „Abwesenheiten: Termin-Arten" – die Knöpfe des Filters (#400).
  const [showTerminArten, setShowTerminArten] = useState(false);
  // Verwaltung → „Anmerkungen": Übersicht (showNotes) mit zwei Unter-Sheets
  // (Gruppen-Zuweisung + Rollen-Zuweisung).
  const [showNotes, setShowNotes] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  // Entwürfe (erst „Speichern" persistiert).
  const [groupDraft, setGroupDraft] = useState<number[]>([]);
  const [rolesDraft, setRolesDraft] = useState<NoteRolePerm[]>([]);
  const [orgDraft, setOrgDraft] = useState(site.orgName);
  const update = useUpdateSiteConfig();
  // Gruppen nur laden, wenn ein Admin im Mehr-Tab ist (für Anzeige + Auswahl der Gruppen-Zuweisung).
  const groupsQuery = useGroups(isAdmin);

  function openOrg() {
    setOrgDraft(site.orgName);
    setShowOrg(true);
  }
  function saveOrg() {
    update.mutate(
      { ...site, orgName: orgDraft.trim() || site.orgName },
      { onSuccess: () => setShowOrg(false) },
    );
  }

  function openGroups() {
    setGroupDraft(site.musicianGroupIds);
    setShowGroups(true);
  }
  function toggleGroup(id: number) {
    setGroupDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  }
  function saveGroups() {
    // Nicht mehr gewählte Gruppen aus den Rollen-Freigaben entfernen (der Server tut das auch).
    const kept = (site.noteRoles ?? []).filter((r) => groupDraft.includes(r.groupId));
    update.mutate(
      { ...site, musicianGroupIds: groupDraft, noteRoles: kept },
      { onSuccess: () => setShowGroups(false) },
    );
  }

  function openRoles() {
    setRolesDraft(site.noteRoles ?? []);
    setShowRoles(true);
  }
  /** Rollen-Freigabe einer Gruppe im Entwurf ändern; leere Einträge fallen weg. */
  function setGroupRoles(groupId: number, roles: number[]) {
    setRolesDraft((prev) => {
      const rest = prev.filter((r) => r.groupId !== groupId);
      if (roles.length === 0) return rest;
      return [...rest, { groupId, roles }];
    });
  }
  function saveRoles() {
    update.mutate({ ...site, noteRoles: rolesDraft }, { onSuccess: () => setShowRoles(false) });
  }

  // Ungespeicherte Änderungen? Steuert, ob „Speichern" erscheint und der Fuß-Knopf
  // „Abbrechen" (verwerfen) oder nur „Schließen" heißt.
  // Vergleiche in `utils/adminDrafts` (#251) – reihenfolgeunabhängig und dort getestet.
  const groupsDirty = showGroups && !sameIdSet(groupDraft, site.musicianGroupIds);
  const rolesDirty = showRoles && !sameRolePerms(rolesDraft, site.noteRoles ?? []);

  const offen: VerwaltungsFenster = {
    org: showOrg,
    links: showLinks,
    terminArten: showTerminArten,
    notes: showNotes,
    groups: showGroups,
    roles: showRoles,
  };

  return {
    offen,
    update,
    groupsQuery,
    orgDraft,
    setOrgDraft,
    groupDraft,
    rolesDraft,
    groupsDirty,
    rolesDirty,
    openOrg,
    saveOrg,
    closeOrg: () => setShowOrg(false),
    openLinks: () => setShowLinks(true),
    closeLinks: () => setShowLinks(false),
    openTerminArten: () => setShowTerminArten(true),
    closeTerminArten: () => setShowTerminArten(false),
    openNotes: () => setShowNotes(true),
    closeNotes: () => setShowNotes(false),
    openGroups,
    toggleGroup,
    saveGroups,
    closeGroups: () => setShowGroups(false),
    openRoles,
    setGroupRoles,
    saveRoles,
    closeRoles: () => setShowRoles(false),
  };
}

export type Verwaltung = ReturnType<typeof useVerwaltung>;
