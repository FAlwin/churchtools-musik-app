// ── Zentrale Marken-Konfiguration (White-Label) ──────────────────────────────
// Hier wird das Erscheinungsbild EINER Gemeinde gebündelt. Für eine andere
// Gemeinde nur diese Datei (und die Logo-Dateien in client/public/) anpassen.
//
// Genutzt von:
//   - PWA-Manifest + App-Name (client/vite.config.ts)
//   - Login-Logo und Alt-Text (client/src/pages/Login.tsx)
//
// Farben liegen zusätzlich in src/styles/_variables.scss (SCSS) – beim vollen
// White-Label-Ausbau werden beide aus einer Quelle gespeist.
export const branding = {
  /** Voller App-Name (PWA-Manifest, Titel). */
  appName: 'Churchtools Musik App',
  /** Kurzname – iOS/Android schlagen ihn beim „Zum Home-Bildschirm" vor. */
  shortName: 'Churchtools Musik App',
  /** Beschreibung im Manifest. */
  description: 'Chord Charts aus ChurchTools – ECG Donrath',
  /** Logo-Pfad (liegt in client/public/). */
  logo: '/logo.png',
  /** Alt-Text/Träger des Logos. */
  orgName: 'ECG Donrath',
  /** Markenfarben (müssen zu _variables.scss passen). */
  themeColor: '#00616E',
  backgroundColor: '#FFFCF2',
} as const;
