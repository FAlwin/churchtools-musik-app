import { useRef, useState } from 'react';
import type { SiteConfig } from '@shared/types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar, IconButton } from '../components/NavBar';
import { Spinner } from '../components/Spinner';
import { useUpdateSiteConfig } from '../hooks/useSiteConfig';
import styles from './Settings.module.scss';

interface SettingsProps {
  /** Aktuelles Branding (Startwerte des Formulars). */
  site: SiteConfig;
  onBack: () => void;
}

/** Logo-Grenzen, gespiegelt zur Server-Validierung. */
const MAX_LOGO_BYTES = 1024 * 1024; // ~1 MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

/** Branding-Einstellungen (nur Admin): Name, Logo, Farben, CCLI – per Klick. */
export function Settings({ site, onBack }: SettingsProps) {
  const [form, setForm] = useState<SiteConfig>(site);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const update = useUpdateSiteConfig();

  function set<K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      setLogoError('Nur PNG, JPEG, WebP oder SVG.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('Logo ist zu groß (max. 1 MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set('logoDataUrl', reader.result as string);
    reader.readAsDataURL(file);
  }

  function save() {
    update.mutate({
      ...form,
      appName: form.appName.trim(),
      shortName: form.shortName.trim(),
      orgName: form.orgName.trim(),
      ccli: form.ccli?.trim() ? form.ccli.trim() : null,
    });
  }

  const logoSrc = form.logoDataUrl ?? '/logo.png';

  return (
    <Screen>
      <NavBar
        title="Branding"
        subtitle="Erscheinungsbild dieser Gemeinde"
        left={
          <IconButton onClick={onBack} title="Zurück" style={{ fontSize: 20 }}>
            ‹
          </IconButton>
        }
      />
      <Scroll>
        <div className={styles.wrap}>
          {/* Vorschau */}
          <div className={styles.preview} style={{ background: form.primaryColor }}>
            <img className={styles.previewLogo} src={logoSrc} alt="" />
            <div className={styles.previewName}>{form.appName || 'App-Name'}</div>
            <div className={styles.previewOrg}>{form.orgName || 'Gemeinde'}</div>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>App-Name</span>
            <input
              className={styles.input}
              value={form.appName}
              maxLength={60}
              onChange={(e) => set('appName', e.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Kurzname (Home-Bildschirm)</span>
            <input
              className={styles.input}
              value={form.shortName}
              maxLength={30}
              onChange={(e) => set('shortName', e.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Gemeinde / Organisation</span>
            <input
              className={styles.input}
              value={form.orgName}
              maxLength={80}
              onChange={(e) => set('orgName', e.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Beschreibung</span>
            <input
              className={styles.input}
              value={form.description}
              maxLength={120}
              onChange={(e) => set('description', e.target.value)}
            />
          </label>

          <div className={styles.field}>
            <span className={styles.label}>Logo</span>
            <div className={styles.logoRow}>
              <img className={styles.logoThumb} src={logoSrc} alt="" />
              <div className={styles.logoBtns}>
                <button className={styles.btnGhost} onClick={() => fileRef.current?.click()}>
                  Logo wählen…
                </button>
                {form.logoDataUrl && (
                  <button className={styles.btnGhost} onClick={() => set('logoDataUrl', null)}>
                    Zurücksetzen
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept={ALLOWED.join(',')}
                style={{ display: 'none' }}
                onChange={onPickLogo}
              />
            </div>
            {logoError && <span className={styles.err}>{logoError}</span>}
          </div>

          <div className={styles.colorsRow}>
            <label className={styles.field}>
              <span className={styles.label}>Hauptfarbe</span>
              <input
                className={styles.color}
                type="color"
                value={form.primaryColor}
                onChange={(e) => set('primaryColor', e.target.value.toUpperCase())}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Akkordfarbe</span>
              <input
                className={styles.color}
                type="color"
                value={form.accentColor}
                onChange={(e) => set('accentColor', e.target.value.toUpperCase())}
              />
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>CCLI-Lizenznummer</span>
            <input
              className={styles.input}
              value={form.ccli ?? ''}
              maxLength={30}
              placeholder="z. B. 2395145"
              onChange={(e) => set('ccli', e.target.value)}
            />
          </label>

          {update.isError && (
            <div className={styles.err}>
              {update.error instanceof Error ? update.error.message : 'Speichern fehlgeschlagen.'}
            </div>
          )}
          {update.isSuccess && <div className={styles.ok}>Gespeichert ✓</div>}

          <button className={styles.save} onClick={save} disabled={update.isPending}>
            {update.isPending ? <Spinner /> : 'Speichern'}
          </button>
        </div>
      </Scroll>
    </Screen>
  );
}
