import { useState } from 'react';
import type { Absence, AbsenceReason, NeueAbsence } from '@shared/types/index';
import { Sheet } from './Sheet';
import { anzahlTage, plusTage, wochenStart } from '../utils/wochen';
import styles from '../pages/Availability.module.scss';

/** Was das Fenster gerade tut: neu eintragen (mit Starttag) oder einen eigenen Eintrag ändern. */
export type Entwurf = { art: 'neu'; tag: string } | { art: 'aendern'; absence: Absence };

/** Die Schnellwahl über den Feldern – die vier Fälle, die es im Musikteam wirklich gibt. */
export const SCHNELLWAHL = [
  { id: 'tag', label: 'Nur dieser Tag' },
  { id: 'we', label: 'Wochenende' },
  { id: 'w1', label: '1 Woche' },
  { id: 'w2', label: '2 Wochen' },
] as const;

export type SchnellwahlId = (typeof SCHNELLWAHL)[number]['id'];

/**
 * Was eine Schnellwahl aus einem Starttag macht. Reine Funktion – ohne Netz und ohne Oberfläche
 * prüfbar. „Wochenende" ist der Samstag+Sonntag der Woche, in der der Starttag liegt; liegt er
 * schon dahinter, das nächste.
 */
export function schnellwahlZeitraum(
  id: SchnellwahlId,
  tag: string,
): { startDate: string; endDate: string } {
  if (id === 'tag') return { startDate: tag, endDate: tag };
  if (id === 'w1') return { startDate: tag, endDate: plusTage(tag, 6) };
  if (id === 'w2') return { startDate: tag, endDate: plusTage(tag, 13) };
  const samstag = plusTage(wochenStart(tag), 5);
  const start = samstag >= tag ? samstag : plusTage(samstag, 7);
  return { startDate: start, endDate: plusTage(start, 1) };
}

interface AbsenceSheetProps {
  entwurf: Entwurf;
  heute: string;
  laeuft: boolean;
  loeschtGerade: boolean;
  /** Gründe der Gemeinde aus ChurchTools; leer, solange sie laden oder nicht abrufbar sind. */
  gruende: AbsenceReason[];
  /** Vorbelegter Grund beim Anlegen: der vom Server als `standard` gekennzeichnete. */
  standardGrund?: number | null;
  /**
   * Vergangene Einträge (Seite „Einträge → Früher", 19.09.2026) sind **nur zum Ansehen**: Was war,
   * wird nicht rückwirkend geändert – die Felder sind gesperrt, Speichern und Löschen fehlen.
   */
  nurLesen?: boolean;
  onClose: () => void;
  onSubmit: (neu: NeueAbsence) => void;
  onDelete: (a: Absence) => void;
}

/**
 * Ein Fenster für beides: **eintragen** und **ändern** (#177, nach Alwins Durchklick am 05.09.2026).
 *
 * Vorher brauchte ein Urlaub vier Schritte – Tag antippen, zweiten Tag antippen, Leiste unten,
 * Fenster. Jetzt öffnet ein Knopf dieses Fenster: oben **Schnellwahl** für die üblichen Fälle,
 * darunter Von–Bis zum Feinjustieren. Beim Ändern stehen die Werte des Eintrags drin und unten gibt
 * es **Löschen** – der Weg, den die frühere Papierkorb-Zeile allein nicht bot.
 */
export function AbsenceSheet({
  entwurf,
  heute,
  laeuft,
  loeschtGerade,
  gruende,
  standardGrund = null,
  nurLesen = false,
  onClose,
  onSubmit,
  onDelete,
}: AbsenceSheetProps) {
  const start = entwurf.art === 'neu' ? entwurf.tag : entwurf.absence.startDate;
  const [von, setVon] = useState(start);
  const [bis, setBis] = useState(entwurf.art === 'neu' ? entwurf.tag : entwurf.absence.endDate);
  const [kommentar, setKommentar] = useState(
    entwurf.art === 'aendern' ? entwurf.absence.comment : '',
  );
  const [wahl, setWahl] = useState<SchnellwahlId | null>(entwurf.art === 'neu' ? 'tag' : null);
  /**
   * Der Grund kommt aus ChurchTools (Wunsch Alwin, 05.09.2026: „man kann da Gründe einstellen") –
   * beim Ändern der des Eintrags, beim Anlegen der Standard. `null` heißt „nicht angefasst": Dann
   * entscheidet der Server, und ein Urlaub bleibt Urlaub, selbst wenn die Liste gerade fehlt.
   */
  const [grund, setGrund] = useState<number | null>(
    entwurf.art === 'aendern' ? entwurf.absence.reasonId : standardGrund,
  );
  const [loeschFrage, setLoeschFrage] = useState(false);
  const ungueltig = !von || !bis || bis < von;

  const schnellwahl = (id: SchnellwahlId): void => {
    const z = schnellwahlZeitraum(id, entwurf.art === 'neu' ? entwurf.tag : von);
    setWahl(id);
    setVon(z.startDate);
    setBis(z.endDate);
  };

  const tage = ungueltig ? 0 : anzahlTage(von, bis);

  return (
    <Sheet
      title={
        entwurf.art === 'neu'
          ? 'Zeitraum eintragen'
          : nurLesen
            ? 'Vergangene Abwesenheit'
            : 'Abwesenheit ändern'
      }
      onClose={onClose}
      cancelLabel={nurLesen ? 'Schließen' : 'Abbrechen'}
    >
      {/* Schnellauswahl nur beim Eintragen: Ein bestehender Eintrag hat schon seinen Zeitraum. */}
      {entwurf.art === 'neu' && (
        <div className={styles.chips} role="group" aria-label="Schnellauswahl">
          {SCHNELLWAHL.map((s) => (
            <button
              key={s.id}
              className={`${styles.chip}${wahl === s.id ? ' ' + styles.chipAn : ''}`}
              onClick={() => schnellwahl(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className={styles.zwei}>
        <div className={styles.feld}>
          <label htmlFor="verf-von">Von</label>
          <input
            id="verf-von"
            type="date"
            value={von}
            min={nurLesen ? undefined : heute}
            disabled={nurLesen}
            onChange={(e) => {
              setVon(e.target.value);
              setWahl(null);
              if (bis < e.target.value) setBis(e.target.value);
            }}
          />
        </div>
        <div className={styles.feld}>
          <label htmlFor="verf-bis">Bis</label>
          <input
            id="verf-bis"
            type="date"
            value={bis}
            min={von}
            disabled={nurLesen}
            onChange={(e) => {
              setBis(e.target.value);
              setWahl(null);
            }}
          />
        </div>
      </div>

      <div className={styles.feld}>
        <label htmlFor="verf-kommentar">Kommentar (optional)</label>
        <input
          id="verf-kommentar"
          type="text"
          maxLength={200}
          placeholder="z. B. Urlaub, Dienstreise"
          value={kommentar}
          disabled={nurLesen}
          onChange={(e) => setKommentar(e.target.value)}
        />
      </div>

      {gruende.length > 0 && (
        <div className={styles.feld}>
          <label htmlFor="verf-grund">Grund</label>
          <select
            id="verf-grund"
            value={grund ?? ''}
            disabled={nurLesen}
            onChange={(e) => setGrund(e.target.value ? Number(e.target.value) : null)}
          >
            {gruende.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {ungueltig && von && bis && (
        <div className={styles.fehler}>Das Ende liegt vor dem Anfang.</div>
      )}

      {nurLesen && (
        <p className={styles.frageText}>Liegt in der Vergangenheit – nur zum Ansehen.</p>
      )}

      {!nurLesen && (
        <button
          className={styles.primaryWide}
          disabled={ungueltig || laeuft}
          onClick={() =>
            onSubmit({
              startDate: von,
              endDate: bis,
              comment: kommentar.trim() || undefined,
              reasonId: grund ?? undefined,
            })
          }
        >
          {laeuft
            ? 'Wird gespeichert …'
            : entwurf.art === 'neu'
              ? `Eintragen${tage > 1 ? ` (${tage} Tage)` : ''}`
              : 'Speichern'}
        </button>
      )}

      {entwurf.art === 'aendern' &&
        !nurLesen &&
        /**
         * **Löschen fragt nach, wenn der Eintrag nicht aus der App stammt.** Er wurde dann direkt in
         * ChurchTools gemacht (Urlaub, krank) – dass er hier verschwindet, soll niemanden überraschen.
         * Bei eigenen App-Einträgen bleibt es beim einen Tipp.
         */
        (loeschFrage ? (
          <div className={styles.loeschFrage}>
            <p>
              Dieser Eintrag stammt aus ChurchTools
              {entwurf.absence.reason ? ` („${entwurf.absence.reason}")` : ''}. Wirklich löschen?
            </p>
            <div className={styles.zwei}>
              <button className={styles.behalten} onClick={() => setLoeschFrage(false)}>
                Behalten
              </button>
              <button
                className={styles.loeschenWide}
                disabled={loeschtGerade}
                onClick={() => onDelete(entwurf.absence)}
              >
                {loeschtGerade ? 'Wird gelöscht …' : 'Ja, löschen'}
              </button>
            </div>
          </div>
        ) : (
          <button
            className={styles.loeschenWide}
            disabled={loeschtGerade}
            onClick={() =>
              entwurf.absence.vonApp ? onDelete(entwurf.absence) : setLoeschFrage(true)
            }
          >
            {loeschtGerade ? 'Wird gelöscht …' : 'Löschen'}
          </button>
        ))}
    </Sheet>
  );
}
