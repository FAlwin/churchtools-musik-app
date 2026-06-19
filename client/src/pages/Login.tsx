import { useState } from 'react';
import type { SiteConfig } from '@shared/types/index';
import type { Theme } from '../types/index';
import { Screen } from '../components/Screen';
import { Spinner } from '../components/Spinner';
import { Icon } from '../components/icons';
import styles from './Login.module.scss';

interface LoginProps {
  /** Wird mit den Zugangsdaten aufgerufen. */
  onLogin: (email: string, password: string) => Promise<void> | void;
  /** Name (fest) + Gemeinde-Name. */
  site: SiteConfig;
  theme: Theme;
}

/** Anmelde-Screen mit Logo und ChurchTools-Zugangsdaten. */
export function Login({ onLogin, site, theme }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginLinks = site.links.filter((l) => l.showOnLogin);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch {
      setError('Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.');
      setLoading(false);
    }
  }

  return (
    <Screen style={{ justifyContent: 'center', alignItems: 'center', overflowY: 'auto' }}>
      <div className={styles.wrap}>
        <img
          className={styles.logo}
          src={theme === 'dark' ? '/logo-rund-dunkel.png' : '/logo-rund-hell.png'}
          alt={site.orgName}
        />
        <div className={styles.name}>{site.appName}</div>
        <div className={styles.sub}>{site.orgName}</div>
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.field}>
            <label className={styles.label}>E-Mail</label>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.de"
              autoComplete="username"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Passwort</label>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? <Spinner /> : 'Anmelden'}
          </button>
        </form>

        {loginLinks.length > 0 && (
          <div className={styles.links}>
            {loginLinks.map((link) => (
              <a
                key={link.id}
                className={styles.linkBtn}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
                <Icon name="external" size={17} />
              </a>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}
