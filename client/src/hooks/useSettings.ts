import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { Theme } from '../types/index';

/**
 * Globale, persistierte App-Einstellungen: Theme, Schriftart, Display-Sperre.
 * Setzt das Theme als data-Attribut auf <html> (steuert die SCSS-Dark-Mode-Vars).
 */
export function useSettings() {
  const [theme, setTheme] = useLocalStorage<Theme>('worship_theme', 'light');
  const [fontId, setFontId] = useLocalStorage<string>('worship_font', 'inter');
  const [wakePref, setWakePref] = useLocalStorage<boolean>('worship_wake', false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  const toggleWake = () => setWakePref((v) => !v);

  return { theme, setTheme, toggleTheme, fontId, setFontId, wakePref, toggleWake };
}
