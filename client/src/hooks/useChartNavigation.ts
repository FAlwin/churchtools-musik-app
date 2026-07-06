import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { SetlistPageOwner } from '../utils/chordPdf';

interface UseChartNavigationArgs {
  /** Seiten-Besitzer des durchgehenden Stroms (ein Eintrag je PDF-Seite). */
  owners: SetlistPageOwner[];
  /** Lied, auf das beim Öffnen gesprungen werden soll. */
  startIndex: number;
  /** Tastatur-Navigation aussetzen, solange Editor/Zeichenmodus offen sind (per Ref, gegen Zyklen). */
  blockedRef: MutableRefObject<boolean>;
}

/**
 * Blättern im durchgehenden Seitenstrom: linke (sichtbare) Seite + aktive Hälfte, Quer-/Hochformat
 * (im 2-up nie eine Seite allein lassen), Sprung zum Start-Lied und Tastatur ←/→.
 */
export function useChartNavigation({ owners, startIndex, blockedRef }: UseChartNavigationArgs) {
  // Seiten-Position im Strom: linke (erste) sichtbare Seite + aktive Seite (angetippte Hälfte).
  const [streamPage, setStreamPage] = useState(0);
  const [activePage, setActivePage] = useState(0);

  // Ausrichtung (für die Navigations-Grenze: im Querformat nie eine Seite allein lassen).
  // matchMedia('orientation') ist beim Screen-/App-Wechsel stabiler als innerWidth/Height.
  const isLandscape = () =>
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(orientation: landscape)').matches
      : window.innerWidth > window.innerHeight;
  const [landscape, setLandscape] = useState(isLandscape);
  useEffect(() => {
    const f = () => setLandscape(isLandscape());
    window.addEventListener('resize', f);
    window.addEventListener('orientationchange', f);
    return () => {
      window.removeEventListener('resize', f);
      window.removeEventListener('orientationchange', f);
    };
  }, []);

  const lastPage = Math.max(0, owners.length - 1);
  // Max. linke Seite: im 2-up stoppt die Navigation eine Seite früher (Paar bleibt voll).
  const maxLeft = landscape && owners.length > 1 ? owners.length - 2 : lastPage;
  // Linke Seite auf maxLeft klemmen (nicht nur lastPage): schrumpft der Strom (z. B. Lied per
  // 2-Spalten-Einstellung von 2 auf 1 Seite), rutscht das Fenster aufs letzte volle Paar →
  // die letzte Seite steht im Querformat RECHTS neben ihrem Vorgänger, nie allein links.
  const pageIdx = Math.min(streamPage, maxLeft);
  const activeIdx = Math.min(activePage, lastPage);
  const atStart = pageIdx <= 0;
  const atEnd = pageIdx >= maxLeft;

  // ── Navigation im Strom (Wischen/Footer): immer um 1 Seite; aktive = neue linke Seite ──
  function go(delta: number) {
    const nextP = Math.min(Math.max(0, pageIdx + delta), maxLeft);
    setStreamPage(nextP);
    setActivePage(nextP);
  }
  function next() {
    go(1);
  }
  function prev() {
    go(-1);
  }
  function goToSong(target: number) {
    const p = owners.findIndex((o) => o.songIdx === target);
    if (p >= 0) {
      setStreamPage(Math.min(p, maxLeft));
      setActivePage(p);
    }
  }
  /** Linke + aktive Seite gemeinsam setzen (z. B. wenn der Strom seine Position meldet). */
  function setPage(i: number) {
    setStreamPage(i);
    setActivePage(i);
  }

  // Beim Start auf das gewünschte Lied springen (sobald der Strom bereit ist).
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current || owners.length === 0) return;
    didInit.current = true;
    const p = owners.findIndex((o) => o.songIdx === startIndex);
    if (p > 0) {
      // linke Seite auf maxLeft begrenzen (im 2-up nie eine Seite allein); aktive = das Ziel-Lied
      // (steht dann ggf. in der rechten Hälfte, vorheriges Lied links).
      setStreamPage(Math.min(p, maxLeft));
      setActivePage(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owners.length]);

  // Tastatur ←/→ (aktuelle Funktionen über Ref, damit der Listener stabil bleibt).
  const fns = useRef({ next, prev });
  fns.current = { next, prev };
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (blockedRef.current) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        fns.current.next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        fns.current.prev();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [blockedRef]);

  return { pageIdx, activeIdx, atStart, atEnd, next, prev, goToSong, setPage, setActivePage };
}
