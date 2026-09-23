import { useEffect, useState } from 'react';
import { useUpdateCheck } from '../hooks/useUpdateCheck';
import { getOfflineStatus } from '../queryClient';
import { standKurz } from '../utils/zeitstempel';
import styles from '../pages/Settings.module.scss';

/**
 * Der Fuß des Tabs „Mehr": Version, Hinweis auf eine neuere Version und der Offline-Stand (#407: aus
 * `pages/Settings.tsx` herausgelöst – er hat zwei eigene Datenquellen, die die Seite sonst mittrug).
 */
export function VersionsFuss() {
  const updateCheck = useUpdateCheck();
  const [offline, setOffline] = useState<{
    files: number;
    records: number;
    savedAt: number | null;
  } | null>(null);
  useEffect(() => {
    void getOfflineStatus().then(setOffline);
  }, []);
  return (
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
          Offline bereit ✓
          {offline.savedAt != null && ` · zuletzt gespeichert ${standKurz(offline.savedAt)}`}
        </div>
      )}
    </div>
  );
}
