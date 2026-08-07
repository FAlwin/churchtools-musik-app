import { Icon } from './icons';
import styles from '../pages/ChordChart.module.scss';

/**
 * Die beiden Leisten für „Notizen von …" (#314 – vorher inline in `pages/ChordChart.tsx`).
 *
 * Sie treten immer gemeinsam auf, stehen aber an verschiedenen Stellen der Seite: oben das Banner
 * mit der Auskunft, WESSEN Ebene man gerade sieht, unten die Leiste, mit der man sie übernimmt.
 * Deshalb zwei Komponenten in einer Datei – wie `AgendaRowParts`.
 *
 * Das Banner ist kein Schmuck: Beim Ansehen zeigt das Blatt eine fremde Ansicht, unter Umständen in
 * einer anderen Version als der eigenen. Ohne den Hinweis hält man das für sein eigenes Lied.
 */

interface ViewingBannerProps {
  personName: string;
  /** Anzeigename der angesehenen Version. */
  versionName: string;
  /** Ist es eine ANDERE Version als die eigene? Dann wird sie hervorgehoben. */
  otherVersion: boolean;
  /** Angesehene Darstellungsart. */
  lyricsOnly: boolean;
}

/** Oben: wessen Ebene man gerade sieht. */
export function ViewingBanner({
  personName,
  versionName,
  otherVersion,
  lyricsOnly,
}: ViewingBannerProps) {
  return (
    <div className={styles.viewBar}>
      <Icon name="people" size={15} stroke={2} />
      <span className={styles.viewBarText}>
        Notizen von {personName}
        {' · '}
        {otherVersion ? <strong>Version „{versionName}"</strong> : <>Version „{versionName}"</>}
        {' · '}
        {lyricsOnly ? 'Nur Text' : 'Akkorde & Text'}
      </span>
    </div>
  );
}

/** Die drei Stufen der Leiste – „Ansehen" ändert nichts, die anderen beiden zeigen die Vorschau. */
const MODI = [
  { key: 'view', label: 'Ansehen' },
  { key: 'merge', label: 'Zusammenführen' },
  { key: 'replace', label: 'Ersetzen' },
] as const;

interface ImportPreviewBarProps {
  mode: 'view' | 'merge' | 'replace';
  onMode: (mode: 'view' | 'merge' | 'replace') => void;
  /** Die angezeigte Vorschau wirklich übernehmen – nur aus „Zusammenführen"/„Ersetzen" möglich. */
  onImport: (mode: 'merge' | 'replace') => void;
  /** Andere Person oder Ebene wählen. */
  onPickOther: () => void;
  onStop: () => void;
}

/**
 * Unten: Umschalter und „Übernehmen".
 *
 * „Zusammenführen" und „Ersetzen" zeigen das Ergebnis **live auf dem Blatt** – geschrieben wird
 * aber erst mit „Übernehmen". Deshalb erscheint der Knopf auch nur in diesen beiden Stufen: In
 * „Ansehen" gäbe es nichts zu übernehmen, was man vorher gesehen hätte.
 */
export function ImportPreviewBar({
  mode,
  onMode,
  onImport,
  onPickOther,
  onStop,
}: ImportPreviewBarProps) {
  return (
    <div className={styles.previewBar}>
      <span className={styles.pvSegWrap}>
        {MODI.map((m) => (
          <button
            key={m.key}
            className={`${styles.pvSeg}${mode === m.key ? ' ' + styles.pvSegOn : ''}`}
            onClick={() => onMode(m.key)}
          >
            {m.label}
          </button>
        ))}
      </span>
      {mode !== 'view' && (
        <>
          <span className={styles.pvDivider} />
          <button className={styles.pvGo} onClick={() => onImport(mode)}>
            Übernehmen
          </button>
        </>
      )}
      <button
        className={styles.pvIcon}
        onClick={onPickOther}
        title="Andere Person / Ebene"
        aria-label="Andere Person oder Ebene wählen"
      >
        <Icon name="people" size={18} stroke={2} />
      </button>
      <button className={styles.pvCancel} onClick={onStop}>
        Fertig
      </button>
    </div>
  );
}
