import { useCallback, useEffect, useRef } from 'react';
import { isPulsable } from '../utils/bpmPulse';
import {
  beatTimeSec,
  beatsPerBar,
  countInDone,
  einzaehlStart,
  erstesSchlagAb,
  isAccent,
} from '../utils/metronome';

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
 *
 * **Gemeinsames Raster mit dem sichtbaren Puls.** Beide hatten ihre eigene Uhr – der Puls
 * `performance.now()`, der Klick die Audio-Uhr, die beim Erzeugen des Kontexts bei null anfängt.
 * Wer sie nacheinander einschaltete, bekam zwei Nullpunkte und damit zwei Takte; gemeldet nach dem
 * Staging-Test. Jetzt bekommt der Klick den Nullpunkt des Rasters (`taktStartMs`, in
 * `performance.now()`-Zeit) und rechnet ihn auf seine eigene Uhr um.
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
  /**
   * Nullpunkt des gemeinsamen Takt-Rasters in `performance.now()`-Millisekunden. `null` heißt „noch
   * keins" – dann beginnt der Klick bei sich selbst.
   */
  taktStartMs: number | null;
  /** Wird gerufen, wenn der Klick von selbst endet (Einzählen fertig) – die Anzeige zieht nach. */
  onEnde?: () => void;
}

/**
 * Den Nullpunkt des Rasters auf die Audio-Uhr umrechnen.
 *
 * `getOutputTimestamp()` liefert beide Uhren im selben Augenblick und ist damit der genaue Weg.
 * Wo es fehlt (ältere Safari-Stände), wird der Zusammenhang aus den beiden Werten gebildet, die
 * unmittelbar nacheinander gelesen werden – ein paar Millisekunden Ungenauigkeit, aber kein
 * Auseinanderdriften: Der Versatz wird EINMAL bestimmt, nicht je Schlag.
 */
function audioZeitFuer(ctx: AudioContext, perfMs: number): number {
  const stempel = ctx.getOutputTimestamp?.();
  if (stempel && typeof stempel.contextTime === 'number' && stempel.performanceTime) {
    return stempel.contextTime + (perfMs - stempel.performanceTime) / 1000;
  }
  return ctx.currentTime + (perfMs - performance.now()) / 1000;
}

export function useMetronome({ bpm, timeSig, modus, taktStartMs, onEnde }: UseMetronomeArgs): void {
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

    const proTakt = beatsPerBar(timeSig);

    // Nullpunkt des gemeinsamen Rasters auf der Audio-Uhr. Ohne Raster (Klick als Erstes
    // eingeschaltet) ist es der jetzige Augenblick, mit kleinem Vorlauf, damit der erste Klick nicht
    // abgeschnitten wird.
    const rasterNull =
      taktStartMs === null ? ctx.currentTime + 0.05 : audioZeitFuer(ctx, taktStartMs);

    // In ein LAUFENDES Raster einsteigen: erst der nächste noch nicht vergangene Schlag. Beim
    // Einzählen zusätzlich auf den nächsten Taktanfang – „eins, zwei, drei, vier" ergibt nur ab
    // einer Eins einen Sinn.
    const verstrichenMs = Math.max(0, (ctx.currentTime + 0.05 - rasterNull) * 1000);
    const abSchlag = erstesSchlagAb(verstrichenMs, bpm);
    const ersterSchlag = modus === 'einzaehlen' ? einzaehlStart(abSchlag, proTakt) : abSchlag;

    let naechster = ersterSchlag; // Index des nächsten noch NICHT eingeplanten Schlags
    let beendet = false;

    const planen = () => {
      if (beendet) return;
      while (rasterNull + beatTimeSec(naechster, bpm) < ctx.currentTime + VORLAUF_S) {
        if (
          countInDone(
            naechster,
            timeSig,
            modus === 'einzaehlen' ? 'einzaehlen' : 'dauerhaft',
            ersterSchlag,
          )
        ) {
          beendet = true;
          endeRef.current?.();
          return;
        }
        klick(ctx, rasterNull + beatTimeSec(naechster, bpm), isAccent(naechster, proTakt));
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
  }, [laeuft, bpm, timeSig, modus, taktStartMs, klick]);
}
