import type { SetlistSong } from '@shared/types/index';
import { pushSetting } from '../services/userSettings';

// Alle Anzeige-Einstellungen (auch Spalten & Textgröße) werden geräteübergreifend über das Konto
// synchronisiert – ein Schlüssel ohne Geräte-Suffix. NUR der Zoom bleibt pro Geräteklasse getrennt;
// das steuert PageDeck separat (eigener Schlüssel mit `_d<klasse><spalten>`).
function fullKey(base: string, songId: number, versionKey: string): string {
  return `worship_${base}_${songId}_${versionKey}`;
}

/**
 * Schlüssel einer Einstellung, die für das GANZE Lied gilt – nicht je Version (#198).
 * Betrifft die gewählte Version selbst (`ver`) und die Anzeigequelle (`view`, Dokument vs.
 * Akkorde – die hängt am Arrangement, nicht an der ChordPro-Fassung).
 */
function songKey(base: string, songId: number): string {
  return `worship_${base}_${songId}`;
}

/** Liest eine lied-weite Einstellung. */
export function lsSong(base: string, songId: number): string | null {
  return localStorage.getItem(songKey(base, songId));
}

/**
 * Schreibt/entfernt eine lied-weite Einstellung (lokal + Konto-Sync).
 *
 * Warum als Funktion und nicht inline: Die Schlüssel `worship_view_<id>` und `worship_ver_<id>`
 * wurden vorher an je zwei Stellen zusammengesetzt – einmal beim Lesen (`chartSettings`/
 * `selectedVersionKey`), einmal beim Schreiben (`ChordChart`). Ein Tippfehler auf einer Seite
 * hätte die Einstellung still ins Leere laufen lassen.
 */
export function setLsSong(base: string, songId: number, value: string | null): void {
  const k = songKey(base, songId);
  if (value === null) localStorage.removeItem(k);
  else localStorage.setItem(k, value);
  pushSetting(k, value);
}

/** Eine auswählbare Version inkl. Original (immer erste Auswahl). */
interface ResolvedVersion {
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
  const saved = lsSong('ver', song.id);
  const keys = availableVersions(song).map((v) => v.key);
  if (saved && keys.includes(saved)) return saved;
  return song.chordpro ? 'original' : (song.versions[0]?.key ?? 'original');
}

/** ChordPro-Text einer Version (fällt auf das Original zurück). */
export function versionText(song: SetlistSong, key: string): string {
  return availableVersions(song).find((v) => v.key === key)?.text ?? song.chordpro;
}

/**
 * Woher ein Roh-Einstellungswert kommt: aus dem Gerät (`localStorage`) oder aus einer gelieferten
 * Schlüssel-Tabelle (die Roh-Einstellungen einer anderen Person beim Ansehen ihrer Notizen).
 */
export type SettingSource = (key: string) => string | null;

/** Die Gerätequelle – der Normalfall. */
export const fromLocalStorage: SettingSource = (key) => localStorage.getItem(key);

/**
 * Schlüssel-Kandidaten eines pro-Version gespeicherten Werts, in Vorrang-Reihenfolge.
 *
 * Die Rückfälle sind Migrationen und **müssen für jede Quelle gleich gelten** (#247): Vorher las
 * `settingsForLevel` seine Tabelle mit nur dem ersten Kandidaten – wer seine Einstellungen noch unter
 * einem älteren Schlüssel hatte, wurde beim Ansehen seiner Notizen mit Standardwerten dargestellt.
 */
function versionKeyCandidates(base: string, songId: number, versionKey: string): string[] {
  const keys = [
    fullKey(base, songId, versionKey),
    // Migration: Spalten/Textgröße waren früher pro Geräteklasse gespeichert (_dlarge/_dphone).
    // Vorhandenen Wert übernehmen (iPad/PC bevorzugt), damit die Einstellung nicht verloren geht;
    // beim nächsten Ändern wird sie unter dem geräteübergreifenden Schlüssel gespeichert.
    `worship_${base}_${songId}_${versionKey}_dlarge`,
    `worship_${base}_${songId}_${versionKey}_dphone`,
  ];
  // Fallback: alte song-only-Schlüssel (Migration) für 'original'.
  if (versionKey === 'original') keys.push(`worship_${base}_${songId}`);
  return keys;
}

/** Liest einen pro-Version gespeicherten Einstellungswert aus einer beliebigen Quelle. */
export function readVersioned(
  src: SettingSource,
  base: string,
  songId: number,
  versionKey: string,
): string | null {
  for (const key of versionKeyCandidates(base, songId, versionKey)) {
    const v = src(key);
    if (v !== null) return v;
  }
  return null;
}

/**
 * Liest einen pro-Version gespeicherten Einstellungswert vom Gerät. Für 'original' wird auf die alten
 * song-only-Schlüssel zurückgegriffen (Migration bestehender Einstellungen).
 */
export function lsVersion(base: string, songId: number, versionKey: string): string | null {
  return readVersioned(fromLocalStorage, base, songId, versionKey);
}

/** Schreibt/entfernt einen pro-Version gespeicherten Einstellungswert (lokal + Konto-Sync). */
export function setLsVersion(
  base: string,
  songId: number,
  versionKey: string,
  value: string | null,
): void {
  const k = fullKey(base, songId, versionKey);
  if (value === null) localStorage.removeItem(k);
  else localStorage.setItem(k, value);
  pushSetting(k, value);
}
