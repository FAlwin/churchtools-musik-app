/**
 * „Arrangement bearbeiten" und „Weiteres Arrangement" – **ein Fenster für beides** (#396).
 *
 * Es zeigt dieselben acht Angaben wie der ChurchTools-Dialog: Name, Quelle, Liednummer, Tonart,
 * Tempo, Takt, Länge und Beschreibung. Zwei Fassungen nebeneinander (eine zum Anlegen, eine zum
 * Ändern) wären dieselben Felder zweimal – und die nächste Korrektur wäre an einer davon gelandet.
 * Der Unterschied ist genau einer: Ohne `arrangement` wird angelegt, mit ihm geändert.
 *
 * **Die Quelle wird nur gezeigt, wenn die Gemeinde welche führt.** Viele haben keine Liederbücher
 * hinterlegt; eine leere Auswahl wäre ein Feld, das nichts kann.
 *
 * **„Zum Standard machen" und „Löschen" stehen unten im selben Fenster** – genau wie „Lied löschen"
 * im Stammdaten-Blatt. Ein eigenes Menü an der Liste wäre eine Ebene mehr für zwei Knöpfe, und der
 * Ort, an dem man ein Arrangement ansieht, ist auch der, an dem man darüber entscheidet.
 *
 * Beide Knöpfe kann die Liste **weglassen**: Das Standard-Arrangement ist schon Standard, und das
 * letzte lässt sich nicht löschen. Ein Knopf, der sicher in eine Fehlermeldung führt, ist schlimmer
 * als keiner – die Regeln selbst stehen im Server (`arrangementVerwaltung.ts`), nicht hier.
 */
import { useState } from 'react';
import { ARRANGEMENT_GRENZEN, type ArrangementAnsicht, type SongSource } from '@shared/types/index';
import { Sheet } from './Sheet';
import { Icon } from './icons';
import feld from './SongFields.module.scss';
import styles from './NewSongSheet.module.scss';
import eigen from './ArrangementSheet.module.scss';
import {
  LEERES_ARRANGEMENT,
  arrangementBereit,
  arrangementHinweis,
  auftragAus,
  formularAusArrangement,
  hatAenderung,
  type ArrangementFormular,
} from '../utils/arrangementFormular';
import type { ArrangementAuftrag } from '@shared/types/index';

interface ArrangementSheetProps {
  /** Das zu ändernde Arrangement – fehlt es, wird ein neues angelegt. */
  arrangement?: ArrangementAnsicht | null;
  /** Die Liedquellen der Gemeinde; leer = die Gemeinde führt keine. */
  quellen: SongSource[];
  /** Läuft gerade ein Speichervorgang? */
  speichert: boolean;
  /** Meldung vom Server, falls das Speichern scheiterte. */
  fehler: string | null;
  onSave: (auftrag: ArrangementAuftrag & { name: string }) => void;
  /** Fehlt, wenn es schon Standard ist – dann gibt es nichts zu wechseln. */
  onStandard?: () => void;
  /** Fehlt beim letzten Arrangement und beim Standard: Der Server lehnt beides ab. */
  onLoeschen?: () => void;
  onClose: () => void;
}

export function ArrangementSheet({
  arrangement = null,
  quellen,
  speichert,
  fehler,
  onSave,
  onStandard,
  onLoeschen,
  onClose,
}: ArrangementSheetProps) {
  const [formular, setFormular] = useState<ArrangementFormular>(() =>
    arrangement ? formularAusArrangement(arrangement) : LEERES_ARRANGEMENT,
  );

  const setze = (f: keyof ArrangementFormular, wert: string): void =>
    setFormular((alt) => ({ ...alt, [f]: wert }));

  const hinweis = arrangementHinweis(formular);
  const bereit =
    arrangementBereit(formular) &&
    hinweis === null &&
    !speichert &&
    (arrangement === null || hatAenderung(formular, arrangement));

  return (
    <Sheet
      title={arrangement ? arrangement.name : 'Weiteres Arrangement'}
      onClose={onClose}
      cancelLabel="Abbrechen"
    >
      {fehler && <div className={styles.err}>{fehler}</div>}

      <div className={feld.form}>
        <div className={feld.field}>
          <span className={feld.label}>Name</span>
          <input
            className={feld.input}
            placeholder="z. B. Akustik"
            value={formular.name}
            maxLength={ARRANGEMENT_GRENZEN.name.max}
            autoFocus={arrangement === null}
            onChange={(e) => setze('name', e.target.value)}
          />
        </div>

        {quellen.length > 0 && (
          <>
            <div className={feld.field}>
              <span className={feld.label}>Quelle</span>
              {/* Knöpfe statt Auswahlliste – dieselbe Entscheidung wie bei den Kategorien: Es sind
                  wenige, und „keine" muss genauso anklickbar sein wie ein Liederbuch. */}
              <div className={feld.chips}>
                <button
                  className={`${feld.chip}${formular.sourceId === null ? ' ' + feld.chipActive : ''}`}
                  aria-pressed={formular.sourceId === null}
                  onClick={() => setFormular((f) => ({ ...f, sourceId: null }))}
                >
                  Keine
                </button>
                {quellen.map((q) => (
                  <button
                    key={q.id}
                    className={`${feld.chip}${formular.sourceId === q.id ? ' ' + feld.chipActive : ''}`}
                    aria-pressed={formular.sourceId === q.id}
                    onClick={() => setFormular((f) => ({ ...f, sourceId: q.id }))}
                  >
                    {q.name}
                  </button>
                ))}
              </div>
            </div>

            <div className={feld.field}>
              <span className={feld.label}>Liednummer</span>
              <input
                className={feld.input}
                placeholder="Optional, z. B. 142"
                value={formular.sourceReference}
                maxLength={ARRANGEMENT_GRENZEN.sourceReference}
                onChange={(e) => setze('sourceReference', e.target.value)}
              />
              {/* Der Hinweis steht VOR dem Speichern, nicht danach: ChurchTools nimmt eine Nummer
                  ohne Quelle an und wirft sie weg (gemessen). */}
              {hinweis && <span className={feld.warn}>{hinweis}</span>}
            </div>
          </>
        )}

        <div className={feld.field}>
          <span className={feld.label}>Tonart</span>
          <input
            className={feld.input}
            placeholder="z. B. E"
            value={formular.key}
            maxLength={ARRANGEMENT_GRENZEN.key}
            onChange={(e) => setze('key', e.target.value)}
          />
        </div>

        <div className={feld.field}>
          <span className={feld.label}>Tempo</span>
          <input
            className={feld.input}
            placeholder="Schläge je Minute"
            inputMode="numeric"
            value={formular.tempo}
            onChange={(e) => setze('tempo', e.target.value.replace(/[^0-9]/g, ''))}
          />
        </div>

        <div className={feld.field}>
          <span className={feld.label}>Takt</span>
          <input
            className={feld.input}
            placeholder="z. B. 4/4"
            value={formular.beat}
            maxLength={ARRANGEMENT_GRENZEN.beat}
            onChange={(e) => setze('beat', e.target.value)}
          />
        </div>

        <div className={feld.field}>
          <span className={feld.label}>Länge</span>
          {/* Zwei Felder wie im ChurchTools-Dialog. Gespeichert werden Sekunden – die Umrechnung
              steht in `arrangementFormular.ts`, an genau einer Stelle. */}
          <div className={eigen.laenge}>
            <input
              className={feld.input}
              placeholder="Min"
              inputMode="numeric"
              aria-label="Länge in Minuten"
              value={formular.laengeMin}
              onChange={(e) => setze('laengeMin', e.target.value.replace(/[^0-9]/g, ''))}
            />
            <span className={eigen.doppelpunkt}>:</span>
            <input
              className={feld.input}
              placeholder="Sek"
              inputMode="numeric"
              aria-label="Länge in Sekunden"
              value={formular.laengeSek}
              onChange={(e) => setze('laengeSek', e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
        </div>

        <div className={feld.field}>
          <span className={feld.label}>Beschreibung</span>
          <textarea
            className={feld.textarea}
            placeholder="Optional"
            rows={3}
            value={formular.description}
            maxLength={ARRANGEMENT_GRENZEN.description}
            onChange={(e) => setze('description', e.target.value)}
          />
        </div>

        <button
          className={styles.primaryWide}
          disabled={!bereit}
          onClick={() => onSave(auftragAus(formular, arrangement))}
        >
          {speichert ? 'Wird gespeichert …' : 'Speichern'}
        </button>

        {/* Beide Knöpfe nur an einem VORHANDENEN Arrangement: Beim Anlegen gibt es nichts, was
            Standard werden oder verschwinden könnte. Welche der beiden darüber hinaus sinnvoll
            sind, entscheidet der Aufrufer – die Regeln dazu stehen im Server. */}
        {arrangement && onStandard && (
          <button className={styles.secondaryWide} disabled={speichert} onClick={onStandard}>
            Zum Standard machen
          </button>
        )}

        {/* Löschen steht unten und getrennt – der seltene, folgenreiche Weg, wie beim Lied. */}
        {arrangement && onLoeschen && (
          <button className={styles.dangerWide} disabled={speichert} onClick={onLoeschen}>
            <Icon name="trash" size={16} stroke={2} /> Arrangement löschen …
          </button>
        )}
      </div>
    </Sheet>
  );
}
