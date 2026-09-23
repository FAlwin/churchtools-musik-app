import type { NoteRolePerm, SiteConfig } from '@shared/types/index';
import { Sheet } from './Sheet';
import { Spinner } from './Spinner';
import { Icon } from './icons';
import { LinksManager } from './LinksManager';
import { TerminArtenManager } from './TerminArtenManager';
import { useGroupRoles } from '../hooks/useSiteConfig';
import type { Verwaltung } from '../hooks/useVerwaltung';
import styles from '../pages/Settings.module.scss';

interface VerwaltungFensterProps {
  site: SiteConfig;
  isAdmin: boolean;
  v: Verwaltung;
}

/**
 * Die Fenster der Verwaltung im Tab „Mehr" (#407: aus `pages/Settings.tsx` herausgelöst). Sie stehen
 * in der Überlagerung des `SeitenGeruest`, der Zustand kommt aus `useVerwaltung`.
 */
export function VerwaltungFenster({ site, isAdmin, v }: VerwaltungFensterProps) {
  return (
    <>
      {v.offen.org && (
        <Sheet title="Organisation / Name" onClose={v.closeOrg}>
          <input
            className={styles.orgInput}
            value={v.orgDraft}
            maxLength={80}
            onChange={(e) => v.setOrgDraft(e.target.value)}
            placeholder="z. B. Meine Gemeinde"
            autoFocus
          />
          {v.update.isError && <div className={styles.orgErr}>Speichern fehlgeschlagen.</div>}
          <button className={styles.orgSave} onClick={v.saveOrg} disabled={v.update.isPending}>
            {v.update.isPending ? <Spinner /> : 'Speichern'}
          </button>
        </Sheet>
      )}

      {v.offen.links && (
        <Sheet title="Links verwalten" onClose={v.closeLinks}>
          <LinksManager site={site} onClose={v.closeLinks} />
        </Sheet>
      )}

      {v.offen.terminArten && (
        <Sheet title="Termin-Arten" onClose={v.closeTerminArten}>
          <p className={styles.sheetHint}>
            Im Tab „Abwesenheiten" lassen sich Termine nach Art filtern – etwa nur Gottesdienste.
            Eine Art hat einen <strong>Namen</strong> (der Knopf) und ein <strong>Suchwort</strong>:
            Kommt es im Terminnamen vor, gehört der Termin dazu. Geprüft wird von oben nach unten,
            die erste passende Art gewinnt; alles Übrige landet unter „Sonstige". Ohne Arten gibt es
            keinen Filter.
          </p>
          <TerminArtenManager site={site} onClose={v.closeTerminArten} />
        </Sheet>
      )}

      {v.offen.notes && (
        <Sheet title="Anmerkungen" onClose={v.closeNotes} cancelLabel="Schließen">
          <p className={styles.sheetHint}>
            Team-Anmerkungen sind für alle Musiker sichtbar. Lege zuerst die{' '}
            <strong>Gruppen</strong> fest, deren Mitglieder infrage kommen, und danach je Gruppe die{' '}
            <strong>Rollen</strong>, die Team-Anmerkungen sehen bzw. verwalten dürfen. Ohne
            freigegebene Rolle darf niemand – alle behalten dann nur ihre <strong>privaten</strong>{' '}
            Anmerkungen.
          </p>
          <div className={styles.cardList}>
            <button className={`${styles.setRow} ${styles.tappable}`} onClick={v.openGroups}>
              <span className={styles.setLabel}>Gruppen-Zuweisung</span>
              <span className={styles.setValue}>
                {site.musicianGroupIds.length === 0
                  ? 'keine'
                  : `${site.musicianGroupIds.length} ${site.musicianGroupIds.length === 1 ? 'Gruppe' : 'Gruppen'}`}
              </span>
            </button>
            <button
              className={`${styles.setRow} ${styles.tappable}`}
              onClick={v.openRoles}
              disabled={site.musicianGroupIds.length === 0}
            >
              <span className={styles.setLabel}>Rollen-Zuweisung</span>
              <span className={styles.setValue}>
                {site.musicianGroupIds.length === 0
                  ? 'erst Gruppen wählen'
                  : `${(site.noteRoles ?? []).length} konfiguriert`}
              </span>
            </button>
          </div>
        </Sheet>
      )}

      {v.offen.groups && (
        <Sheet
          title="Gruppen-Zuweisung"
          onClose={v.closeGroups}
          cancelLabel={v.groupsDirty ? 'Abbrechen' : 'Schließen'}
        >
          <p className={styles.sheetHint}>
            Welche ChurchTools-Gruppen kommen für Team-Anmerkungen infrage? Die genauen Rechte legst
            du danach unter <strong>Rollen-Zuweisung</strong> je Gruppe fest.
          </p>
          {v.groupsQuery.isLoading && <Spinner />}
          {v.groupsQuery.isError && (
            <div className={styles.orgErr}>Gruppen konnten nicht geladen werden.</div>
          )}
          {v.groupsQuery.data && (
            <>
              <div className={styles.cardList}>
                {v.groupsQuery.data.map((g) => {
                  const checked = v.groupDraft.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      className={`${styles.setRow} ${styles.tappable}`}
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => v.toggleGroup(g.id)}
                    >
                      <span className={styles.setLabel}>{g.name}</span>
                      <span
                        className={`${styles.checkbox}${checked ? ' ' + styles.checkboxOn : ''}`}
                      >
                        {checked && <Icon name="check" size={14} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              {v.update.isError && <div className={styles.orgErr}>Speichern fehlgeschlagen.</div>}
              {v.groupsDirty && (
                <button
                  className={styles.orgSave}
                  onClick={v.saveGroups}
                  disabled={v.update.isPending}
                >
                  {v.update.isPending ? (
                    <Spinner />
                  ) : v.groupDraft.length === 0 ? (
                    'Speichern (Funktion aus)'
                  ) : (
                    `Speichern (${v.groupDraft.length} ${v.groupDraft.length === 1 ? 'Gruppe' : 'Gruppen'})`
                  )}
                </button>
              )}
            </>
          )}
        </Sheet>
      )}

      {v.offen.roles && (
        <Sheet
          title="Rollen-Zuweisung"
          onClose={v.closeRoles}
          cancelLabel={v.rolesDirty ? 'Abbrechen' : 'Schließen'}
        >
          <p className={styles.sheetHint}>
            Hake je Gruppe an, welche Rollen <strong>Team-Notizen</strong> nutzen dürfen (eigene
            Anmerkungen teilen und geteilte Anmerkungen anderer ansehen). Nichts angehakt = niemand.
          </p>
          {site.musicianGroupIds.map((gid) => (
            <NoteRoleGroup
              key={gid}
              groupId={gid}
              groupName={v.groupsQuery.data?.find((g) => g.id === gid)?.name ?? `Gruppe ${gid}`}
              enabled={isAdmin}
              perm={v.rolesDraft.find((r) => r.groupId === gid)}
              onChange={(roles) => v.setGroupRoles(gid, roles)}
            />
          ))}
          {v.update.isError && <div className={styles.orgErr}>Speichern fehlgeschlagen.</div>}
          {v.rolesDirty && (
            <button className={styles.orgSave} onClick={v.saveRoles} disabled={v.update.isPending}>
              {v.update.isPending ? <Spinner /> : 'Speichern'}
            </button>
          )}
        </Sheet>
      )}
    </>
  );
}

/** Rollen-Liste einer Gruppe für die Rollen-Zuweisung (Team-Notizen nutzen: ja/nein je Rolle). */
function NoteRoleGroup({
  groupId,
  groupName,
  enabled,
  perm,
  onChange,
}: {
  groupId: number;
  groupName: string;
  enabled: boolean;
  perm: NoteRolePerm | undefined;
  onChange: (roles: number[]) => void;
}) {
  const rolesQuery = useGroupRoles(groupId, enabled);
  const roles = perm?.roles ?? [];

  function toggleRole(roleId: number) {
    onChange(roles.includes(roleId) ? roles.filter((x) => x !== roleId) : [...roles, roleId]);
  }

  return (
    <div className={styles.roleGroup}>
      <div className={styles.groupHdr}>{groupName}</div>
      {rolesQuery.isLoading && <Spinner />}
      {rolesQuery.isError && <div className={styles.orgErr}>Rollen nicht ladbar.</div>}
      {rolesQuery.data && (
        <div className={styles.cardList}>
          {rolesQuery.data.map((role) => {
            const checked = roles.includes(role.id);
            return (
              <button
                key={role.id}
                className={`${styles.setRow} ${styles.tappable}`}
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggleRole(role.id)}
              >
                <span className={styles.setLabel}>{role.name}</span>
                <span className={`${styles.checkbox}${checked ? ' ' + styles.checkboxOn : ''}`}>
                  {checked && <Icon name="check" size={14} />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
