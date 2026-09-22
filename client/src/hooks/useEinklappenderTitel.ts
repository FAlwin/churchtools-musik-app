import { useCallback, useEffect, useRef, useState } from 'react';

/** Ab diesem sichtbaren Anteil der Überschrift klappt der Titel wieder aus (siehe Hysterese unten). */
export const AUSKLAPPEN_AB = 0.7;

/**
 * **Große Überschrift im Inhalt, die beim Scrollen in die Leiste einklappt.**
 *
 * Das Muster kennt jeder von iOS (Mail, Einstellungen, WhatsApp): Oben steht der Titel groß im
 * Inhalt, beim Hochschieben wandert er klein in die Leiste. Alwin hat es am 22.09.2026 genau so
 * gewünscht, mit Screenshots aus WhatsApp.
 *
 * **Warum wir es überhaupt brauchen:** iOS 26/27 legt über die oberen rund 95 Punkte des Bildschirms
 * ein Unschärfe-Band (Liquid Glass, siehe `client/index.html`). Text darin wird weich. Eine feste
 * Kopfzeile mit Titel muss dem Band ausweichen und kostet dadurch Höhe – zu viel, wie sich zeigte.
 * Mit diesem Muster liegt im Band nur die ruhige Fläche der Leiste: Der Titel steht darunter, und
 * der Platz dafür gehört dem Inhalt, verschwindet beim Scrollen also wieder.
 *
 * **Eine Einschränkung, die bleibt:** Der eingeklappte Titel in der Leiste liegt selbst im Band und
 * kann leicht weich wirken. Native Apps wie WhatsApp bekommen dort eine Ausnahme vom System, eine
 * Web-App nicht. Er ist klein, fett und nur beim Scrollen zu sehen – bewusst hingenommen.
 *
 * Beobachtet wird die Überschrift selbst, nicht die Scroll-Position: Ein `IntersectionObserver`
 * kostet beim Scrollen nichts, ein `scroll`-Handler feuert auf jedem Frame.
 */
export function useEinklappenderTitel(leistenhoehe = 56) {
  const [eingeklappt, setEingeklappt] = useState(false);
  const beobachter = useRef<IntersectionObserver | null>(null);

  useEffect(() => () => beobachter.current?.disconnect(), []);

  /**
   * An die große Überschrift hängen. Callback-Ref, weil das Element beim Tab-Wechsel neu entsteht –
   * mit `useRef` + `useEffect` liefe der Beobachter dann auf einem Element, das nicht mehr im
   * Dokument hängt, und bliebe für immer auf „eingeklappt" stehen.
   */
  const refUeberschrift = useCallback(
    (el: HTMLElement | null) => {
      beobachter.current?.disconnect();
      if (!el) return;
      if (typeof IntersectionObserver === 'undefined') {
        // Ältere Umgebungen ohne Beobachter: Der Titel in der Leiste bleibt dauerhaft sichtbar –
        // lieber doppelt (Leiste + große Überschrift) als beim Scrollen gar keiner. Der erste
        // Entwurf setzte hier `false` und blendete ihn aus; der Test hat es gefangen.
        setEingeklappt(true);
        return;
      }
      beobachter.current = new IntersectionObserver(
        ([eintrag]) => {
          // **Hysterese, kein Kippschalter.** Die Leiste wächst beim Einklappen um einige Punkte
          // (NavBar.module.scss, damit der kleine Titel unter dem Unschärfe-Band von iOS liegt).
          // Dadurch rutscht der Inhalt nach unten – und die Überschrift käme wieder ins Bild. Mit
          // einer einzigen Schwelle flatterte das: ein, aus, ein, aus. Deshalb zwei Schwellen:
          // eingeklappt wird erst, wenn die Überschrift GANZ verschwunden ist; ausgeklappt erst,
          // wenn sie wieder zu 70 % zu sehen ist. Der Abstand dazwischen (~32 px bei 46 px Höhe) ist
          // größer als das Wachstum der Leiste (24 px, `--bar-wachstum-eingeklappt`) – das Wachstum
          // kann also nicht zurückkippen. **Wer das Wachstum erhöht, prüft diese Rechnung neu.**
          if (!eintrag.isIntersecting) setEingeklappt(true);
          else if (eintrag.intersectionRatio >= AUSKLAPPEN_AB) setEingeklappt(false);
        },
        // Die oberen `leistenhoehe` Punkte zählen nicht als sichtbar: Dort liegt die Leiste über dem
        // Inhalt. Ohne diesen Rand klappte der Titel erst ein, wenn die Überschrift schon halb
        // hinter der Leiste verschwunden wäre.
        { rootMargin: `-${leistenhoehe}px 0px 0px 0px`, threshold: [0, AUSKLAPPEN_AB] },
      );
      beobachter.current.observe(el);
    },
    [leistenhoehe],
  );

  return { refUeberschrift, eingeklappt };
}
