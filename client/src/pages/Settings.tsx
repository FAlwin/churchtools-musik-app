import { useEffect, useState } from 'react';
import type { SiteConfig } from '@shared/types/index';
import type { Theme, ThemePref } from '../types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar } from '../components/NavBar';
import { Sheet } from '../components/Sheet';
import { Spinner } from '../components/Spinner';
import { Segment } from '../components/Segment';
import { Icon } from '../components/icons';
import { LinksManager } from '../components/LinksManager';
import { SupportBox } from '../components/SupportBox';
import { useUpdateSiteConfig, useGroups } from '../hooks/useSiteConfig';
import { useUpdateCheck } from '../hooks/useUpdateCheck';
import { getOfflineStatus } from '../queryClient';
import { isOfflineAutoEnabled, setOfflineAutoEnabled } from '../services/offlineAuto';
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
  const [showMusicianGroup, setShowMusicianGroup] = useState(false);
  // Entwurf der Gruppen-Auswahl im Sheet (erst „Speichern" persistiert – Mehrfachauswahl).
  const [groupDraft, setGroupDraft] = useState<number[]>([]);
  const [orgDraft, setOrgDraft] = useState(site.orgName);
  const update = useUpdateSiteConfig();
  // Gruppen nur laden, wenn ein Admin im Mehr-Tab ist (für Anzeige + Auswahl der Musiker-Gruppen).
  const groupsQuery = useGroups(isAdmin);

  function openMusicianGroup() {
    setGroupDraft(site.musicianGroupIds);
    setShowMusicianGroup(true);
  }
  function toggleGroup(id: number) {
    setGroupDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  }
  function saveMusicianGroups() {
    update.mutate(
      { ...site, musicianGroupIds: groupDraft },
      { onSuccess: () => setShowMusicianGroup(false) },
    );
  }
  const updateCheck = useUpdateCheck();
  const [offline, setOffline] = useState<{
    files: number;
    records: number;
    savedAt: number | null;
  } | null>(null);
  const [autoOffline, setAutoOffline] = useState(isOfflineAutoEnabled());
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
              <button className={`${styles.setRow} ${styles.tappable}`} onClick={openMusicianGroup}>
                <span className={styles.setLabel}>Musiker-Gruppen (Anmerkungen)</span>
                <span className={styles.setValue}>
                  {site.musicianGroupIds.length === 0
                    ? 'keine'
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

      {showMusicianGroup && (
        <Sheet title="Musiker-Gruppen" onClose={() => setShowMusicianGroup(false)}>
          <p className={styles.sheetHint}>
            Mitglieder der ausgewählten ChurchTools-Gruppen können Anmerkungen{' '}
            <strong>für das ganze Team</strong> sichtbar machen und sehen (Mitgliedschaft in{' '}
            <strong>einer</strong> Gruppe genügt). Alle anderen haben weiterhin nur ihre{' '}
            <strong>privaten</strong> Anmerkungen. Ohne Auswahl ist die Funktion aus.
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
              <button
                className={styles.orgSave}
                onClick={saveMusicianGroups}
                disabled={update.isPending}
              >
                {update.isPending ? (
                  <Spinner />
                ) : groupDraft.length === 0 ? (
                  'Speichern (Funktion aus)'
                ) : (
                  `Speichern (${groupDraft.length} ${groupDraft.length === 1 ? 'Gruppe' : 'Gruppen'})`
                )}
              </button>
            </>
          )}
        </Sheet>
      )}
    </Screen>
  );
}
