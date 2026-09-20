import { useEffect, useMemo, useState } from 'react';
import type { Absence, AbsenceEvent, NeueAbsence } from '@shared/types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar } from '../components/NavBar';
import { CenterMessage } from '../components/CenterMessage';
import { Icon } from '../components/icons';
import { Coachmarks } from '../components/Coachmarks';
import { MonatsLeiste } from '../components/MonatsLeiste';
import { AbsenceSheet, type Entwurf } from '../components/AbsenceSheet';
import { ZeitraumFrage } from '../components/ZeitraumFrage';
import {
  useAbsenceEvents,
  useAbsenceReasons,
  useCreateAbsence,
  useDeleteAbsence,
  useMyAbsences,
  useSaveAbsenceChanges,
  useUpdateAbsence,
} from '../hooks/useAvailability';
import {
  abwesenheitFuer,
  deckt,
  tagKurz,
  uhrzeit,
  wochentagLang,
  zeitraumKurz,
} from '../utils/absenceDatum';
import { heuteIso, plusTage, tagImMonat } from '../utils/wochen';
import { getAbwesenheitenFilter, setAbwesenheitenFilter } from '../utils/devicePrefs';
import { filtereTermine, knoepfeAus, umschalten, wirksameAuswahl } from '../utils/terminFilter';
import { useSiteConfig } from '../hooks/useSiteConfig';
import { letzterTag, monatLabel, monatNurKurz, monatPlus, monatVon } from '../utils/monate';
import { ApiError } from '../services/api';
import {
  TOUR_VERFUEGBARKEIT,
  VERFUEGBARKEIT_STEPS,
  isTourDone,
  markTourDone,
} from '../utils/onboarding';
import styles from './Availability.module.scss';

// Nicht exportiert (Fast Refresh mag nur Komponenten als Export) – wer die Zahlen braucht, liest sie hier.
/** Die Monatsleiste zeigt so viele Monate voraus; das Raster doppelt so viele. Termine werden bis dahin geholt. */
const VORAUS_MONATE = 6;
const RASTER_MONATE = 12;
/** So weit reicht „Einträge → Früher" zurück. */
const RUECKBLICK_TAGE = 365;

interface AvailabilityProps {
  /** Schreiben braucht Netz (ChurchTools). Lesen kommt aus dem Cache. */
  online: boolean;
  onToast: (text: string) => void;
  /** Nur für Tests: das „Heute" der Ansicht. */
  heute?: string;
}

type Seite = 'termine' | 'eintraege';
/** Was ein Kästchen zeigt: der Eintrag dahinter, ob er zum Löschen vorgemerkt ist, ob der Haken sitzt. */
interface Kasten {
  absence: Absence | undefined;
  soll: boolean;
  vorgemerkt: boolean;
}

/**
 * Abwesenheiten (#177). Aufbau nach acht Entwurfsrunden mit Alwin (18./19.09.2026), Vorbild ist die
 * kleine Abwesenheits-App, die das Musikteam gern benutzt – „an diesem Sonntag kann ich nicht" soll
 * ein Häkchen sein, kein Fenster:
 *
 *  1. **Monatsleiste** (`MonatsLeiste`): laufender Monat und sechs voraus, „Heute" zurück, der Pfeil
 *     klappt ein Jahr auf. Nur nach vorn – Vergangenes steht unter „Einträge → Früher".
 *  2. **Terminliste des Monats** mit einem **Abhakfeld** je Termin. Die Kästchen sind immer aktiv,
 *     aber ein Haken ist nur **vorgemerkt** (blauer Ring), bis man unten **Speichern** drückt – dann
 *     gehen alle Häkchen auf einmal nach ChurchTools (`useSaveAbsenceChanges`). Kein Bearbeiten-Modus:
 *     Alwins Frau wollte es wie im alten Planner – anfassen, dann speichern (19.09.2026).
 *  3. Ein Termin in einem **mehrtägigen** Zeitraum (Urlaub) lässt sich nicht stumm herausnehmen:
 *     `ZeitraumFrage` bietet „Zeitraum löschen" (vorgemerkt) oder „Zeitraum anpassen" (Fenster).
 *  4. Das **Plus** unten rechts trägt einen ganzen Zeitraum ein (`AbsenceSheet` mit Schnellwahl); es
 *     verschwindet, solange etwas vorgemerkt ist – dann ist die Speichern-Leiste der einzige Weg.
 *  5. **„Einträge"**: die eigenen Abwesenheiten, „Anstehend" und „Früher"; ein Tipp öffnet das Fenster
 *     zum Ändern und Löschen, Vergangenes nur zum Ansehen.
 *
 * Kopfleiste nur mit Titel, wie bei Termine und Lieder (Alwin, 19.09.2026).
 */
export function Availability({ online, onToast, heute = heuteIso() }: AvailabilityProps) {
  const laufend = monatVon(heute);
  const bisMonat = monatPlus(laufend, RASTER_MONATE - 1);
  const absences = useMyAbsences(true, plusTage(heute, -RUECKBLICK_TAGE), letzterTag(bisMonat));
  const events = useAbsenceEvents(true, letzterTag(bisMonat));
  const gruende = useAbsenceReasons(true);
  const anlegen = useCreateAbsence();
  const aendern = useUpdateAbsence();
  const loeschenEinzeln = useDeleteAbsence();
  const sichern = useSaveAbsenceChanges();
  // Die Termin-Arten des Admins (#400) – die Konfiguration ist ohnehin geladen (Branding).
  const site = useSiteConfig();

  const [seite, setSeite] = useState<Seite>('termine');
  const [monat, setMonat] = useState(laufend);
  const [frueher, setFrueher] = useState(false);
  /** Vorgemerkte Häkchen: Tag → gewünschter Zustand (true = abwesend). */
  const [pending, setPending] = useState<Record<string, boolean>>({});
  /** Vorgemerkt zu löschende Zeiträume (IDs). */
  const [loeschen, setLoeschen] = useState<number[]>([]);
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const [frage, setFrage] = useState<{ tag: string; absence: Absence } | null>(null);
  const [tour, setTour] = useState(false);
  /** Gewählte Termin-Art (#400) – vom Gerät gelesen, dorthin geschrieben; leer = alle. */
  const [filter, setFilter] = useState<string[]>(getAbwesenheitenFilter);

  useEffect(() => {
    if (!absences.isLoading && !events.isLoading && !isTourDone(TOUR_VERFUEGBARKEIT)) setTour(true);
  }, [absences.isLoading, events.isLoading]);

  const liste = useMemo(() => absences.data ?? [], [absences.data]);
  const alleEvents = useMemo(() => events.data ?? [], [events.data]);
  const anstehend = liste
    .filter((a) => a.endDate >= heute)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const frueherListe = liste
    .filter((a) => a.endDate < heute)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  /**
   * Der Termin-Filter (#400): Knöpfe gibt es nur, wenn es etwas zu wählen gibt – bei einer einzigen
   * Art wäre eine Reihe mit einem Knopf eine Frage ohne Antwort. Die Auswahl wirkt auf die Liste
   * UND auf die Zahl daneben; die vorgemerkten Häkchen hängen am Tag, nicht an der Liste, und
   * überstehen jeden Filterwechsel. Die Regeln stehen in `terminFilter.ts`.
   */
  const arten = site.data.terminArten ?? [];
  const knoepfe = useMemo(() => knoepfeAus(arten, alleEvents), [arten, alleEvents]);
  const auswahl = wirksameAuswahl(filter, knoepfe);
  const waehleArt = (id: string | null): void => {
    const neu = id === null ? [] : umschalten(auswahl, id, knoepfe);
    setFilter(neu);
    setAbwesenheitenFilter(neu);
  };
  const monatEvents = filtereTermine(
    alleEvents.filter((e) => monatVon(e.date) === monat && e.date >= heute),
    auswahl,
    arten,
  );

  // Monate mit Einträgen – der rote Punkt im Raster. Ein Zeitraum kann mehrere Monate berühren.
  const markiert = useMemo(() => {
    const s = new Set<string>();
    for (const a of anstehend) {
      for (let m = monatVon(a.startDate); m <= monatVon(a.endDate); m = monatPlus(m, 1)) s.add(m);
    }
    return s;
  }, [anstehend]);

  const anzahl = Object.keys(pending).length + loeschen.length;

  const meldeFehler = (e: unknown, sonst: string): void => {
    onToast(e instanceof ApiError ? e.message : sonst);
  };

  /* ---------------------------------------------------------------- Häkchen (vorgemerkt) */

  const kasten = (tag: string): Kasten => {
    const absence = abwesenheitFuer(liste, tag);
    const weg = absence !== undefined && loeschen.includes(absence.id);
    const soll = weg ? false : tag in pending ? pending[tag] : absence !== undefined;
    return { absence, soll, vorgemerkt: tag in pending || weg };
  };

  const haken = (tag: string): void => {
    if (!online) return onToast('Zum Ändern brauchst du Netz.');
    const a = abwesenheitFuer(liste, tag);
    if (a && a.startDate !== a.endDate) {
      // Teil eines Zeitraums: entweder die vorgemerkte Löschung zurücknehmen – oder nachfragen.
      if (loeschen.includes(a.id)) setLoeschen((l) => l.filter((id) => id !== a.id));
      else setFrage({ tag, absence: a });
      return;
    }
    const ist = a !== undefined;
    const soll = tag in pending ? !pending[tag] : !ist;
    setPending((p) => {
      const n = { ...p };
      if (soll === ist) delete n[tag];
      else n[tag] = soll;
      return n;
    });
  };

  const verwerfen = (): void => {
    setPending({});
    setLoeschen([]);
  };

  const speichernAlles = (): void => {
    const eintragen = Object.entries(pending)
      .filter(([, soll]) => soll)
      .map(([tag]) => tag);
    const weg = [
      ...loeschen,
      ...Object.entries(pending)
        .filter(([, soll]) => !soll)
        .map(([tag]) => abwesenheitFuer(liste, tag)?.id)
        .filter((id): id is number => id !== undefined),
    ];
    sichern.mutate(
      { eintragen, loeschen: weg },
      {
        onSuccess: (n) => {
          verwerfen();
          onToast(
            `${n} ${n === 1 ? 'Änderung' : 'Änderungen'} gespeichert – steht jetzt in ChurchTools.`,
          );
        },
        onError: (e) => meldeFehler(e, 'Konnte nicht gespeichert werden – bitte noch einmal.'),
      },
    );
  };

  /* ---------------------------------------------------------------- Fenster (Zeitraum, Ändern) */

  const speichernFenster = (neu: NeueAbsence): void => {
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
    loeschenEinzeln.mutate(a.id, {
      onSuccess: () => {
        setEntwurf(null);
        onToast('Gelöscht.');
      },
      onError: (e) => meldeFehler(e, 'Konnte nicht gelöscht werden.'),
    });
  };

  const zeitraumOeffnen = (): void => {
    if (!online) return onToast('Zum Eintragen brauchst du Netz.');
    const naechster = alleEvents.find((e) => e.date >= heute)?.date ?? heute;
    setEntwurf({ art: 'neu', tag: naechster });
  };

  const laedt = absences.isLoading || events.isLoading;
  const fehler = absences.isError || events.isError;
  const neuLaden = (): void => {
    void absences.refetch();
    void events.refetch();
  };

  /* ---------------------------------------------------------------- Zeilen */

  const datumKachel = (tag: string, dritteZeile: string, ton: 'blau' | 'rot' | 'grau') => (
    <div
      className={`${styles.datum}${ton === 'rot' ? ' ' + styles.datumRot : ton === 'grau' ? ' ' + styles.datumGrau : ''}`}
      aria-hidden="true"
    >
      <b>{tagImMonat(tag)}</b>
      <small>{monatNurKurz(monatVon(tag))}.</small>
      <em>{dritteZeile}</em>
    </div>
  );

  const terminZeile = (ev: AbsenceEvent) => {
    const k = kasten(ev.date);
    const a = k.absence;
    const ct = a !== undefined && !a.vonApp;
    const teil = a !== undefined && a.startDate !== a.endDate;
    return (
      <div key={`ev-${ev.id}`} className={styles.zeile}>
        {datumKachel(ev.date, uhrzeit(ev.startDate), k.soll ? (ct ? 'grau' : 'rot') : 'blau')}
        <div className={styles.text}>
          <span className={styles.titel}>{ev.name}</span>
          <span className={styles.sub}>
            {wochentagLang(ev.date)}
            {a && k.soll
              ? ` · ${a.reason ?? 'Abwesend'}${teil ? ` · ${zeitraumKurz(a)}` : ''}`
              : ''}
          </span>
        </div>
        <button
          className={`${styles.kasten}${k.soll ? ' ' + styles.kastenAn : ''}${ct && k.soll ? ' ' + styles.kastenCt : ''}${k.vorgemerkt ? ' ' + styles.vorgemerkt : ''}`}
          aria-pressed={k.soll}
          aria-label={`Abwesend – ${ev.name}, ${tagKurz(ev.date)}`}
          disabled={!online || sichern.isPending}
          onClick={() => haken(ev.date)}
        >
          <span className={styles.box}>{k.soll ? '✓' : ''}</span>
          Abwesend
        </button>
      </div>
    );
  };

  const abwesenheitZeile = (a: Absence, vergangen: boolean) => {
    const trifft = vergangen ? [] : alleEvents.filter((e) => deckt(a, e.date));
    return (
      <button
        key={`ab-${a.id}`}
        className={`${styles.zeile} ${styles.zeileTip}${vergangen ? ' ' + styles.vergangen : ''}`}
        disabled={!online && !vergangen}
        onClick={() => setEntwurf({ art: 'aendern', absence: a })}
        aria-label={`Abwesenheit ${zeitraumKurz(a)} ${vergangen ? 'ansehen' : 'ändern'}`}
      >
        {datumKachel(a.startDate, tagKurz(a.startDate).slice(0, 2), a.vonApp ? 'rot' : 'grau')}
        <div className={styles.text}>
          <span className={styles.titel}>
            {a.reason ?? 'Abwesend'}
            {a.startDate !== a.endDate ? ` · ${zeitraumKurz(a)}` : ''}
          </span>
          <span className={styles.sub}>
            {[
              trifft.length
                ? `trifft ${trifft.map((e) => tagKurz(e.date)).join(', ')}`
                : vergangen
                  ? ''
                  : 'trifft keinen Termin',
              a.comment,
              a.vonApp ? '' : 'in ChurchTools eingetragen',
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
        <span className={styles.chev}>
          <Icon name="chev-right" size={18} />
        </span>
      </button>
    );
  };

  /** Einträge nach Monat gruppiert – die Reihenfolge der Liste bleibt (anstehend aufwärts, früher abwärts). */
  const gruppiert = (eintraege: Absence[]) => {
    const monate = [...new Set(eintraege.map((a) => monatVon(a.startDate)))];
    return monate.map((m) => ({
      monat: m,
      eintraege: eintraege.filter((a) => monatVon(a.startDate) === m),
    }));
  };

  const termineSeite = (
    <>
      <MonatsLeiste
        heute={heute}
        monat={monat}
        onMonat={setMonat}
        markiert={markiert}
        voraus={VORAUS_MONATE}
        rasterMonate={RASTER_MONATE}
      />
      {knoepfe.length > 1 && (
        <div
          className={styles.chips}
          data-tour="verf-filter"
          role="group"
          aria-label="Termin-Arten"
        >
          <button
            className={`${styles.chip}${auswahl.length === 0 ? ' ' + styles.chipAn : ''}`}
            aria-pressed={auswahl.length === 0}
            onClick={() => waehleArt(null)}
          >
            Alle
          </button>
          {knoepfe.map((k) => (
            <button
              key={k.id}
              className={`${styles.chip}${auswahl.includes(k.id) ? ' ' + styles.chipAn : ''}`}
              aria-pressed={auswahl.includes(k.id)}
              onClick={() => waehleArt(k.id)}
            >
              {k.name}
            </button>
          ))}
        </div>
      )}
      <section data-tour="verf-termine">
        <div className={styles.sec}>
          {monatLabel(monat)}
          <span>
            {monatEvents.length} {monatEvents.length === 1 ? 'Termin' : 'Termine'}
          </span>
        </div>
        <div className={styles.liste}>
          {monatEvents.length === 0 && (
            <div className={styles.leer}>Kein Termin mehr in diesem Monat.</div>
          )}
          {monatEvents.map(terminZeile)}
        </div>
      </section>
      {/**
       * Der Halbsatz beantwortet die Frage, die Alwin am 05.09.2026 beim Durchklicken hatte: „Sind
       * das die Termine, bei denen ich eingetragen bin?" Nein – es sind ALLE, die das Konto in
       * ChurchTools sehen darf. Wer welchen Dienst hat, weiß die App nicht (Dienst-Einteilung ist Phase 2).
       */}
      <p className={styles.hinweis}>
        Alle Termine aus ChurchTools – wer eingeteilt ist, spielt hier keine Rolle. Ein Haken wird
        erst mit „Speichern" eingetragen.
      </p>
    </>
  );

  const eintraegeListe = frueher ? frueherListe : anstehend;
  const eintraegeSeite = (
    <>
      <div className={styles.seg} role="group" aria-label="Zeitraum">
        <button
          className={`${styles.segBtn}${!frueher ? ' ' + styles.segAn : ''}`}
          aria-pressed={!frueher}
          onClick={() => setFrueher(false)}
        >
          Anstehend ({anstehend.length})
        </button>
        <button
          className={`${styles.segBtn}${frueher ? ' ' + styles.segAn : ''}`}
          aria-pressed={frueher}
          onClick={() => setFrueher(true)}
        >
          Früher ({frueherListe.length})
        </button>
      </div>
      {eintraegeListe.length === 0 ? (
        <div className={styles.leerBox}>
          <b>{frueher ? 'Nichts in der Vergangenheit.' : 'Noch nichts eingetragen.'}</b>
          {frueher
            ? 'Was du einträgst, bleibt hier ein Jahr lang stehen.'
            : 'Unter „Termine" ein Kästchen abhaken – oder über das Plus einen Zeitraum eintragen.'}
        </div>
      ) : (
        gruppiert(eintraegeListe).map((g) => (
          <section key={g.monat}>
            <div className={styles.sec}>{monatLabel(g.monat)}</div>
            <div className={styles.liste}>
              {g.eintraege.map((a) => abwesenheitZeile(a, frueher))}
            </div>
          </section>
        ))
      )}
      {!frueher && eintraegeListe.length > 0 && (
        <p className={styles.hinweis}>
          Tipp auf eine Zeile: Zeitraum, Grund oder Kommentar ändern, löschen. Auch Einträge, die du
          direkt in ChurchTools gemacht hast – vor dem Löschen fragt die App dann nach.
        </p>
      )}
    </>
  );

  return (
    <Screen>
      <NavBar title="Abwesenheiten" />
      <Scroll onRefresh={neuLaden}>
        {laedt ? (
          <CenterMessage loading text="Wird geladen…" />
        ) : fehler ? (
          <CenterMessage icon="⚠️" text="Konnte nicht geladen werden." onRetry={neuLaden} />
        ) : (
          <div className={styles.wrap}>
            <div className={styles.seg} role="group" aria-label="Ansicht">
              <button
                className={`${styles.segBtn}${seite === 'termine' ? ' ' + styles.segAn : ''}`}
                aria-pressed={seite === 'termine'}
                onClick={() => setSeite('termine')}
              >
                Termine
              </button>
              <button
                className={`${styles.segBtn}${seite === 'eintraege' ? ' ' + styles.segAn : ''}`}
                aria-pressed={seite === 'eintraege'}
                onClick={() => setSeite('eintraege')}
              >
                Einträge
                {anstehend.length > 0 && <span className={styles.zaehler}>{anstehend.length}</span>}
              </button>
            </div>
            {seite === 'termine' ? termineSeite : eintraegeSeite}
          </div>
        )}
      </Scroll>

      {anzahl > 0 ? (
        <div className={styles.leiste} role="status">
          <button className={styles.verwerfen} onClick={verwerfen} disabled={sichern.isPending}>
            Verwerfen
          </button>
          <span className={styles.leisteInfo}>
            {anzahl} {anzahl === 1 ? 'Änderung' : 'Änderungen'} vorgemerkt
          </span>
          <button
            className={styles.speichern}
            onClick={speichernAlles}
            disabled={sichern.isPending}
          >
            {sichern.isPending ? 'Speichert …' : 'Speichern'}
          </button>
        </div>
      ) : (
        !laedt &&
        !fehler && (
          <button
            className={styles.plus}
            data-tour="verf-plus"
            aria-label="Zeitraum eintragen"
            disabled={!online}
            onClick={zeitraumOeffnen}
          >
            <Icon name="plus" size={26} stroke={2.2} />
          </button>
        )
      )}

      {entwurf && (
        <AbsenceSheet
          entwurf={entwurf}
          heute={heute}
          laeuft={anlegen.isPending || aendern.isPending}
          loeschtGerade={loeschenEinzeln.isPending}
          gruende={gruende.data ?? []}
          standardGrund={gruende.data?.find((g) => g.standard)?.id ?? null}
          nurLesen={entwurf.art === 'aendern' && entwurf.absence.endDate < heute}
          onClose={() => setEntwurf(null)}
          onSubmit={speichernFenster}
          onDelete={entfernen}
        />
      )}

      {frage && (
        <ZeitraumFrage
          tag={frage.tag}
          absence={frage.absence}
          onLoeschen={() => {
            setLoeschen((l) => (l.includes(frage.absence.id) ? l : [...l, frage.absence.id]));
            setFrage(null);
          }}
          onAnpassen={() => {
            setEntwurf({ art: 'aendern', absence: frage.absence });
            setFrage(null);
          }}
          onClose={() => setFrage(null)}
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
