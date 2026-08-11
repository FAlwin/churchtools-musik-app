/**
 * „Notizen von …" – Personen-/Ebenen-Wähler (#198, Team-Notizen #124; vorher inline in
 * `pages/ChordChart.tsx`).
 *
 * Zwei Stufen in einem Blatt: erst **wer** teilt Anmerkungen zu diesem Lied, dann **welche Ebene**
 * dieser Person (Version + Darstellungsart). Angezeigt werden nur Ebenen, in denen wirklich etwas
 * steht – eine leere Auswahl wäre eine Sackgasse.
 */
import type { Sharer } from '../services/teamNotes';
import { Sheet } from './Sheet';
import { Icon } from './icons';
import styles from '../pages/ChordChart.module.scss';

/** Das Minimum einer Anmerkungs-Ebene, das der Wähler braucht (Rest siehe `annotationKeys`). */
interface LevelChoice {
  versionKey: string;
  lyr: boolean;
  /** Arrangement der Ebene (#320, 3c) – `null` bei Bestandsnotizen ohne Segment. */
  arrangementId: number | null;
  pages: number[];
}

interface SharersSheetProps {
  songTitle: string;
  /** Nur die Personen, die zum AKTIVEN Lied etwas teilen. */
  sharers: Sharer[];
  /** Gewählte Person → Stufe 2; `null` → Stufe 1. */
  pickerPerson: { id: number; name: string } | null;
  levels: LevelChoice[];
  /** Anzeigename einer Version (Slug → „Akustik"). */
  versionName: (versionKey: string) => string;
  /**
   * Anzeigename eines Arrangements – oder `null`, wenn es nicht in die Zeile gehört.
   *
   * `null` bei einem Lied mit nur EINEM Arrangement: Dann unterscheidet es nichts und macht die
   * Zeile nur länger. Von Alwin so entschieden (11.08.2026), nachdem zwei Zeilen identisch aussahen,
   * weil das Arrangement hier gar nicht vorkam.
   */
  arrangementName: (arrangementId: number | null) => string | null;
  levelKey: (level: LevelChoice) => string;
  onPickPerson: (person: { id: number; name: string }) => void;
  onPickLevel: (level: LevelChoice) => void;
  onBackToPersons: () => void;
  onClose: () => void;
}

export function SharersSheet({
  songTitle,
  sharers,
  pickerPerson,
  levels,
  versionName,
  arrangementName,
  levelKey,
  onPickPerson,
  onPickLevel,
  onBackToPersons,
  onClose,
}: SharersSheetProps) {
  return (
    <Sheet
      title={pickerPerson ? `Notizen von ${pickerPerson.name}` : 'Notizen von …'}
      onClose={onClose}
      cancelLabel="Schließen"
    >
      {!pickerPerson ? (
        <>
          <p className={styles.pickHint}>
            Wähle eine Person, um ihre geteilten Anmerkungen zu „{songTitle}" anzusehen –
            schreibgeschützt, in ihrer Ansicht. Übernehmen ist danach möglich.
          </p>
          {sharers.length === 0 ? (
            <p className={styles.pickHint}>Zurzeit teilt niemand Anmerkungen zu diesem Lied.</p>
          ) : (
            sharers.map((p) => (
              <button key={p.id} className={styles.pickRow} onClick={() => onPickPerson(p)}>
                <Icon name="people" size={18} stroke={2} />
                <span className={styles.pickName}>{p.name}</span>
                <Icon name="chev-right" size={16} className={styles.pickChev} />
              </button>
            ))
          )}
        </>
      ) : (
        <>
          <p className={styles.pickHint}>
            Welche Anmerkungen von {pickerPerson.name} möchtest du ansehen? (Nur Ebenen mit
            Anmerkungen werden angezeigt.)
          </p>
          {levels.length === 0 && (
            <p className={styles.pickHint}>Keine Anmerkungen zu diesem Lied vorhanden.</p>
          )}
          {levels.map((g) => {
            const arr = arrangementName(g.arrangementId);
            return (
              <button key={levelKey(g)} className={styles.pickRow} onClick={() => onPickLevel(g)}>
                <Icon name="pencil" size={16} stroke={2} />
                <span className={styles.pickName}>
                  {/* Das Arrangement steht VORN, weil es die größere Klammer ist – die Versionen
                      sind ChordPro-Dateien innerhalb eines Arrangements. Dieselbe Reihenfolge wie
                      im Lied-Menü. */}
                  {arr && <>{arr} · </>}
                  Version „{versionName(g.versionKey)}" · {g.lyr ? 'Nur Text' : 'Akkorde & Text'}
                </span>
                <span className={styles.pickPages}>
                  {g.pages.length} {g.pages.length === 1 ? 'Seite' : 'Seiten'}
                </span>
              </button>
            );
          })}
          <button className={styles.pickBack} onClick={onBackToPersons}>
            Andere Person wählen
          </button>
        </>
      )}
    </Sheet>
  );
}
