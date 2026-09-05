import { useEffect, useMemo, useState } from 'react';
import type { Absence, AbsenceEvent, NeueAbsence } from '@shared/types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar } from '../components/NavBar';
import { CenterMessage } from '../components/CenterMessage';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/icons';
import { Coachmarks } from '../components/Coachmarks';
import { WochenStreifen, type Auswahl } from '../components/WochenStreifen';
import {
  useAbsenceEvents,
  useCreateAbsence,
  useDeleteAbsence,
  useMyAbsences,
} from '../hooks/useAvailability';
import { abwesenheitFuer, deckt, tagKurz, uhrzeit, zeitraumKurz } from '../utils/absenceDatum';
import { anzahlTage, heuteIso, plusTage, wochenAb, zeitraumKompakt } from '../utils/wochen';
import { ApiError } from '../services/api';
import {
  TOUR_VERFUEGBARKEIT,
  VERFUEGBARKEIT_STEPS,
  isTourDone,
  markTourDone,
} from '../utils/onboarding';
import styles from './Availability.module.scss';

/** So viele Wochen zeigt der Streifen – und so weit holt der Server die Termine. */
export const WOCHEN = 12;

interface AvailabilityProps {
  /** Schreiben braucht Netz (ChurchTools). Lesen kommt aus dem Cache. */
  online: boolean;
  onToast: (text: string) => void;
  /** Nur für Tests: das „Heute" des Streifens. */
  heute?: string;
}

/** Was das Sheet gerade eintragen soll: ein Termintag oder ein (ggf. vorbelegter) Zeitraum. */
type Entwurf =
  | { art: 'termin'; event: AbsenceEvent }
  | { art: 'zeitraum'; von?: string; bis?: string };

/**
 * Verfügbarkeit (#177), Variante C (Entscheidung Alwin, 05.09.2026): oben der wischbare
 * **Wochenstreifen**, darunter **„Diese Woche"** (Termine und Abwesenheiten der gezeigten Woche), dann
 * die **nächsten Termine** und **„Meine Abwesenheiten"**. Statt einer langen Terminliste sieht man die
 * Woche, um die es geht, und blättert.
 *
 * Ein Zeitraum entsteht auf zwei Wegen (Entscheidung Alwin: „beides"): Starttag und Endtag im
 * Streifen antippen – dann erscheint unten die Auswahlleiste mit „Eintragen" – oder über den Knopf
 * „Zeitraum" mit Von/Bis-Feldern.
 *
 * Ein Eintrag hier ist eine echte ChurchTools-Abwesenheit mit dem Marker `[Musikteam]`. Manuell in
 * ChurchTools eingetragene (Urlaub, krank) werden gezeigt, lassen sich aber nur dort ändern – der
 * Server lehnt das Löschen ab, die Oberfläche bietet es gar nicht erst an.
 */
export function Availability({ online, onToast, heute = heuteIso() }: AvailabilityProps) {
  const absences = useMyAbsences(true);
  const events = useAbsenceEvents(true, WOCHEN);
  const anlegen = useCreateAbsence();
  const loeschen = useDeleteAbsence();
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const [tour, setTour] = useState(false);
  const wochen = useMemo(() => wochenAb(heute, WOCHEN), [heute]);
  const [wocheIdx, setWocheIdx] = useState(0);
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null);

  useEffect(() => {
    if (!absences.isLoading && !events.isLoading && !isTourDone(TOUR_VERFUEGBARKEIT)) setTour(true);
  }, [absences.isLoading, events.isLoading]);

  const liste = absences.data ?? [];
  const alleEvents = events.data ?? [];
  const montag = wochen[wocheIdx];
  const sonntag = plusTage(montag, 6);
  const wocheEvents = alleEvents.filter((e) => montag <= e.date && e.date <= sonntag);
  const wocheAbwesenheiten = liste.filter((a) => a.startDate <= sonntag && montag <= a.endDate);
  const naechsteEvents = alleEvents.filter((e) => e.date > sonntag).slice(0, 5);

  const meldeFehler = (e: unknown, sonst: string): void => {
    onToast(e instanceof ApiError ? e.message : sonst);
  };

  const zuruecknehmen = (a: Absence): void => {
    if (!online) return onToast('Zum Ändern brauchst du Netz.');
    loeschen.mutate(a.id, {
      onSuccess: () => onToast('Abmeldung zurückgenommen.'),
      onError: (e) => meldeFehler(e, 'Konnte nicht zurückgenommen werden.'),
    });
  };

  const eintragen = (neu: NeueAbsence): void => {
    anlegen.mutate(neu, {
      onSuccess: () => {
        setEntwurf(null);
        setAuswahl(null);
        onToast('Eingetragen – steht jetzt als Abwesenheit in ChurchTools.');
      },
      onError: (e) => meldeFehler(e, 'Konnte nicht eingetragen werden.'),
    });
  };

  /**
   * Zwei Tipps machen einen Zeitraum: der erste setzt den Anfang, der zweite das Ende (bei
   * verkehrter Reihenfolge wird getauscht). Ein Tipp auf den Anfang selbst hebt die Auswahl auf.
   */
  const tagAntippen = (tag: string): void => {
    if (!online) return onToast('Zum Eintragen brauchst du Netz.');
    if (!auswahl || auswahl.bis) return setAuswahl({ von: tag });
    if (tag === auswahl.von) return setAuswahl(null);
    setAuswahl(tag < auswahl.von ? { von: tag, bis: auswahl.von } : { von: auswahl.von, bis: tag });
  };

  const laedt = absences.isLoading || events.isLoading;
  const fehler = absences.isError || events.isError;

  /** Eine Terminzeile mit dem Zustand des Tages: frei, selbst abgemeldet, in ChurchTools gesperrt. */
  const terminZeile = (ev: AbsenceEvent) => {
    const a = abwesenheitFuer(liste, ev.date);
    return (
      <div key={`ev-${ev.id}`} className={styles.zeile}>
        <div className={styles.text}>
          <span className={styles.titel}>{ev.name}</span>
          <span className={styles.sub}>
            {tagKurz(ev.date)}
            {uhrzeit(ev.startDate) ? ` · ${uhrzeit(ev.startDate)}` : ''}
          </span>
        </div>
        {a && !a.eigene ? (
          <span className={styles.gesperrt} title="In ChurchTools eingetragen">
            <Icon name="lock" size={14} /> Abwesend
          </span>
        ) : a ? (
          <button
            className={`${styles.aktion} ${styles.gesetzt}`}
            disabled={loeschen.isPending}
            onClick={() => zuruecknehmen(a)}
            aria-label={`Abmeldung für ${ev.name} am ${tagKurz(ev.date)} zurücknehmen`}
          >
            Abgemeldet
          </button>
        ) : (
          <button
            className={styles.aktion}
            disabled={!online}
            onClick={() => setEntwurf({ art: 'termin', event: ev })}
          >
            Kann nicht
          </button>
        )}
      </div>
    );
  };

  /** Eine Abwesenheitszeile: eigene mit Papierkorb, manuelle mit Schloss. */
  const abwesenheitZeile = (a: Absence) => (
    <div key={`ab-${a.id}`} className={styles.zeile}>
      <div className={styles.text}>
        <span className={styles.titel}>{zeitraumKurz(a)}</span>
        <span className={styles.sub}>
          {a.comment || a.reason || (a.eigene ? 'Musikteam' : 'ChurchTools')}
        </span>
      </div>
      {a.eigene ? (
        <button
          className={styles.loeschen}
          disabled={!online || loeschen.isPending}
          onClick={() => zuruecknehmen(a)}
          aria-label={`Abwesenheit ${zeitraumKurz(a)} löschen`}
        >
          <Icon name="trash" size={18} />
        </button>
      ) : (
        <span className={styles.gesperrt} title="Nur in ChurchTools änderbar">
          <Icon name="lock" size={14} />
        </span>
      )}
    </div>
  );

  // „Diese Woche": Termine und Abwesenheiten der Woche in Datumsreihenfolge. Eine Abwesenheit, die
  // genau einen Termintag abdeckt, steht schon in dessen Zeile – nicht doppelt zeigen.
  const wocheZeilen = [
    ...wocheEvents.map((e) => ({ datum: e.date, el: terminZeile(e) })),
    ...wocheAbwesenheiten
      .filter((a) => !(a.startDate === a.endDate && wocheEvents.some((e) => deckt(a, e.date))))
      .map((a) => ({ datum: a.startDate, el: abwesenheitZeile(a) })),
  ].sort((x, y) => x.datum.localeCompare(y.datum));

  return (
    <Screen>
      <NavBar title="Verfügbarkeit" />
      <Scroll
        onRefresh={() => {
          void absences.refetch();
          void events.refetch();
        }}
      >
        {laedt ? (
          <CenterMessage loading text="Wird geladen…" />
        ) : fehler ? (
          <CenterMessage
            icon="⚠️"
            text="Konnte nicht geladen werden."
            onRetry={() => {
              void absences.refetch();
              void events.refetch();
            }}
          />
        ) : (
          <div className={styles.wrap}>
            <WochenStreifen
              wochen={wochen}
              index={wocheIdx}
              onIndex={(i) => {
                setWocheIdx(i);
              }}
              heute={heute}
              events={alleEvents}
              absences={liste}
              auswahl={auswahl}
              onTag={tagAntippen}
            />

            <section data-tour="verf-termine">
              <div className={styles.kopf}>
                {wocheIdx === 0 ? 'Diese Woche' : 'In dieser Woche'}
              </div>
              <div className={styles.liste}>
                {wocheZeilen.length === 0 && (
                  <div className={styles.leer}>Keine Termine, nichts eingetragen.</div>
                )}
                {wocheZeilen.map((z) => z.el)}
              </div>
            </section>

            {naechsteEvents.length > 0 && (
              <section>
                <div className={styles.kopf}>Nächste Termine</div>
                <div className={styles.liste}>{naechsteEvents.map(terminZeile)}</div>
              </section>
            )}

            <section data-tour="verf-liste">
              <div className={styles.kopf}>
                <span>Meine Abwesenheiten</span>
                <button
                  className={styles.neu}
                  disabled={!online}
                  onClick={() => setEntwurf({ art: 'zeitraum' })}
                  data-tour="verf-zeitraum"
                >
                  <Icon name="plus" size={16} /> Zeitraum
                </button>
              </div>
              <div className={styles.liste}>
                {liste.length === 0 && <div className={styles.leer}>Noch nichts eingetragen.</div>}
                {liste.map(abwesenheitZeile)}
              </div>
            </section>

            <p className={styles.hinweis} data-tour="verf-hinweis">
              Deine Einträge stehen als Abwesenheit in ChurchTools – für die Einteilung sichtbar.
              Einträge mit Schloss wurden direkt dort gemacht und lassen sich nur dort ändern.
            </p>
          </div>
        )}
      </Scroll>

      {auswahl && (
        <div className={styles.auswahlLeiste} role="status">
          <div className={styles.text}>
            <span className={styles.titel}>{zeitraumKompakt(auswahl.von, auswahl.bis)}</span>
            <span className={styles.sub}>
              {auswahl.bis
                ? `${anzahlTage(auswahl.von, auswahl.bis)} Tage gewählt`
                : 'Endtag antippen – oder nur diesen Tag eintragen'}
            </span>
          </div>
          <button
            className={styles.leisteHell}
            onClick={() => setAuswahl(null)}
            aria-label="Abbrechen"
          >
            <Icon name="plus" size={18} style={{ transform: 'rotate(45deg)' }} />
          </button>
          <button
            className={styles.leisteBlau}
            onClick={() =>
              setEntwurf({ art: 'zeitraum', von: auswahl.von, bis: auswahl.bis ?? auswahl.von })
            }
          >
            Eintragen
          </button>
        </div>
      )}

      {entwurf && (
        <AbsenceSheet
          entwurf={entwurf}
          laeuft={anlegen.isPending}
          onClose={() => setEntwurf(null)}
          onSubmit={eintragen}
        />
      )}

      {tour && (
        <Coachmarks
          steps={VERFUEGBARKEIT_STEPS}
          onClose={() => {
            markTourDone(TOUR_VERFUEGBARKEIT);
            setTour(false);
          }}
        />
      )}
    </Screen>
  );
}

interface AbsenceSheetProps {
  entwurf: Entwurf;
  laeuft: boolean;
  onClose: () => void;
  onSubmit: (neu: NeueAbsence) => void;
}

/** Das Eintrage-Formular: bei einem Termin steht der Tag fest, sonst frei von/bis (ggf. vorbelegt). */
export function AbsenceSheet({ entwurf, laeuft, onClose, onSubmit }: AbsenceSheetProps) {
  const festerTag = entwurf.art === 'termin' ? entwurf.event.date : '';
  const [von, setVon] = useState(entwurf.art === 'zeitraum' ? (entwurf.von ?? '') : festerTag);
  const [bis, setBis] = useState(entwurf.art === 'zeitraum' ? (entwurf.bis ?? '') : festerTag);
  const [kommentar, setKommentar] = useState('');
  const ungueltig = !von || !bis || bis < von;

  return (
    <Sheet
      title={entwurf.art === 'termin' ? entwurf.event.name : 'Zeitraum eintragen'}
      onClose={onClose}
    >
      {entwurf.art === 'termin' ? (
        <p className={styles.sub} style={{ marginBottom: 14 }}>
          {tagKurz(entwurf.event.date)} – du wirst als abwesend eingetragen.
        </p>
      ) : (
        <div className={styles.zwei}>
          <div className={styles.feld}>
            <label htmlFor="verf-von">Von</label>
            <input id="verf-von" type="date" value={von} onChange={(e) => setVon(e.target.value)} />
          </div>
          <div className={styles.feld}>
            <label htmlFor="verf-bis">Bis</label>
            <input
              id="verf-bis"
              type="date"
              value={bis}
              min={von}
              onChange={(e) => setBis(e.target.value)}
            />
          </div>
        </div>
      )}
      <div className={styles.feld}>
        <label htmlFor="verf-kommentar">Kommentar (optional)</label>
        <input
          id="verf-kommentar"
          type="text"
          maxLength={200}
          placeholder="z. B. Urlaub, Dienstreise"
          value={kommentar}
          onChange={(e) => setKommentar(e.target.value)}
        />
      </div>
      {entwurf.art === 'zeitraum' && von && bis && bis < von && (
        <div className={styles.fehler}>Das Ende liegt vor dem Anfang.</div>
      )}
      <button
        className={styles.primaryWide}
        disabled={ungueltig || laeuft}
        onClick={() =>
          onSubmit({ startDate: von, endDate: bis, comment: kommentar.trim() || undefined })
        }
      >
        {laeuft ? 'Wird eingetragen …' : 'Eintragen'}
      </button>
    </Sheet>
  );
}
