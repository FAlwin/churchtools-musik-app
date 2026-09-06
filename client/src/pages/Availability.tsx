import { useEffect, useMemo, useState } from 'react';
import type { Absence, AbsenceEvent, NeueAbsence } from '@shared/types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar } from '../components/NavBar';
import { CenterMessage } from '../components/CenterMessage';
import { Icon } from '../components/icons';
import { Coachmarks } from '../components/Coachmarks';
import { WochenStreifen } from '../components/WochenStreifen';
import { AbsenceSheet, type Entwurf } from '../components/AbsenceSheet';
import {
  useAbsenceEvents,
  useCreateAbsence,
  useDeleteAbsence,
  useMyAbsences,
  useUpdateAbsence,
} from '../hooks/useAvailability';
import { abwesenheitFuer, deckt, tagKurz, uhrzeit, zeitraumKurz } from '../utils/absenceDatum';
import { heuteIso, plusTage, wochenAb } from '../utils/wochen';
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
/** So viele kommende Termine stehen im Statuskopf als Balken. */
const BALKEN = 5;

interface AvailabilityProps {
  /** Schreiben braucht Netz (ChurchTools). Lesen kommt aus dem Cache. */
  online: boolean;
  onToast: (text: string) => void;
  /** Nur für Tests: das „Heute" des Streifens. */
  heute?: string;
}

/**
 * Verfügbarkeit (#177). Aufbau nach Alwins Durchklick der anfassbaren Entwürfe (05.09.2026):
 *
 *  1. **Statuskopf** – „Nächster Gottesdienst … du bist verfügbar" mit „Kann nicht" direkt daneben.
 *     Der Bildschirm sagt damit etwas, statt nur Daten zu zeigen (Alwins „irgendwie fehlt noch was").
 *  2. **Wochenstreifen**, der am Finger klebt (siehe `WochenStreifen`).
 *  3. **„Diese Woche"** – Termine und Abwesenheiten der gezeigten Woche, nach Datum gemischt.
 *  4. **„Meine Abwesenheiten"** – jede eigene Zeile ist antippbar und öffnet „Abwesenheit ändern"
 *     (Von, Bis, Kommentar, Löschen). Manuelle ChurchTools-Einträge tragen ein Schloss.
 *
 * Ein Zeitraum entsteht über **ein** Fenster mit Schnellwahl („Nur dieser Tag / Wochenende / 1 Woche
 * / 2 Wochen") – aufgerufen über den Knopf „Eintragen" oder einen Tipp auf einen Tag im Streifen.
 * Die frühere Auswahlleiste am unteren Rand ist weg; sie war fummelig und ein Schritt zu viel.
 */
export function Availability({ online, onToast, heute = heuteIso() }: AvailabilityProps) {
  const absences = useMyAbsences(true);
  const events = useAbsenceEvents(true, WOCHEN);
  const anlegen = useCreateAbsence();
  const aendern = useUpdateAbsence();
  const loeschen = useDeleteAbsence();
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const [tour, setTour] = useState(false);
  const wochen = useMemo(() => wochenAb(heute, WOCHEN), [heute]);
  const [wocheIdx, setWocheIdx] = useState(0);

  useEffect(() => {
    if (!absences.isLoading && !events.isLoading && !isTourDone(TOUR_VERFUEGBARKEIT)) setTour(true);
  }, [absences.isLoading, events.isLoading]);

  const liste = absences.data ?? [];
  const alleEvents = events.data ?? [];
  const montag = wochen[wocheIdx];
  const sonntag = plusTage(montag, 6);
  const wocheEvents = alleEvents.filter((e) => montag <= e.date && e.date <= sonntag);
  const wocheAbwesenheiten = liste.filter((a) => a.startDate <= sonntag && montag <= a.endDate);
  const naechster = alleEvents.find((e) => e.date >= heute);

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

  const speichern = (neu: NeueAbsence): void => {
    const id = entwurf?.art === 'aendern' ? entwurf.absence.id : null;
    const fertig = (text: string) => () => {
      setEntwurf(null);
      onToast(text);
    };
    if (id === null) {
      anlegen.mutate(neu, {
        onSuccess: fertig('Eingetragen – steht jetzt als Abwesenheit in ChurchTools.'),
        onError: (e) => meldeFehler(e, 'Konnte nicht eingetragen werden.'),
      });
    } else {
      aendern.mutate(
        { id, neu },
        {
          onSuccess: fertig('Geändert.'),
          onError: (e) => meldeFehler(e, 'Konnte nicht geändert werden.'),
        },
      );
    }
  };

  const entfernen = (a: Absence): void => {
    loeschen.mutate(a.id, {
      onSuccess: () => {
        setEntwurf(null);
        onToast('Gelöscht.');
      },
      onError: (e) => meldeFehler(e, 'Konnte nicht gelöscht werden.'),
    });
  };

  const eintragenOeffnen = (tag: string): void => {
    if (!online) return onToast('Zum Eintragen brauchst du Netz.');
    setEntwurf({ art: 'neu', tag });
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
            onClick={() => eintragenOeffnen(ev.date)}
          >
            Kann nicht
          </button>
        )}
      </div>
    );
  };

  /**
   * Eine Abwesenheitszeile. Eigene sind **ganz** antippbar und öffnen „Abwesenheit ändern" – ein
   * großes Ziel statt zweier kleiner Symbole (Alwins Wahl aus drei Entwürfen). Löschen sitzt in
   * diesem Fenster, wo auch der Zeitraum steht.
   */
  const abwesenheitZeile = (a: Absence) =>
    a.eigene ? (
      <button
        key={`ab-${a.id}`}
        className={`${styles.zeile} ${styles.zeileTip}`}
        disabled={!online}
        onClick={() => setEntwurf({ art: 'aendern', absence: a })}
        aria-label={`Abwesenheit ${zeitraumKurz(a)} ändern`}
      >
        <div className={styles.text}>
          <span className={styles.titel}>{zeitraumKurz(a)}</span>
          <span className={styles.sub}>{a.comment || 'Musikteam'}</span>
        </div>
        <Icon name="chev-right" size={18} />
      </button>
    ) : (
      <div key={`ab-${a.id}`} className={styles.zeile}>
        <div className={styles.text}>
          <span className={styles.titel}>{zeitraumKurz(a)}</span>
          <span className={styles.sub}>{a.comment || a.reason || 'ChurchTools'}</span>
        </div>
        <span className={styles.gesperrt} title="Nur in ChurchTools änderbar">
          <Icon name="lock" size={14} /> ChurchTools
        </span>
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
            <StatusKopf
              termin={naechster}
              absence={naechster ? abwesenheitFuer(liste, naechster.date) : undefined}
              kommende={alleEvents.filter((e) => e.date >= heute).slice(0, BALKEN)}
              absences={liste}
              online={online}
              onAbmelden={eintragenOeffnen}
              onZurueck={zuruecknehmen}
            />

            <WochenStreifen
              wochen={wochen}
              index={wocheIdx}
              onIndex={setWocheIdx}
              heute={heute}
              events={alleEvents}
              absences={liste}
              onTag={eintragenOeffnen}
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

            <section data-tour="verf-liste">
              <div className={styles.kopf}>
                <span>Meine Abwesenheiten</span>
                <button
                  className={styles.neu}
                  disabled={!online}
                  onClick={() => eintragenOeffnen(heute)}
                  data-tour="verf-zeitraum"
                  /* Eindeutiger Name: Im geöffneten Fenster heißt der Knopf ebenfalls „Eintragen". */
                  aria-label="Abwesenheit eintragen"
                >
                  <Icon name="plus" size={16} /> Eintragen
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

      {entwurf && (
        <AbsenceSheet
          entwurf={entwurf}
          heute={heute}
          laeuft={anlegen.isPending || aendern.isPending}
          loeschtGerade={loeschen.isPending}
          onClose={() => setEntwurf(null)}
          onSubmit={speichern}
          onDelete={entfernen}
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

interface StatusKopfProps {
  termin?: AbsenceEvent;
  absence?: Absence;
  kommende: AbsenceEvent[];
  absences: Absence[];
  online: boolean;
  onAbmelden: (tag: string) => void;
  onZurueck: (a: Absence) => void;
}

/**
 * Der Kopf sagt in einem Satz, worum es geht: **nächster Termin und ob du da bist** – mit der Aktion
 * direkt daneben (Alwins Wahl aus drei Entwürfen, 05.09.2026). Die Balken darunter sind die nächsten
 * fünf Termine: blau = da, rot = abgemeldet, grau = in ChurchTools abwesend.
 */
export function StatusKopf({
  termin,
  absence,
  kommende,
  absences,
  online,
  onAbmelden,
  onZurueck,
}: StatusKopfProps) {
  if (!termin) {
    return (
      <div className={styles.status}>
        <span className={styles.statusKreis}>🎸</span>
        <div className={styles.text}>
          <span className={styles.titel}>Keine Termine in den nächsten Wochen</span>
          <span className={styles.sub}>Sobald welche anstehen, siehst du sie hier.</span>
        </div>
      </div>
    );
  }
  const abgemeldet = absence?.eigene === true;
  const gesperrt = absence !== undefined && !absence.eigene;
  return (
    <div className={`${styles.status}${absence ? ' ' + styles.statusWeg : ''}`}>
      <span className={styles.statusKreis}>{absence ? '🚫' : '🎸'}</span>
      <div className={styles.text}>
        <span className={styles.titel}>
          {tagKurz(termin.date)}
          {uhrzeit(termin.startDate) ? ` · ${uhrzeit(termin.startDate)}` : ''}
        </span>
        <span className={styles.sub}>
          {gesperrt
            ? `${termin.name} – in ChurchTools als abwesend eingetragen`
            : abgemeldet
              ? `${termin.name} – du bist abgemeldet`
              : `${termin.name} – du bist verfügbar`}
        </span>
        <span className={styles.balken} aria-hidden>
          {kommende.map((e) => {
            const a = abwesenheitFuer(absences, e.date);
            return (
              <i key={e.id} className={a?.eigene ? styles.balkenRot : a ? styles.balkenGrau : ''} />
            );
          })}
        </span>
      </div>
      {gesperrt ? (
        <span className={styles.gesperrt} title="In ChurchTools eingetragen">
          <Icon name="lock" size={14} />
        </span>
      ) : abgemeldet ? (
        <button
          className={`${styles.aktion} ${styles.gesetzt}`}
          disabled={!online}
          onClick={() => absence && onZurueck(absence)}
          aria-label={`Abmeldung für ${termin.name} am ${tagKurz(termin.date)} zurücknehmen`}
        >
          Abgemeldet
        </button>
      ) : (
        <button
          className={styles.aktion}
          disabled={!online}
          onClick={() => onAbmelden(termin.date)}
        >
          Kann nicht
        </button>
      )}
    </div>
  );
}
