import { useSyncExternalStore } from 'react';
import {
  canPromptInstall,
  subscribePwaInstall,
  isStandalone,
  installPlatform,
} from '../services/pwaInstall';

export interface PwaInstallState {
  /** App läuft schon als installierte PWA → keine Installationshilfe nötig. */
  standalone: boolean;
  /** Chrome/Edge halten einen nativen Installations-Dialog bereit → echter Knopf. */
  canPrompt: boolean;
  /** Andernfalls: welcher manuelle Weg passt zum System (Text + Icon). */
  platform: 'ios' | 'macSafari' | 'android' | 'other';
}

/** Zustand der PWA-Installierbarkeit für den „Mehr"-Tab. */
export function usePwaInstall(): PwaInstallState {
  // Nur `canPrompt` ändert sich zur Laufzeit (Event/Installation); standalone & platform sind konstant.
  const canPrompt = useSyncExternalStore(subscribePwaInstall, canPromptInstall, () => false);
  return { standalone: isStandalone(), canPrompt, platform: installPlatform() };
}
