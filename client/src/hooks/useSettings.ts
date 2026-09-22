import { useEffect, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { Theme, ThemePref } from '../types/index';

const darkQuery = '(prefers-color-scheme: dark)';

/**
 * Globale, persistierte App-Einstellungen: Theme, Schriftart, Display-Sperre.
 * Das Theme kann fest (hell/dunkel) oder „system" sein – dann folgt es dem Gerät.
 * Setzt das tatsächliche Theme als data-Attribut auf <html> (steuert die SCSS-Vars).
 */
export function useSettings() {
  const [themePref, setThemePref] = useLocalStorage<ThemePref>('worship_theme', 'system');
  const [fontId, setFontId] = useLocalStorage<string>('worship_font', 'inter');
  const [wakePref, setWakePref] = useLocalStorage<boolean>('worship_wake', false);

  // System-Präferenz beobachten (nur relevant, wenn themePref === 'system')
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(darkQuery).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(darkQuery);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Tatsächlich angewandtes Theme
  const theme: Theme = themePref === 'system' ? (systemDark ? 'dark' : 'light') : themePref;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // Die `theme-color` mitziehen – sie färbt unter iOS den Streifen, den das System über der App
    // malt (Statusleiste; siehe index.html). Sie MUSS dem tatsächlich angewandten Theme folgen und
    // darf NICHT an `prefers-color-scheme` hängen: Wer die App auf Hell stellt, während das Telefon
    // dunkel ist, bekäme sonst einen dunklen Streifen über einer weißen App – genau die Kante, um
    // die es hier geht (gemessen am 22.09.2026, bevor es jemandem auffiel).
    // Der Wert wird aus `--nav-bg` GELESEN statt hier noch einmal hingeschrieben: eine Farbe, eine
    // Quelle. Wer die Leisten umfärbt, ändert den Streifen automatisch mit.
    const balken = getComputedStyle(document.documentElement).getPropertyValue('--nav-bg').trim();
    if (balken) {
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((m) => m.setAttribute('content', balken));
    }
  }, [theme]);

  const toggleWake = () => setWakePref((v) => !v);

  return { theme, themePref, setThemePref, fontId, setFontId, wakePref, toggleWake };
}
