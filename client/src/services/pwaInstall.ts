/**
 * PWA-Installation („Zum Startbildschirm"): fängt das `beforeinstallprompt`-Event des Browsers
 * FRÜH ab (es feuert einmalig kurz nach dem Laden – ein erst später gesetzter Listener verpasst es).
 * Deshalb wird `initPwaInstall()` bereits in `main.tsx` aufgerufen, lange bevor der „Mehr"-Tab lädt.
 *
 * - Chrome/Edge (Android + Desktop): liefern das Event → wir zeigen einen echten „Installieren"-Knopf.
 * - iOS/iPadOS Safari: KEIN Event (Apple erlaubt keine programmatische Installation) → nur Anleitung.
 */

/** Das nicht-standardisierte, aber breit unterstützte Chrome-Event. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((l) => l());

/** Einmalig beim App-Start aufrufen (main.tsx). */
export function initPwaInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // die Standard-Mini-Infobar unterdrücken – wir bieten den Knopf selbst an
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  // Nach erfolgreicher Installation ist kein Prompt mehr möglich → Knopf ausblenden.
  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
}

/** Steht gerade ein nativer Installations-Dialog bereit (Chrome/Edge)? */
export const canPromptInstall = (): boolean => deferred !== null;

/** Öffnet den nativen Installations-Dialog; true, wenn der Nutzer zugestimmt hat. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null; // Event ist verbraucht (nur einmal nutzbar)
  emit();
  return outcome === 'accepted';
}

/** Für useSyncExternalStore: auf Änderungen der Installierbarkeit hören. */
export function subscribePwaInstall(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Läuft die App bereits als installierte PWA (Standalone-Fenster)? */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS-Safari-Sonderweg (kein display-mode):
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone/iPad (inkl. iPadOS 13+, das sich als „MacIntel" mit Touch meldet). */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  const iPhoneOrPad = /iphone|ipad|ipod/i.test(ua);
  const iPadOs13Plus = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iPhoneOrPad || iPadOs13Plus;
}

/** Echtes Safari (nicht Chrome/Edge/Firefox mit „Safari" im UA). */
function isSafari(): boolean {
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/chrome|chromium|crios|fxios|edg|android/i.test(ua);
}

/** macOS-Desktop-Safari (echter Mac, kein iPad): Installation läuft über „Zum Dock hinzufügen". */
export function isMacSafari(): boolean {
  const isMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints <= 1;
  return isMac && isSafari();
}

/** Android-Gerät. */
export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

/**
 * Welcher Installations-Weg soll angezeigt werden, wenn KEIN nativer Dialog bereitsteht
 * (`canPromptInstall() === false`)? Bestimmt Text + Icon in den Einstellungen.
 *  - 'ios'       → Safari „Teilen → Zum Home-Bildschirm"
 *  - 'macSafari' → Safari „Teilen → Zum Dock hinzufügen"
 *  - 'android'   → Browser-Menü „App installieren / Zum Startbildschirm hinzufügen"
 *  - 'other'     → generischer Hinweis (Desktop-Firefox u. a.)
 */
export function installPlatform(): 'ios' | 'macSafari' | 'android' | 'other' {
  if (isIos()) return 'ios';
  if (isMacSafari()) return 'macSafari';
  if (isAndroid()) return 'android';
  return 'other';
}
