import { useState } from 'react';
import type { SiteConfig } from '@shared/types/index';
import type { Theme, ThemePref } from '../types/index';
import { SeitenGeruest } from '../components/SeitenGeruest';
import { Segment } from '../components/Segment';
import { Icon } from '../components/icons';
import { SupportBox } from '../components/SupportBox';
import { SchalterZeile } from '../components/SchalterZeile';
import { InstallierenHinweis } from '../components/InstallierenHinweis';
import { VerwaltungZeilen } from '../components/VerwaltungZeilen';
import { VerwaltungFenster } from '../components/VerwaltungFenster';
import { VersionsFuss } from '../components/VersionsFuss';
import { useVerwaltung } from '../hooks/useVerwaltung';
import { useSharing } from '../hooks/useSharing';
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
  /** Darf Team-Notizen nutzen (teilen + ansehen)? Blendet den Teilen-Schalter ein. */
  canUseGlobalNotes?: boolean;
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

/**
 * „Mehr"-Tab: Profil, Installieren, Darstellung, Display-Sperre, Offline, Links, Team-Notizen,
 * Verwaltung (Admin), Hilfe, Abmelden.
 *
 * **Nur noch Zusammensetzung** (#407, 23.09.2026). Bis dahin stand alles in dieser einen Datei (623
 * Zeilen, zwölf Zustände, sechs Fenster). Jetzt tragen die Bausteine ihren Zustand selbst:
 * `InstallierenHinweis`, `VersionsFuss`, und die Verwaltung über `useVerwaltung` mit
 * `VerwaltungZeilen` (im Inhalt) und `VerwaltungFenster` (in der Überlagerung). Was die Seite tut,
 * halten die Tests in `Settings.test.tsx` fest – geschrieben und grün VOR dem Aufteilen.
 */
export function Settings({
  site,
  theme,
  themePref,
  setThemePref,
  wakePref,
  onToggleWake,
  isAdmin,
  canUseGlobalNotes = false,
  userName,
  onLogout,
  onReplayIntro,
}: SettingsProps) {
  const verwaltung = useVerwaltung(site, isAdmin);
  const [autoOffline, setAutoOffline] = useState(isOfflineAutoEnabled());
  function toggleAutoOffline() {
    const v = !autoOffline;
    setAutoOffline(v);
    setOfflineAutoEnabled(v);
  }
  // Eigenes Teilen der Anmerkungen: Zustandsmaschine im Hook (#276) – ein vorübergehender Fehler
  // darf hier nicht als „teilt nicht" erscheinen, siehe `useSharing`.
  const {
    enabled: sharing,
    error: sharingError,
    toggle: toggleSharing,
  } = useSharing(canUseGlobalNotes);
  const logo = theme === 'dark' ? '/logo-rund-dunkel.png' : '/logo-rund-hell.png';

  return (
    <SeitenGeruest
      titel="Mehr"
      ueberlagerung={<VerwaltungFenster site={site} isAdmin={isAdmin} v={verwaltung} />}
    >
      {/* Profil */}
      <div className={styles.profileCard}>
        <img className={styles.profileLogo} src={logo} alt="" />
        <div>
          <div className={styles.profileName}>{site.orgName}</div>
          {userName && <div className={styles.profileSub}>Angemeldet als {userName}</div>}
        </div>
      </div>

      <InstallierenHinweis />

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
          <SchalterZeile label="Display aktiv halten" an={wakePref} onUmschalten={onToggleWake} />
        </div>
      </div>

      {/* Offline-Reserve */}
      <div className={styles.group}>
        <div className={styles.groupHdr}>Offline</div>
        <div className={styles.cardList}>
          <SchalterZeile
            label="Kommende Gottesdienste offline halten"
            an={autoOffline}
            onUmschalten={toggleAutoOffline}
          />
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

      {/* Team-Notizen: eigenes Teilen (nur für berechtigte Teammitglieder sichtbar) */}
      {canUseGlobalNotes && (
        <div className={styles.group}>
          <div className={styles.groupHdr}>Team-Notizen</div>
          <div className={styles.cardList}>
            <SchalterZeile
              label="Meine Anmerkungen teilen"
              an={Boolean(sharing)}
              onUmschalten={toggleSharing}
            />
            {sharingError && <p className={styles.sharingError}>{sharingError}</p>}
            <p className={styles.installHint}>
              Berechtigte Teammitglieder können deine Anmerkungen dann im Lied unter „Notizen von …"
              ansehen und übernehmen.
            </p>
          </div>
        </div>
      )}

      {isAdmin && <VerwaltungZeilen site={site} v={verwaltung} />}

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

      <VersionsFuss />
    </SeitenGeruest>
  );
}
