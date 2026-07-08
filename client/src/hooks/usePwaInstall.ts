import { useSyncExternalStore } from 'react';
import {
  canPromptInstall,
  subscribePwaInstall,
  isStandalone,
  isIos,
} from '../services/pwaInstall';

export interface PwaInstallState {
  /** App läuft schon als installierte PWA → keine Installationshilfe nötig. */
  standalone: boolean;
  /** iPhone/iPad → nur manuelle Anleitung möglich (Apple erlaubt keinen Auto-Dialog). */
  ios: boolean;
  /** Chrome/Edge halten einen nativen Installations-Dialog bereit → echter Knopf. */
  canPrompt: boolean;
}

/** Zustand der PWA-Installierbarkeit für den „Mehr"-Tab. */
export function usePwaInstall(): PwaInstallState {
  // Nur `canPrompt` ändert sich zur Laufzeit (Event/Installation); standalone & ios sind konstant.
  const canPrompt = useSyncExternalStore(subscribePwaInstall, canPromptInstall, () => false);
  return { standalone: isStandalone(), ios: isIos(), canPrompt };
}
