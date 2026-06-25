import type { SetlistSong } from '@shared/types/index';
import { pushSetting } from '../services/userSettings';
import { deviceClass } from './deviceClass';

// Display-abhängige Einstellungen: pro Geräteklasse (Handy vs. Tablet+Computer) getrennt.
const DISPLAY_BASES = new Set(['cols', 'fs']);
function fullKey(base: string, songId: number, versionKey: string): string {
  const k = `worship_${base}_${songId}_${versionKey}`;
  return DISPLAY_BASES.has(base) ? `${k}_d${deviceClass()}` : k;
}

/** Eine auswählbare Version inkl. Original (immer erste Auswahl). */
export interface ResolvedVersion {
  key: string;
  name: string;
  text: string;
}

/** Alle auswählbaren Versionen eines Lieds: Original + benannte Versionen aus ChurchTools. */
export function availableVersions(song: SetlistSong): ResolvedVersion[] {
  return [{ key: 'original', name: 'Original', text: song.chordpro }, ...song.versions];
}

/**
 * Aktuell gewählte Version eines Lieds (aus localStorage, pro Lied).
 * Standard: Original, falls vorhanden; sonst die erste Version (Legacy-Lieder ohne Original).
 */
export function selectedVersionKey(song: SetlistSong): string {
  const saved = localStorage.getItem(`worship_ver_${song.id}`);
  const keys = availableVersions(song).map((v) => v.key);
  if (saved && keys.includes(saved)) return saved;
  return song.chordpro ? 'original' : song.versions[0]?.key ?? 'original';
}

/** ChordPro-Text einer Version (fällt auf das Original zurück). */
export function versionText(song: SetlistSong, key: string): string {
  return availableVersions(song).find((v) => v.key === key)?.text ?? song.chordpro;
}

/**
 * Liest einen pro-Version gespeicherten Einstellungswert. Für 'original' wird auf die alten
 * song-only-Schlüssel zurückgegriffen (Migration bestehender Einstellungen).
 */
export function lsVersion(base: string, songId: number, versionKey: string): string | null {
  // Primär: (ggf. geräteklassen-spezifischer) Schlüssel.
  const v = localStorage.getItem(fullKey(base, songId, versionKey));
  if (v !== null) return v;
  // Fallback: display-abhängige Werte ohne Klassen-Suffix (früher synchronisiert) übernehmen.
  if (DISPLAY_BASES.has(base)) {
    const legacy = localStorage.getItem(`worship_${base}_${songId}_${versionKey}`);
    if (legacy !== null) return legacy;
  }
  // Fallback: alte song-only-Schlüssel (Migration) für 'original'.
  if (versionKey === 'original') return localStorage.getItem(`worship_${base}_${songId}`);
  return null;
}

/** Schreibt/entfernt einen pro-Version gespeicherten Einstellungswert (lokal + Konto-Sync). */
export function setLsVersion(base: string, songId: number, versionKey: string, value: string | null): void {
  const k = fullKey(base, songId, versionKey);
  if (value === null) localStorage.removeItem(k);
  else localStorage.setItem(k, value);
  pushSetting(k, value);
}
