import { useState } from 'react';
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
import { useUpdateSiteConfig } from '../hooks/useSiteConfig';
import { useUpdateCheck } from '../hooks/useUpdateCheck';
import { useSwUpdate } from '../hooks/useSwUpdate';
import styles from './Settings.module.scss';

/** Beschriftung des „Nach Updates suchen"-Knopfes je nach Zustand. */
const UPDATE_CHECK_LABEL = {
  idle: 'Nach Updates suchen',
  checking: 'Suche nach Updates…',
  updating: 'Aktualisiere…',
  'up-to-date': 'Du bist auf dem neuesten Stand',
  'update-ready': 'Neue Version bereit – unten auf „Jetzt laden" tippen',
} as const;

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
}: SettingsProps) {
  const [showOrg, setShowOrg] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [orgDraft, setOrgDraft] = useState(site.orgName);
  const update = useUpdateSiteConfig();
  const updateCheck = useUpdateCheck();
  const sw = useSwUpdate();
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
            </div>
          </div>
        )}

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
          <span>Churchtools Musik App · {import.meta.env.VITE_APP_VERSION || 'dev'}</span>
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
          <button
            className={styles.updateCheckBtn}
            onClick={sw.checkNow}
            disabled={sw.checkState === 'checking' || sw.checkState === 'updating'}
          >
            {(sw.checkState === 'checking' || sw.checkState === 'updating') && <Spinner />}
            {UPDATE_CHECK_LABEL[sw.checkState]}
          </button>
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
    </Screen>
  );
}
