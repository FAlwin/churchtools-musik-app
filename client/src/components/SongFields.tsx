/**
 * Die Stammdaten-Felder eines Liedes – **einmal, für Anlegen und Ändern** (#322).
 *
 * Beide Formulare zeigen dieselben fünf Angaben: Name, Kategorie, Autor, CCLI-Nummer und Copyright.
 * Als zwei Fassungen nebeneinander wäre jede Korrektur (eine neue Grenze, ein anderer Platzhalter, ein
 * zusätzliches Feld) an genau einer davon gelandet – die Fehlerklasse, die dieses Projekt am häufigsten
 * getroffen hat. Deshalb liegen sie hier, und die Unterschiede der beiden Formulare stehen außen:
 * beim Anlegen zusätzlich Tonart und Arrangement-Name (`children`), beim Ändern der Löschen-Weg.
 *
 * **Die Kategorie-Auswahl ist bewusst eine Reihe von Knöpfen** und keine Auswahlliste: Es sind wenige,
 * sie sind alle erlaubt (der Server schneidet zu), und beim Anlegen ist keine vorbelegt – ein leeres
 * `<select>` mit Platzhalter sähe dagegen wie ein Versehen aus.
 */
import type { ReactNode } from 'react';
import type { SongCategory } from '@shared/types/index';
import { LIED_GRENZEN } from '@shared/types/index';
import type { NeuesLiedFormular } from '../utils/liedFormular';
import styles from './SongFields.module.scss';

interface SongFieldsProps {
  formular: NeuesLiedFormular;
  onFeld: (feld: keyof NeuesLiedFormular, wert: string) => void;
  onKategorie: (id: number) => void;
  /** Schon am ChurchTools-Recht zugeschnitten – hier wird NICHT nachgefiltert. */
  kategorien: SongCategory[];
  /** Hinweis unter dem Namen (gleicher Liedname). `null` = keiner. */
  warnung?: string | null;
  /** Steht im Copyright-Feld, solange die CCLI-Abfrage läuft. */
  copyrightPlatzhalter?: string;
  autoFocus?: boolean;
  /** Zusätzliche Felder dieses Formulars (beim Anlegen: Tonart, Name des Arrangements). */
  children?: ReactNode;
}

export function SongFields({
  formular,
  onFeld,
  onKategorie,
  kategorien,
  warnung = null,
  copyrightPlatzhalter = 'Optional',
  autoFocus = false,
  children,
}: SongFieldsProps) {
  return (
    <>
      <div className={styles.field}>
        <span className={styles.label}>Liedname</span>
        <input
          className={styles.input}
          placeholder="Titel des Liedes"
          value={formular.name}
          maxLength={LIED_GRENZEN.name.max}
          autoFocus={autoFocus}
          onChange={(e) => onFeld('name', e.target.value)}
        />
        {/* Gleiche Namen sind erlaubt – gewarnt wird trotzdem, damit niemand versehentlich ein Doppel
            anlegt. Blockiert wird nur die gleiche CCLI-Nummer, und zwar am Server. */}
        {warnung && <span className={styles.warn}>{warnung}</span>}
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Kategorie</span>
        <div className={styles.chips}>
          {kategorien.map((k) => (
            <button
              key={k.id}
              className={`${styles.chip}${formular.categoryId === k.id ? ' ' + styles.chipActive : ''}`}
              aria-pressed={formular.categoryId === k.id}
              onClick={() => onKategorie(k.id)}
            >
              {k.name}
            </button>
          ))}
        </div>
      </div>

      {children}

      <div className={styles.field}>
        <span className={styles.label}>Autor</span>
        <input
          className={styles.input}
          placeholder="Optional"
          value={formular.author}
          maxLength={LIED_GRENZEN.author}
          onChange={(e) => onFeld('author', e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>CCLI-Nummer</span>
        <input
          className={styles.input}
          placeholder="Optional"
          inputMode="numeric"
          value={formular.ccli}
          maxLength={LIED_GRENZEN.ccli}
          onChange={(e) => onFeld('ccli', e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Copyright</span>
        <textarea
          className={styles.textarea}
          placeholder={copyrightPlatzhalter}
          rows={2}
          value={formular.copyright}
          maxLength={LIED_GRENZEN.copyright}
          onChange={(e) => onFeld('copyright', e.target.value)}
        />
      </div>
    </>
  );
}
