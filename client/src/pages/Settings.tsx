import { useState } from 'react';
import type { SiteConfig } from '@shared/types/index';
import type { Theme, ThemePref } from '../types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar } from '../components/NavBar';
import { Sheet } from '../components/Sheet';
import { Spinner } from '../components/Spinner';
import { Icon } from '../components/icons';
import { useUpdateSiteConfig } from '../hooks/useSiteConfig';
import styles from './Settings.module.scss';

interface SettingsProps {
  site: SiteConfig;
  theme: Theme;
  themePref: ThemePref;
  setThemePref: (t: ThemePref) => void;
  wakePref: boolean;
  onToggleWake: () => void;
  isAdmin: boolean;
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
  onLogout,
}: SettingsProps) {
  const [showOrg, setShowOrg] = useState(false);
  const [orgDraft, setOrgDraft] = useState(site.orgName);
  const update = useUpdateSiteConfig();
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
            <div className={styles.profileSub}>Worship-Team</div>
          </div>
        </div>

        {/* Darstellung */}
        <div className={styles.group}>
          <div className={styles.groupHdr}>Darstellung</div>
          <div className={styles.cardList}>
            <div className={styles.setRow}>
              <span className={styles.setLabel}>Erscheinungsbild</span>
              <div className={styles.seg}>
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`${styles.segBtn}${themePref === opt.value ? ' ' + styles.on : ''}`}
                    onClick={() => setThemePref(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
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

        <div className={styles.version}>Churchtools Musik App · v2.0</div>
      </Scroll>

      {showOrg && (
        <Sheet title="Organisation / Name" onClose={() => setShowOrg(false)}>
          <input
            className={styles.orgInput}
            value={orgDraft}
            maxLength={80}
            onChange={(e) => setOrgDraft(e.target.value)}
            placeholder="z. B. ECG Donrath"
            autoFocus
          />
          {update.isError && <div className={styles.orgErr}>Speichern fehlgeschlagen.</div>}
          <button className={styles.orgSave} onClick={saveOrg} disabled={update.isPending}>
            {update.isPending ? <Spinner /> : 'Speichern'}
          </button>
        </Sheet>
      )}
    </Screen>
  );
}
