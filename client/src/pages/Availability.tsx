import { useEffect, useState } from 'react';
import type { Absence, AbsenceEvent, NeueAbsence } from '@shared/types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar } from '../components/NavBar';
import { CenterMessage } from '../components/CenterMessage';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/icons';
import { Coachmarks } from '../components/Coachmarks';
import {
  useAbsenceEvents,
  useCreateAbsence,
  useDeleteAbsence,
  useMyAbsences,
} from '../hooks/useAvailability';
import { abwesenheitFuer, tagKurz, uhrzeit, zeitraumKurz } from '../utils/absenceDatum';
import { ApiError } from '../services/api';
import {
  TOUR_VERFUEGBARKEIT,
  VERFUEGBARKEIT_STEPS,
  isTourDone,
  markTourDone,
} from '../utils/onboarding';
import styles from './Availability.module.scss';

interface AvailabilityProps {
  /** Schreiben braucht Netz (ChurchTools). Lesen kommt aus dem Cache. */
  online: boolean;
  onToast: (text: string) => void;
}

/** Was das Sheet gerade eintragen soll: ein Termintag oder ein frei gewählter Zeitraum. */
type Entwurf = { art: 'termin'; event: AbsenceEvent } | { art: 'zeitraum' };

/**
 * Verfügbarkeit (#177): eigene Abwesenheiten – Termin-Schnellauswahl oben, Zeiträume darunter.
 *
 * Ein Eintrag hier ist eine echte ChurchTools-Abwesenheit mit dem Marker `[Musikteam]`. Manuell in
 * ChurchTools eingetragene (Urlaub, krank) werden gezeigt, lassen sich aber nur dort ändern – der
 * Server lehnt das Löschen ab, die Oberfläche bietet es gar nicht erst an.
 */
export function Availability({ online, onToast }: AvailabilityProps) {
  const absences = useMyAbsences(true);
  const events = useAbsenceEvents(true);
  const anlegen = useCreateAbsence();
  const loeschen = useDeleteAbsence();
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const [tour, setTour] = useState(false);

  useEffect(() => {
    if (!absences.isLoading && !events.isLoading && !isTourDone(TOUR_VERFUEGBARKEIT)) setTour(true);
  }, [absences.isLoading, events.isLoading]);

  const liste = absences.data ?? [];

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
        onToast('Eingetragen – steht jetzt als Abwesenheit in ChurchTools.');
      },
      onError: (e) => meldeFehler(e, 'Konnte nicht eingetragen werden.'),
    });
  };

  const laedt = absences.isLoading || events.isLoading;
  const fehler = absences.isError || events.isError;

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
            <p className={styles.hinweis} data-tour="verf-hinweis">
              Trag hier ein, wann du nicht kannst. Deine Einträge stehen als Abwesenheit in
              ChurchTools – für die Einteilung sichtbar.
            </p>

            <section data-tour="verf-termine">
              <div className={styles.kopf}>Kommende Termine</div>
              <div className={styles.liste}>
                {(events.data ?? []).length === 0 && (
                  <div className={styles.leer}>Keine Termine in den nächsten Wochen.</div>
                )}
                {(events.data ?? []).map((ev) => {
                  const a = abwesenheitFuer(liste, ev.date);
                  return (
                    <div key={ev.id} className={styles.zeile}>
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
                })}
              </div>
            </section>

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
                {liste.map((a) => (
                  <div key={a.id} className={styles.zeile}>
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
                ))}
              </div>
            </section>
          </div>
        )}
      </Scroll>

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

/** Das Eintrage-Formular: bei einem Termin steht der Tag fest, sonst frei von/bis. */
export function AbsenceSheet({ entwurf, laeuft, onClose, onSubmit }: AbsenceSheetProps) {
  const festerTag = entwurf.art === 'termin' ? entwurf.event.date : '';
  const [von, setVon] = useState(festerTag);
  const [bis, setBis] = useState(festerTag);
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
