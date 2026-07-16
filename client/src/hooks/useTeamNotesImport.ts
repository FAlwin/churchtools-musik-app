import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { SetlistSong } from '@shared/types/index';
import {
  VIEW_NS,
  getSharers,
  getSettingsOf,
  loadViewMirror,
  clearViewMirror,
  type Sharer,
} from '../services/teamNotes';
import { pushField } from '../services/annotations';
import { pushSetting } from '../services/userSettings';
import { availableVersions, setLsVersion } from '../utils/songVersions';
import { type SongSettings, loadSettings, settingsForLevel } from '../utils/chartSettings';
import { mergeStrokes } from '../utils/strokes';

/** Textobjekt einer Anmerkungs-Seite (Form wird beim Import 1:1 übernommen). */
interface PageTextObjLike {
  id: number;
  [k: string]: unknown;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

interface UseTeamNotesImportParams {
  songs: SetlistSong[];
  settings: Record<number, SongSettings>;
  setSettings: Dispatch<SetStateAction<Record<number, SongSettings>>>;
  setSyncTick: Dispatch<SetStateAction<number>>;
  setDrawMode: Dispatch<SetStateAction<boolean>>;
  showToast: (msg: string) => void;
}

/**
 * „Notizen von …" (#124, PCO-Modell): fremde geteilte Anmerkungen ansehen und optional in die
 * EIGENEN übernehmen. Kapselt den kompletten Ansehen-/Import-Zustand samt abgeleiteter
 * `effSettings` (beim Ansehen gelten für das angesehene Lied die Einstellungen der Person – nur so
 * stimmen die Positionen ihrer Anmerkungen). Ansehen gilt PRO LIED.
 */
export function useTeamNotesImport({
  songs,
  settings,
  setSettings,
  setSyncTick,
  setDrawMode,
  showToast,
}: UseTeamNotesImportParams) {
  // Ansehen gilt PRO LIED (nicht für den ganzen Ablauf) – songId merkt sich, für welches.
  const [viewing, setViewing] = useState<{
    id: number;
    name: string;
    songId: number;
    versionKey: string;
    lyr: boolean;
  } | null>(null);
  // Wähler-Zwischenschritt: Person angetippt → ihre Ebenen (Version + Darstellung) zur Auswahl.
  const [pickerPerson, setPickerPerson] = useState<{ id: number; name: string } | null>(null);
  const [viewSettings, setViewSettings] = useState<Record<number, SongSettings> | null>(null);
  // Roh-Einstellungen der angesehenen Person (alle worship_*-Schlüssel des Lieds) – für die
  // Ansichts-Übernahme auch dann, wenn eine ANDERE als ihre aktuelle Version importiert wird.
  const [viewRaw, setViewRaw] = useState<Record<string, string> | null>(null);
  const [sharers, setSharers] = useState<Sharer[]>([]);
  const [showSharers, setShowSharers] = useState(false);
  // Modus beim Ansehen einer geteilten Ebene: nur ansehen, oder Vorschau auf Zusammenführen/Ersetzen.
  const [viewMode, setViewMode] = useState<'view' | 'merge' | 'replace'>('view');

  // Beim Verlassen der Ansicht/Chart-Wechsel den flüchtigen Ansichts-Spiegel räumen.
  useEffect(() => () => clearViewMirror(), []);

  // Während des Ansehens gelten NUR für das angesehene Lied die Einstellungen der angesehenen Person.
  const effSettings: Record<number, SongSettings> =
    viewing && viewSettings
      ? Object.fromEntries(
          songs.map((s) => [
            s.id,
            s.id === viewing.songId ? (viewSettings[s.id] ?? settings[s.id]) : settings[s.id],
          ]),
        )
      : settings;

  /** Person antippen: ihre geteilten Daten fürs Lied laden, dann ihre Ebenen zur Auswahl zeigen. */
  async function openPersonLevels(p: { id: number; name: string }, songId: number) {
    try {
      const [, settingsMap] = await Promise.all([
        loadViewMirror(p.id, [songId]),
        getSettingsOf(p.id, [songId]),
      ]);
      setViewRaw(settingsMap);
      setPickerPerson(p);
    } catch {
      /* Laden gescheitert (offline/Rechte) → Auswahl bleibt bei den Personen */
    }
  }

  /** Eine konkrete Ebene (Version + Darstellungsart) der Person ansehen. */
  function viewLevel(songId: number, versionKey: string, lyr: boolean) {
    if (!pickerPerson) return;
    const target = songs.find((x) => x.id === songId);
    if (!target) return;
    setViewSettings({ [songId]: settingsForLevel(target, viewRaw ?? {}, versionKey, lyr) });
    setViewing({ ...pickerPerson, songId, versionKey, lyr });
    setViewMode('view');
    setDrawMode(false);
    setShowSharers(false);
    setSyncTick((t) => t + 1);
  }

  function stopViewing() {
    clearViewMirror();
    setViewMode('view');
    setViewing(null);
    setViewSettings(null);
    setViewRaw(null);
    setPickerPerson(null);
    setSyncTick((t) => t + 1);
  }

  /** Ebenen (Version + Darstellungsart) mit Anmerkungen im Ansichts-Spiegel, samt Seiten. */
  function mirrorGroups(): Array<{ versionKey: string; lyr: boolean; pages: number[] }> {
    const map = new Map<string, Set<number>>();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(VIEW_NS)) continue;
      const base = k.replace(VIEW_NS, '').replace(/_text$/, '');
      const m = base.match(/^song\d+_v([a-z0-9-]+)(_lyr)?_(\d+)$/i);
      if (!m) continue;
      const gk = `${m[1]}|${m[2] ? '1' : '0'}`;
      if (!map.has(gk)) map.set(gk, new Set());
      map.get(gk)!.add(Number(m[3]));
    }
    return [...map.entries()].map(([gk, pages]) => {
      const [versionKey, lyr] = gk.split('|');
      return { versionKey, lyr: lyr === '1', pages: [...pages].sort((a, b) => a - b) };
    });
  }
  const groupKeyOf = (g: { versionKey: string; lyr: boolean }) =>
    `${g.versionKey}|${g.lyr ? '1' : '0'}`;

  /**
   * Import: Anmerkungen der angesehenen Person in die EIGENEN übernehmen (PCO-Stil).
   * „Ersetzen" überschreibt die eigenen Seiten, „Zusammenführen" kombiniert (Striche-PNGs
   * übereinander, Texte angehängt). Die Ansicht (Version/Spalten/Schrift/Nur-Text) der Person
   * wird für die betroffenen Lieder mit übernommen – nur so stimmen die Positionen. Tonart/Kapo
   * bleiben bewusst persönlich.
   */
  async function importFrom(mode: 'merge' | 'replace') {
    if (!viewing || !viewSettings) return;
    setViewMode('view');
    const songId = viewing.songId;
    // Übernommen wird die GERADE ANGESEHENE Ebene (= das, was die Vorschau zeigt).
    const level = mirrorGroups().find(
      (g) => g.versionKey === viewing.versionKey && g.lyr === viewing.lyr,
    );
    if (!level) return;
    {
      const { versionKey } = level;
      const seg = level.lyr ? '_lyr' : '';
      for (const page of level.pages) {
        const base = `song${songId}_v${versionKey}${seg}_${page}`;
        const theirStrokes = localStorage.getItem(VIEW_NS + base);
        const theirTexts =
          safeParse<PageTextObjLike[]>(localStorage.getItem(`${VIEW_NS + base}_text`)) ?? [];
        const ownKey = `worship_docdraw_${base}`;
        if (mode === 'replace') {
          if (theirStrokes) localStorage.setItem(ownKey, theirStrokes);
          else localStorage.removeItem(ownKey);
          pushField(ownKey, 'strokes', theirStrokes ?? null);
          if (theirTexts.length) localStorage.setItem(`${ownKey}_text`, JSON.stringify(theirTexts));
          else localStorage.removeItem(`${ownKey}_text`);
          pushField(ownKey, 'texts', theirTexts);
        } else {
          const merged = await mergeStrokes(localStorage.getItem(ownKey), theirStrokes);
          if (merged) {
            localStorage.setItem(ownKey, merged);
            pushField(ownKey, 'strokes', merged);
          }
          const ownTexts =
            safeParse<PageTextObjLike[]>(localStorage.getItem(`${ownKey}_text`)) ?? [];
          const withNewIds = theirTexts.map((t, i) => ({ ...t, id: Date.now() + i }));
          const mergedTexts = [...ownTexts, ...withNewIds];
          if (mergedTexts.length) {
            localStorage.setItem(`${ownKey}_text`, JSON.stringify(mergedTexts));
            pushField(ownKey, 'texts', mergedTexts);
          }
        }
      }
    }
    // Ziel-Ebene = die angesehene Ebene; DIESE Ansicht wird danach angezeigt.
    const vs = viewSettings[songId];
    const pVersion = viewing.versionKey;
    const pLyr = viewing.lyr ? '1' : '0';
    // Ansicht der Person für die Ziel-Ebene übernehmen (Spalten/Schrift/Abschnitte aus ihren
    // Roh-Einstellungen der ZIEL-Version; Tonart/Kapo bleiben bewusst eigene).
    const raw = viewRaw ?? {};
    const rawGet = (b: string): string | null => raw[`worship_${b}_${songId}_${pVersion}`] ?? null;
    localStorage.setItem(`worship_ver_${songId}`, pVersion);
    pushSetting(`worship_ver_${songId}`, pVersion);
    setLsVersion('lyrics', songId, pVersion, pLyr === '1' ? '1' : '0');
    setLsVersion('cols', songId, pVersion, rawGet('cols') ?? String(vs?.cols ?? 1));
    setLsVersion('fs', songId, pVersion, rawGet('fs') ?? String(vs?.fontSize ?? 20));
    const rawShift = rawGet('secshift');
    if (rawShift) setLsVersion('secshift', songId, pVersion, rawShift);
    setSettings(Object.fromEntries(songs.map((x) => [x.id, loadSettings(x)])));
    const target = songs.find((x) => x.id === songId);
    const vName =
      (target && availableVersions(target).find((v) => v.key === pVersion)?.name) ?? pVersion;
    stopViewing();
    showToast(
      `Übernommen – Ansicht: Version „${vName}"${pLyr === '1' ? ' · Nur Text' : ''}. Eigene Notizen: siehe Stift-Markierung im Lied-Menü.`,
    );
  }

  /** Liste der Teilenden (still) auffrischen – z. B. beim initialen Laden des Charts. */
  function refreshSharers() {
    getSharers(songs.map((x) => x.id))
      .then((list) => setSharers(list))
      .catch(() => {});
  }

  /** „Notizen von …" öffnen (Liste beim Öffnen auffrischen). */
  function openSharers() {
    setPickerPerson(null);
    setShowSharers(true);
    refreshSharers();
  }

  return {
    viewing,
    pickerPerson,
    setPickerPerson,
    sharers,
    showSharers,
    setShowSharers,
    viewMode,
    setViewMode,
    effSettings,
    refreshSharers,
    openPersonLevels,
    viewLevel,
    stopViewing,
    mirrorGroups,
    groupKeyOf,
    importFrom,
    openSharers,
  };
}
