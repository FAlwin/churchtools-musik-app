import { useEffect, type MutableRefObject } from 'react';

// Gelernte Höhe der iOS-Bildschirmtastatur (px). Damit heben wir den Chart-Bereich schon BEIM
// Fokussieren an – ist der Cursor beim Öffnen der Tastatur bereits sichtbar, verschiebt iOS die
// App gar nicht erst. Persistiert, damit auch der erste Text nach einem Neustart sauber läuft.
let lastKbHeight = Number(localStorage.getItem('musikapp:kbHeight')) || 0;
function learnKbHeight(kb: number): void {
  if (kb === lastKbHeight) return;
  lastKbHeight = kb;
  try {
    localStorage.setItem('musikapp:kbHeight', String(kb));
  } catch {
    /* voll/gesperrt → nur In-Memory */
  }
}

// iOS scrollt beim Öffnen der Tastatur nicht nur das Fenster, sondern notfalls auch GECLIPPTE
// Vorfahren (trotz overflow:hidden), um den Cursor freizustellen → alles zurückdrehen; das
// Freistellen übernimmt unser gezielter transform-Hub auf dem Chart-Bereich.
function resetRevealScrolls(el: HTMLElement): void {
  if (window.scrollY !== 0) window.scrollTo(0, 0);
  for (let n = el.parentElement; n; n = n.parentElement) {
    if (n.scrollTop !== 0) n.scrollTop = 0;
    if (n.scrollLeft !== 0) n.scrollLeft = 0;
  }
}

interface UseKeyboardInsetsParams {
  /** Wurzelelement des Chart-Bereichs (wird angehoben). */
  rootRef: MutableRefObject<HTMLDivElement | null>;
  /** Inline-Eingabefelder je Slot. */
  editRefs: MutableRefObject<(HTMLSpanElement | null)[]>;
  /** Wird gerade ein Textfeld bearbeitet? */
  anyPending: boolean;
  /** Slot des gerade bearbeiteten Textfelds (0/1). */
  pendingSlot: number;
}

/**
 * Vermeidet beim Text-Bearbeiten die iOS-Tastatur: statt die GANZE Seite hochzuschieben
 * (iOS-Verhalten) hebt der Hook NUR den Chart-Bereich so weit an, dass der Cursor knapp über der
 * Tastatur sitzt – und setzt den Fenster-Scroll zurück, damit App-Kopf/-Fuß stehen bleiben.
 * Gibt `preLiftForEditor` zurück: das synchrone Vorab-Anheben, das in der Tipp-Geste (focusEditor)
 * VOR dem Fokus passieren muss, damit iOS gar nicht erst selbst scrollt.
 */
export function useKeyboardInsets({
  rootRef,
  editRefs,
  anyPending,
  pendingSlot,
}: UseKeyboardInsetsParams) {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = rootRef.current;
    if (!anyPending || !vv || !root) return;
    const slot = pendingSlot;
    // Merkt sich, ob die Tastatur in dieser Edit-Session schon offen war → unterscheidet den
    // initialen Aufruf (Vorab-Hub aus focusEditor NICHT anfassen) vom Schließen der Tastatur
    // (Hub zurücknehmen, sonst bleibt im Querformat ein grauer Balken hängen).
    let kbWasOpen = false;
    const adjust = () => {
      const el = editRefs.current[slot];
      if (!el) return;
      resetRevealScrolls(el);
      // Tastaturhöhe gegen die EINGEFRORENE App-Höhe messen (main.tsx pausiert --app-h beim
      // Tippen) → funktioniert egal, ob iOS die Tastatur überlagert oder das Fenster verkleinert.
      const kb = Math.round(document.documentElement.clientHeight - vv.height - vv.offsetTop);
      if (kb <= 60) {
        // Tastatur (wieder) zu: Vorab-Hub nur zurücknehmen, wenn sie zwischendurch offen war –
        // sonst würde der initiale Aufruf den Hub aus focusEditor sofort löschen.
        if (kbWasOpen) root.style.transform = '';
        return;
      }
      kbWasOpen = true;
      learnKbHeight(kb);
      root.style.transform = ''; // erst zurücksetzen → natürliche Position messen
      const overlap = el.getBoundingClientRect().bottom + 12 - (vv.offsetTop + vv.height);
      if (overlap > 0) root.style.transform = `translateY(${-Math.ceil(overlap)}px)`;
    };
    adjust();
    vv.addEventListener('resize', adjust);
    vv.addEventListener('scroll', adjust);
    // capture:true fängt auch Scrolls der Vorfahren-Container (die kein window-Scroll sind).
    document.addEventListener('scroll', adjust, true);
    return () => {
      vv.removeEventListener('resize', adjust);
      vv.removeEventListener('scroll', adjust);
      document.removeEventListener('scroll', adjust, true);
      root.style.transform = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyPending, pendingSlot]);

  // VOR dem Fokus anheben (gelernte Tastaturhöhe): ist der Cursor beim Aufklappen der Tastatur
  // schon frei, verschiebt iOS Fenster/Container gar nicht erst. Ohne gelernte Höhe (z. B.
  // Hardware-Tastatur) passiert hier nichts – dann korrigiert notfalls adjust() oben.
  function preLiftForEditor(slot: number) {
    const el = editRefs.current[slot];
    const root = rootRef.current;
    if (!el || !root || lastKbHeight <= 0) return;
    root.style.transform = '';
    const overlap =
      el.getBoundingClientRect().bottom +
      12 -
      (document.documentElement.clientHeight - lastKbHeight);
    if (overlap > 0) root.style.transform = `translateY(${-Math.ceil(overlap)}px)`;
  }

  return { preLiftForEditor };
}
