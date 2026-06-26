import styles from './SupportBox.module.scss';

/** Freiwillige Unterstützung für den (ehrenamtlichen) Entwickler – fest, dezent. */
const SUPPORT_URL = 'https://paypal.me/AlwinFriesen';
/** Vorgewählte Beträge (PayPal.me hängt Betrag + Währung an die URL an: …/3EUR). */
const SUPPORT_AMOUNTS = [1, 3, 5];

/**
 * Dezenter „Kaffee spendieren"-Bereich (PayPal). Bewusst zurückhaltend –
 * wird im Mehr-Tab und auf der Login-Seite ganz unten eingeblendet.
 */
export function SupportBox() {
  return (
    <div className={styles.support}>
      <div className={styles.title}>☕ Kaffee spendieren</div>
      <div className={styles.amounts}>
        {SUPPORT_AMOUNTS.map((amount) => (
          <a
            key={amount}
            className={styles.btn}
            href={`${SUPPORT_URL}/${amount}EUR`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {amount} €
          </a>
        ))}
      </div>
      <a className={styles.other} href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
        anderer Betrag
      </a>
      <div className={styles.note}>Diese App wird ehrenamtlich entwickelt.</div>
    </div>
  );
}
