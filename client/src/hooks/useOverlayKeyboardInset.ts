import { useEffect, type RefObject } from 'react';
import { syncAppHeight } from '../utils/appHeight';

/**
 * Hält einen Vollbild-Overlay über der iOS-Tastatur frei (#207).
 *
 * Zwei Dinge passieren auf iOS, sobald ein Eingabefeld fokussiert wird:
 *  1. Die Tastatur verdeckt den unteren Teil des Bildschirms – ohne Aussparung liegen Trefferlisten
 *     und Knöpfe darunter (im Dialog „Lied verknüpfen" waren die Treffer nicht erreichbar, man
 *     musste erst wischen). Der Overlay bekommt daher unten einen Innenabstand in Höhe der Tastatur
 *     (`--kb`, gemessen am `visualViewport`); weil er per Flexbox zentriert, rutscht der Inhalt
 *     automatisch in den verbleibenden Bereich.
 *  2. iOS scrollt zusätzlich das DOKUMENT nach oben, um das Feld über die Tastatur zu heben. Da die
 *     App eine feste Höhe hat (`--app-h`) und nur innere Container scrollen, bleibt die Seite danach
 *     verschoben: Die Kopfleiste wandert aus dem Bild und „klebt" hinterher oben mit einer Lücke.
 *     `scrollTo(0, 0)` neutralisiert das laufend.
 *
 * Das Rezept stammt aus dem ChordEditor, wo es sich bewährt hat – es liegt hier gemeinsam, damit die
 * beiden Kopien nicht auseinanderlaufen. Der Overlay MUSS `position: fixed` sein (nicht `absolute`),
 * sonst scrollt er mit dem Dokument mit und die Aussparung nützt nichts.
 */
export function useOverlayKeyboardInset(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return;
    const apply = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      el.style.setProperty('--kb', `${kb}px`);
      if (window.scrollY !== 0 || vv.offsetTop !== 0) window.scrollTo(0, 0);
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      el.style.removeProperty('--kb');
      // Beim Schließen den Dokument-Scroll zurückholen und `--app-h` neu setzen – sonst bleibt die
      // Ansicht verschoben, wenn die Tastatur gemeinsam mit dem Dialog verschwindet.
      // `syncAppHeight` direkt statt eines synthetischen `resize`-Events (#215): Der Hook sitzt in
      // JEDEM Dialog, und das Event hätte beim Schließen eines Pickers nebenbei die Resize-Handler
      // von PageDeck/ChordChart/useChartNavigation ausgelöst – Fernwirkung auf Verdacht.
      window.scrollTo(0, 0);
      syncAppHeight();
    };
    // ref ist stabil; der Effekt soll genau einmal pro Overlay-Lebensdauer laufen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
