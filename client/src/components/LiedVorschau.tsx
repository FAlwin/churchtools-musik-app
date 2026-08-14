/**
 * **Die Vorschau vor dem Einfügen** (#379, Muster von Alwin: ProPresenter) – ein Treffer antippen, den
 * Liedtext lesen, dann entscheiden.
 *
 * Vorher gab es dafür einen „Text zeigen"-Knopf je Zeile (#379). Das war falsch gedacht: Der Text ist
 * nicht eine Zusatzinfo neben dem Titel, sondern **die Entscheidungsgrundlage**. Bei 147 SongSelect-
 * Treffern zu einem Titel ist er das Einzige, was die Fassungen unterscheidet. Deshalb ist er jetzt der
 * Zwischenschritt: Liste → Vorschau → Einfügen.
 *
 * **Eine Komponente für beide Quellen.** Eigene Lieder und SongSelect-Treffer zeigen dasselbe (Titel,
 * Autoren, Text, ein Knopf) und unterscheiden sich nur darin, woher der Text kommt und was der Knopf
 * auslöst. Zwei Karten wären zwei Stellen für jede künftige Änderung.
 *
 * ⚠️ **Der CCLI-Hinweis (`disclaimer`) wird angezeigt, wenn er mitkommt.** CCLI schickt ihn mit jedem
 * Text mit; er ist eine Lizenzbedingung, keine Zierde.
 */
import type { LiedtextTeil } from '@shared/types/index';
import { Icon } from './icons';
import styles from './LiedVorschau.module.scss';

interface LiedVorschauProps {
  titel: string;
  /** Autorenzeile – bei eigenen Liedern aus ChurchTools, bei SongSelect von CCLI. */
  autoren?: string | null;
  /** Wird rechts oben klein angezeigt, z. B. „CCLI-Nr. 4336851" (wie bei ProPresenter). */
  kennung?: string | null;
  /** Die Textabschnitte. Leer + `laeuft: false` heißt „es gibt keinen Text". */
  teile: LiedtextTeil[];
  laeuft: boolean;
  /** Meldung des Servers, falls das Holen scheiterte – nie eine erfundene. */
  fehler?: string | null;
  /** CCLI-Lizenzhinweis, falls die Quelle einen mitschickt. */
  disclaimer?: string | null;
  /** Beschriftung der Hauptaktion, z. B. „Zum Ablauf hinzufügen" oder „Lied anlegen …". */
  aktion: string;
  onAktion: () => void;
  /** Zurück zur Trefferliste. */
  onZurueck: () => void;
  /** Sperrt die Aktion, während ein Vorgang läuft. */
  busy?: boolean;
}

export function LiedVorschau({
  titel,
  autoren,
  kennung,
  teile,
  laeuft,
  fehler,
  disclaimer,
  aktion,
  onAktion,
  onZurueck,
  busy,
}: LiedVorschauProps) {
  return (
    <div className={styles.karte}>
      <div className={styles.kopf}>
        <button className={styles.zurueck} onClick={onZurueck} aria-label="Zurück zur Liste">
          <Icon name="chev-left" size={18} stroke={2.2} />
        </button>
        <span className={styles.titelBlock}>
          <span className={styles.titel}>{titel}</span>
          {autoren && <span className={styles.autoren}>{autoren}</span>}
        </span>
        {kennung && <span className={styles.kennung}>{kennung}</span>}
      </div>

      <div className={styles.textBereich}>
        {laeuft ? (
          <span className={styles.still}>Liedtext wird geholt …</span>
        ) : fehler ? (
          /* Der Grund kommt vom Server: „ChurchTools bremst uns aus" ist etwas anderes als „kein Text"
             (#270). Die Aktion bleibt trotzdem möglich – man kann ein Lied auch ohne Textvorschau
             einfügen. */
          <span className={styles.still}>{fehler}</span>
        ) : teile.length === 0 ? (
          <span className={styles.still}>
            Für dieses Lied liegt kein Liedtext vor. Einfügen geht trotzdem.
          </span>
        ) : (
          teile.map((t, i) => (
            <div key={`${t.label}-${i}`} className={styles.teil}>
              {t.label && <div className={styles.label}>{t.label}</div>}
              {/* `white-space: pre-line` im Stil: Die Zeilenumbrüche im Liedtext sind Inhalt. */}
              <div className={styles.text}>{t.text}</div>
            </div>
          ))
        )}
      </div>

      {/* Pflicht, wenn die Quelle ihn mitschickt (CCLI). */}
      {disclaimer && <div className={styles.disclaimer}>{disclaimer}</div>}

      <div className={styles.aktionen}>
        <button className={styles.primaer} onClick={onAktion} disabled={busy}>
          {aktion}
        </button>
      </div>
    </div>
  );
}
