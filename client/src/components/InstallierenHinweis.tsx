import { Icon } from './icons';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { promptInstall } from '../services/pwaInstall';
import styles from '../pages/Settings.module.scss';

/**
 * „Als App installieren" im Tab „Mehr" – je Browser der passende Weg (#407: aus `Settings.tsx`
 * herausgelöst). Erscheint nur, solange die App NICHT schon als installierte App läuft.
 */
export function InstallierenHinweis() {
  const pwa = usePwaInstall();
  if (pwa.standalone) return null;
  return (
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
            <strong>„Zum Home-Bildschirm"</strong> – so liegt die App wie eine echte App auf deinem
            Startbildschirm.
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
            Über das <strong>Browser-Menü</strong> kannst du die App wie ein Programm ablegen – in
            Chrome/Edge unter <strong>„Streamen, speichern und teilen"</strong> →{' '}
            <strong>„Seite als App installieren"</strong>, in anderen Browsern über{' '}
            <strong>„Zum Startbildschirm hinzufügen"</strong>.
          </p>
        )}
      </div>
    </div>
  );
}
