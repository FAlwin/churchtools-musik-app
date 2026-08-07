import { useCallback, useEffect, useRef } from 'react';
import { isPulsable } from '../utils/bpmPulse';
import { beatTimeSec, beatsPerBar, countInDone, isAccent } from '../utils/metronome';

/**
 * Der hörbare Klick (#145 Folge-Wunsch) – geplant auf der **Audio-Uhr**, nicht auf dem Bildtakt.
 *
 * **Warum nicht wie der sichtbare Puls:** Der läuft über `requestAnimationFrame`. Ein um zehn
 * Millisekunden verspäteter Frame fällt dem Auge nicht auf – dem Ohr sofort. Deshalb werden die
 * Klicks im Voraus auf der Uhr des Audio-Systems eingeplant („lookahead scheduling"): Alle 25 ms
 * schaut ein Timer nach, welche Schläge in den nächsten 100 ms fallen, und meldet sie an. Ob der
 * Timer dabei mal 40 ms zu spät kommt, ist gleichgültig – die Klänge liegen schon fest.
 *
 * **Der Klang** entsteht aus einem kurzen Sinus mit schnellem Ausklang, die betonte Eins eine
 * Oktave höher und etwas lauter. Kein Nachladen einer Datei: Das funktioniert offline und braucht
 * keine Zusatzdatei im Bündel.
 *
 * **iOS:** Ton startet erst nach einer Berührung – der Tipp auf den Schalter liefert sie. Der
 * physische Stummschalter des Geräts kann Web-Audio trotzdem stummschalten; das ist eine Eigenheit
 * von iOS und lässt sich aus der App heraus nicht umgehen.
 */

/** Wie weit im Voraus geplant wird. Großzügig genug, um einen verschluckten Timer zu überbrücken. */
const VORLAUF_S = 0.1;
/** Wie oft nachgesehen wird, ob etwas einzuplanen ist. */
const PRUEF_MS = 25;
/** Dauer eines Klicks. Kurz – es soll ticken, nicht piepen. */
const KLICK_S = 0.03;

export type KlickModus = 'aus' | 'einzaehlen' | 'dauerhaft';

interface UseMetronomeArgs {
  bpm: number | null;
  timeSig: string | null;
  modus: KlickModus;
  /** Wird gerufen, wenn der Klick von selbst endet (Einzählen fertig) – die Anzeige zieht nach. */
  onEnde?: () => void;
}

export function useMetronome({ bpm, timeSig, modus, onEnde }: UseMetronomeArgs): void {
  // Der Rückruf darf sich ändern, ohne den laufenden Takt neu aufzubauen.
  const endeRef = useRef(onEnde);
  endeRef.current = onEnde;

  const laeuft = modus !== 'aus' && isPulsable(bpm);

  /** Einen einzelnen Klick zur Zeit `zeit` (Audio-Uhr) einplanen. */
  const klick = useCallback((ctx: AudioContext, zeit: number, betont: boolean) => {
    const ton = ctx.createOscillator();
    const huelle = ctx.createGain();
    ton.frequency.value = betont ? 1600 : 800;
    // Sehr kurzer Ausklang statt hartem Abschalten – sonst knackt es.
    huelle.gain.setValueAtTime(betont ? 0.5 : 0.3, zeit);
    huelle.gain.exponentialRampToValueAtTime(0.001, zeit + KLICK_S);
    ton.connect(huelle).connect(ctx.destination);
    ton.start(zeit);
    ton.stop(zeit + KLICK_S);
  }, []);

  useEffect(() => {
    if (!laeuft) return;

    const Ctx =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return; // kein Web-Audio → stiller Betrieb, der sichtbare Puls läuft weiter
    const ctx = new Ctx();
    // iOS/Safari starten angehalten; der Tipp auf den Schalter ist die nötige Berührung.
    void ctx.resume();

    const start = ctx.currentTime + 0.05; // kleiner Vorlauf, damit der erste Klick nicht abgeschnitten wird
    const proTakt = beatsPerBar(timeSig);
    let naechster = 0; // Index des nächsten noch NICHT eingeplanten Schlags
    let beendet = false;

    const planen = () => {
      if (beendet) return;
      while (start + beatTimeSec(naechster, bpm) < ctx.currentTime + VORLAUF_S) {
        if (countInDone(naechster, timeSig, modus === 'einzaehlen' ? 'einzaehlen' : 'dauerhaft')) {
          beendet = true;
          endeRef.current?.();
          return;
        }
        klick(ctx, start + beatTimeSec(naechster, bpm), isAccent(naechster, proTakt));
        naechster++;
      }
    };
    planen();
    const timer = window.setInterval(planen, PRUEF_MS);

    return () => {
      beendet = true;
      window.clearInterval(timer);
      // Schließen statt nur anhalten: Ein offener AudioContext hält auf manchen Geräten die
      // Audio-Einheit wach und kostet Strom. Bereits eingeplante Klicks verstummen dabei.
      void ctx.close();
    };
  }, [laeuft, bpm, timeSig, modus, klick]);
}
