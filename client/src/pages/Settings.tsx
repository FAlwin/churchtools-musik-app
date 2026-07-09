import { useEffect, useState } from 'react';
import type { SiteConfig, NoteRolePerm } from '@shared/types/index';
import type { Theme, ThemePref } from '../types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar } from '../components/NavBar';
import { Sheet } from '../components/Sheet';
import { Spinner } from '../components/Spinner';
import { Segment } from '../components/Segment';
import { Icon } from '../components/icons';
import { LinksManager } from '../components/LinksManager';
import { SupportBox } from '../components/SupportBox';
import { useUpdateSiteConfig, useGroups, useGroupRoles } from '../hooks/useSiteConfig';
import { useUpdateCheck } from '../hooks/useUpdateCheck';
import { getOfflineStatus } from '../queryClient';
import { isOfflineAutoEnabled, setOfflineAutoEnabled } from '../services/offlineAuto';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { promptInstall } from '../services/pwaInstall';
import styles from './Settings.module.scss';

interface SettingsProps {
  site: SiteConfig;
  theme: Theme;
  themePref: ThemePref;
  setThemePref: (t: ThemePref) => void;
  wakePref: boolean;
  onToggleWake: () => void;
  isAdmin: boolean;
  /** Name des angemeldeten ChurchTools-Kontos (für die Profilkarte). */
  userName?: string;
  onLogout: () => void;
  /** Startet die geführte Einführung erneut. */
  onReplayIntro: () => void;
}

const THEME_OPTIONS: { value: ThemePref; label: string; icon: 'sun' | 'moon' | 'cog' }[] = [
  { value: 'light', label: 'Hell', icon: 'sun' },
  { value: 'dark', label: 'Dunkel', icon: 'moon' },
  { value: 'system', label: 'Auto', icon: 'cog' },
];

/** „Mehr"-Tab: Profil, Darstellung, Display-Sperre, Organisation (Admin), Abmelden. */
export function Settings({
  site,
  theme,
  themePref,
  setThemePref,
  wakePref,
  onToggleWake,
  isAdmin,
  userName,
  onLogout,
  onReplayIntro,
}: SettingsProps) {
  const [showOrg, setShowOrg] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
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
  // Ungespeicherte Änderungen? Steuert, ob „Speichern" erscheint und der Fuß-Knopf
  // „Abbrechen" (verwerfen) oder nur „Schließen" heißt.
  const sameIds = (a: number[], b: number[]) => {
    if (a.length !== b.length) return false;
    const sb = [...b].sort((x, y) => x - y);
    return [...a].sort((x, y) => x - y).every((v, i) => v === sb[i]);
  };
  const groupsDirty = showGroups && !sameIds(groupDraft, site.musicianGroupIds);
  const normRoles = (rs: NoteRolePerm[]) =>
    JSON.stringify(
      [...rs]
        .filter((r) => r.view.length || r.manage.length)
        .sort((a, b) => a.groupId - b.groupId)
        .map((r) => ({ g: r.groupId, v: [...r.view].sort(), m: [...r.manage].sort() })),
    );
  const rolesDirty = showRoles && normRoles(rolesDraft) !== normRoles(site.noteRoles ?? []);
  /** Rollen-Freigabe einer Gruppe im Entwurf ändern (view/manage), leere Einträge fallen weg. */
  function setGroupRoles(groupId: number, view: number[], manage: number[]) {
    setRolesDraft((prev) => {
      const rest = prev.filter((r) => r.groupId !== groupId);
      if (view.length === 0 && manage.length === 0) return rest;
      return [...rest, { groupId, view, manage }];
    });
  }
  function saveRoles() {
    update.mutate(
      { ...site, noteRoles: rolesDraft },
      { onSuccess: () => setShowRoles(false) },
    );
  }
  const updateCheck = useUpdateCheck();
  const [offline, setOffline] = useState<{
    files: number;
    records: number;
    savedAt: number | null;
  } | null>(null);
  const [autoOffline, setAutoOffline] = useState(isOfflineAutoEnabled());
  const pwa = usePwaInstall();
  useEffect(() => {
    void getOfflineStatus().then(setOffline);
  }, []);
  function toggleAutoOffline() {
    const v = !autoOffline;
    setAutoOffline(v);
    setOfflineAutoEnabled(v);
  }
  const logo = theme === 'dark' ? '/logo-rund-dunkel.png' : '/logo-rund-hell.png';

  function saveOrg() {
    update.mutate(
      { ...site, orgName: orgDraft.trim() || site.orgName },
      { onSuccess: () => setShowOrg(false) },
    );
  }

  return (
    <Screen>
      <NavBar title="Mehr" />
      <Scroll>
        {/* Profil */}
        <div className={styles.profileCard}>
          <img className={styles.profileLogo} src={logo} alt="" />
          <div>
            <div className={styles.profileName}>{site.orgName}</div>
            {userName && <div className={styles.profileSub}>Angemeldet als {userName}</div>}
          </div>
        </div>

        {/* Als App installieren – nur solange die App NICHT bereits als PWA läuft */}
        {!pwa.standalone && (
          <div className={styles.group}>
            <div className={styles.groupHdr}>Als App installieren</div>
            <div className={styles.cardList}>
              {pwa.canPrompt ? (
                // Chrome/Edge (Android + Desktop, HTTPS): echter Installations-Dialog
                <button
                  className={`${styles.setRow} ${styles.tappable}`}
                  onClick={() => void promptInstall()}
                >
                  <span className={styles.setLabel}>Auf dem Startbildschirm installieren</span>
                  <Icon name="download" size={18} className={styles.extIcon} />
                </button>
              ) : pwa.platform === 'ios' ? (
                // iPhone/iPad-Safari: Teilen → „Zum Home-Bildschirm"
                <p className={styles.installHint}>
                  Tippe in Safari unten auf das Teilen-Symbol{' '}
                  <Icon name="share" size={15} className={styles.hintIcon} /> und dann auf{' '}
                  <strong>„Zum Home-Bildschirm"</strong> – so liegt die App wie eine echte App auf
                  deinem Startbildschirm.
                </p>
              ) : pwa.platform === 'macSafari' ? (
                // macOS-Safari: Teilen → „Zum Dock hinzufügen"
                <p className={styles.installHint}>
                  Klicke in Safari oben auf das Teilen-Symbol{' '}
                  <Icon name="share" size={15} className={styles.hintIcon} /> und dann auf{' '}
                  <strong>„Zum Dock hinzufügen"</strong> – so liegt die App wie ein Programm im Dock.
                </p>
              ) : pwa.platform === 'android' ? (
                // Android ohne nativen Prompt (z. B. Firefox/Samsung Internet)
                <p className={styles.installHint}>
                  Öffne das Browser-Menü (<strong>⋮</strong>) und wähle{' '}
                  <Icon name="plus" size={15} className={styles.hintIcon} />{' '}
                  <strong>„App installieren"</strong> bzw.{' '}
                  <strong>„Zum Startbildschirm hinzufügen"</strong>.
                </p>
              ) : (
                // Sonstige Desktop-Browser ohne nativen Prompt (Chrome/Edge über HTTP, Firefox …)
                <p className={styles.installHint}>
                  Über das <strong>Browser-Menü</strong> kannst du die App wie ein Programm ablegen –
                  in Chrome/Edge unter <strong>„Streamen, speichern und teilen"</strong> →{' '}
                  <strong>„Seite als App installieren"</strong>, in anderen Browsern über{' '}
                  <strong>„Zum Startbildschirm hinzufügen"</strong>.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Darstellung */}
        <div className={styles.group}>
          <div className={styles.groupHdr}>Darstellung</div>
          <div className={styles.cardList}>
            <div className={styles.setRow}>
              <span className={styles.setLabel}>Erscheinungsbild</span>
              <Segment
                className={styles.themeSeg}
                value={themePref}
                options={THEME_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                onChange={setThemePref}
              />
            </div>
          </div>
        </div>

        {/* Während des Spielens */}
        <div className={styles.group}>
          <div className={styles.groupHdr}>Während des Spielens</div>
          <div className={styles.cardList}>
            <div className={`${styles.setRow} ${styles.tappable}`} onClick={onToggleWake}>
              <span className={styles.setLabel}>Display aktiv halten</span>
              <button
                className={`${styles.tog}${wakePref ? ' ' + styles.togOn : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleWake();
                }}
                aria-label="Display aktiv halten"
              >
                <span className={styles.togThumb} />
              </button>
            </div>
          </div>
        </div>

        {/* Offline-Reserve */}
        <div className={styles.group}>
          <div className={styles.groupHdr}>Offline</div>
          <div className={styles.cardList}>
            <div className={`${styles.setRow} ${styles.tappable}`} onClick={toggleAutoOffline}>
              <span className={styles.setLabel}>Kommende Gottesdienste offline halten</span>
              <button
                className={`${styles.tog}${autoOffline ? ' ' + styles.togOn : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAutoOffline();
                }}
                aria-label="Kommende Gottesdienste offline halten"
              >
                <span className={styles.togThumb} />
              </button>
            </div>
          </div>
        </div>

        {/* Weitere Angebote: frei konfigurierbare externe Links (für alle sichtbar) */}
        {site.links.length > 0 && (
          <div className={styles.group}>
            <div className={styles.groupHdr}>Weitere Angebote</div>
            <div className={styles.cardList}>
              {site.links.map((link) => (
                <a
                  key={link.id}
                  className={`${styles.setRow} ${styles.tappable} ${styles.linkRow}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className={styles.setLabel}>{link.label}</span>
                  <Icon name="external" size={18} className={styles.extIcon} />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Organisation (nur Admin) */}
        {isAdmin && (
          <div className={styles.group}>
            <div className={styles.groupHdr}>Verwaltung</div>
            <div className={styles.cardList}>
              <button
                className={`${styles.setRow} ${styles.tappable}`}
                onClick={() => {
                  setOrgDraft(site.orgName);
                  setShowOrg(true);
                }}
              >
                <span className={styles.setLabel}>Organisation / Name</span>
                <span className={styles.setValue}>{site.orgName}</span>
              </button>
              <button
                className={`${styles.setRow} ${styles.tappable}`}
                onClick={() => setShowLinks(true)}
              >
                <span className={styles.setLabel}>Links verwalten</span>
                <span className={styles.setValue}>
                  {site.links.length === 0
                    ? 'keine'
                    : `${site.links.length} ${site.links.length === 1 ? 'Link' : 'Links'}`}
                </span>
              </button>
              <button
                className={`${styles.setRow} ${styles.tappable}`}
                onClick={() => setShowNotes(true)}
              >
                <span className={styles.setLabel}>Anmerkungen</span>
                <span className={styles.setValue}>
                  {site.musicianGroupIds.length === 0
                    ? 'aus'
                    : `${site.musicianGroupIds.length} ${site.musicianGroupIds.length === 1 ? 'Gruppe' : 'Gruppen'}`}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Hilfe */}
        <div className={styles.group}>
          <div className={styles.groupHdr}>Hilfe</div>
          <div className={styles.cardList}>
            <button className={`${styles.setRow} ${styles.tappable}`} onClick={onReplayIntro}>
              <span className={styles.setLabel}>Einführung nochmal ansehen</span>
              <Icon name="chev-right" size={18} className={styles.extIcon} />
            </button>
          </div>
        </div>

        {/* Konto */}
        <div className={styles.group}>
          <div className={styles.cardList}>
            <button className={`${styles.setRow} ${styles.tappable}`} onClick={onLogout}>
              <span className={`${styles.setLabel} ${styles.danger}`}>Abmelden</span>
              <Icon name="logout" size={18} className={styles.dangerIcon} />
            </button>
          </div>
        </div>

        {/* Freiwillige Unterstützung – dezent, ganz unten */}
        <SupportBox />

        <div className={styles.version}>
          Churchtools Musik App · {import.meta.env.VITE_APP_VERSION || 'dev'}
          {updateCheck.available && updateCheck.latest && (
            <a
              className={styles.updateNote}
              href={updateCheck.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              Neue Version {updateCheck.latest} verfügbar – Was ist neu
            </a>
          )}
          {offline && (offline.records > 0 || offline.files > 0) && (
            <div className={styles.offlineStat}>
              Offline verfügbar: {offline.records} Datensätze · {offline.files} Dateien
            </div>
          )}
        </div>
      </Scroll>

      {showOrg && (
        <Sheet title="Organisation / Name" onClose={() => setShowOrg(false)}>
          <input
            className={styles.orgInput}
            value={orgDraft}
            maxLength={80}
            onChange={(e) => setOrgDraft(e.target.value)}
            placeholder="z. B. Meine Gemeinde"
            autoFocus
          />
          {update.isError && <div className={styles.orgErr}>Speichern fehlgeschlagen.</div>}
          <button className={styles.orgSave} onClick={saveOrg} disabled={update.isPending}>
            {update.isPending ? <Spinner /> : 'Speichern'}
          </button>
        </Sheet>
      )}

      {showLinks && (
        <Sheet title="Links verwalten" onClose={() => setShowLinks(false)}>
          <LinksManager site={site} onClose={() => setShowLinks(false)} />
        </Sheet>
      )}

      {showNotes && (
        <Sheet title="Anmerkungen" onClose={() => setShowNotes(false)} cancelLabel="Schließen">
          <p className={styles.sheetHint}>
            Team-Anmerkungen sind für alle Musiker sichtbar. Lege zuerst die <strong>Gruppen</strong>{' '}
            fest, deren Mitglieder infrage kommen, und danach je Gruppe die <strong>Rollen</strong>,
            die Team-Anmerkungen sehen bzw. verwalten dürfen. Ohne freigegebene Rolle darf niemand –
            alle behalten dann nur ihre <strong>privaten</strong> Anmerkungen.
          </p>
          <div className={styles.cardList}>
            <button className={`${styles.setRow} ${styles.tappable}`} onClick={openGroups}>
              <span className={styles.setLabel}>Gruppen-Zuweisung</span>
              <span className={styles.setValue}>
                {site.musicianGroupIds.length === 0
                  ? 'keine'
                  : `${site.musicianGroupIds.length} ${site.musicianGroupIds.length === 1 ? 'Gruppe' : 'Gruppen'}`}
              </span>
            </button>
            <button
              className={`${styles.setRow} ${styles.tappable}`}
              onClick={openRoles}
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

      {showGroups && (
        <Sheet
          title="Gruppen-Zuweisung"
          onClose={() => setShowGroups(false)}
          cancelLabel={groupsDirty ? 'Abbrechen' : 'Schließen'}
        >
          <p className={styles.sheetHint}>
            Welche ChurchTools-Gruppen kommen für Team-Anmerkungen infrage? Die genauen Rechte legst
            du danach unter <strong>Rollen-Zuweisung</strong> je Gruppe fest.
          </p>
          {groupsQuery.isLoading && <Spinner />}
          {groupsQuery.isError && (
            <div className={styles.orgErr}>Gruppen konnten nicht geladen werden.</div>
          )}
          {groupsQuery.data && (
            <>
              <div className={styles.cardList}>
                {groupsQuery.data.map((g) => {
                  const checked = groupDraft.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      className={`${styles.setRow} ${styles.tappable}`}
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggleGroup(g.id)}
                    >
                      <span className={styles.setLabel}>{g.name}</span>
                      <span className={`${styles.checkbox}${checked ? ' ' + styles.checkboxOn : ''}`}>
                        {checked && <Icon name="check" size={14} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              {update.isError && <div className={styles.orgErr}>Speichern fehlgeschlagen.</div>}
              {groupsDirty && (
                <button className={styles.orgSave} onClick={saveGroups} disabled={update.isPending}>
                  {update.isPending ? (
                    <Spinner />
                  ) : groupDraft.length === 0 ? (
                    'Speichern (Funktion aus)'
                  ) : (
                    `Speichern (${groupDraft.length} ${groupDraft.length === 1 ? 'Gruppe' : 'Gruppen'})`
                  )}
                </button>
              )}
            </>
          )}
        </Sheet>
      )}

      {showRoles && (
        <Sheet
          title="Rollen-Zuweisung"
          onClose={() => setShowRoles(false)}
          cancelLabel={rolesDirty ? 'Abbrechen' : 'Schließen'}
        >
          <p className={styles.sheetHint}>
            Hake je Gruppe an, welche Rollen Team-Anmerkungen <strong>sehen</strong> und welche sie{' '}
            <strong>verwalten</strong> (erstellen/bearbeiten/löschen) dürfen. „Verwalten" schließt
            „Sehen" ein. Nichts angehakt = niemand.
          </p>
          {site.musicianGroupIds.map((gid) => (
            <NoteRoleGroup
              key={gid}
              groupId={gid}
              groupName={groupsQuery.data?.find((g) => g.id === gid)?.name ?? `Gruppe ${gid}`}
              enabled={isAdmin}
              perm={rolesDraft.find((r) => r.groupId === gid)}
              onChange={(view, manage) => setGroupRoles(gid, view, manage)}
            />
          ))}
          {update.isError && <div className={styles.orgErr}>Speichern fehlgeschlagen.</div>}
          {rolesDirty && (
            <button className={styles.orgSave} onClick={saveRoles} disabled={update.isPending}>
              {update.isPending ? <Spinner /> : 'Speichern'}
            </button>
          )}
        </Sheet>
      )}
    </Screen>
  );
}

/** Rollen-Matrix einer Gruppe (Sehen/Verwalten je Rolle) für die Rollen-Zuweisung. */
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
  onChange: (view: number[], manage: number[]) => void;
}) {
  const rolesQuery = useGroupRoles(groupId, enabled);
  const view = perm?.view ?? [];
  const manage = perm?.manage ?? [];

  function toggleView(roleId: number) {
    // „Sehen" lässt sich nicht abwählen, solange „Verwalten" an ist (Verwalten schließt Sehen ein).
    if (manage.includes(roleId)) return;
    const next = view.includes(roleId) ? view.filter((x) => x !== roleId) : [...view, roleId];
    onChange(next, manage);
  }
  function toggleManage(roleId: number) {
    const nextManage = manage.includes(roleId)
      ? manage.filter((x) => x !== roleId)
      : [...manage, roleId];
    // Beim Aktivieren „Sehen" aus der view-Liste nehmen (ist durch manage impliziert – kein Doppel).
    const nextView = view.filter((x) => x !== roleId);
    onChange(nextView, nextManage);
  }

  return (
    <div className={styles.roleGroup}>
      <div className={styles.groupHdr}>{groupName}</div>
      {rolesQuery.isLoading && <Spinner />}
      {rolesQuery.isError && <div className={styles.orgErr}>Rollen nicht ladbar.</div>}
      {rolesQuery.data && (
        <div className={styles.cardList}>
          {rolesQuery.data.map((role) => {
            const canManage = manage.includes(role.id);
            const canView = canManage || view.includes(role.id);
            return (
              <div key={role.id} className={styles.roleRow}>
                <span className={styles.setLabel}>{role.name}</span>
                <div className={styles.roleToggles}>
                  <button
                    type="button"
                    className={`${styles.roleToggle}${canView ? ' ' + styles.roleToggleOn : ''}`}
                    aria-pressed={canView}
                    onClick={() => toggleView(role.id)}
                  >
                    Sehen
                  </button>
                  <button
                    type="button"
                    className={`${styles.roleToggle}${canManage ? ' ' + styles.roleToggleOn : ''}`}
                    aria-pressed={canManage}
                    onClick={() => toggleManage(role.id)}
                  >
                    Verwalten
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
