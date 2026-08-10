import type { ChordProSection, SetlistSong, SongArrangementOption } from '@shared/types/index';
import type { ResolvedVersion } from '../utils/songVersions';
import type { SongSettings } from '../utils/chartSettings';
import { CapoPicker } from './CapoPicker';
import { ChartAppearanceMenu } from './ChartAppearanceMenu';
import { KeyPicker } from './KeyPicker';
import { SectionTransposeSheet } from './SectionTransposeSheet';
import { SongMenu } from './SongMenu';

/** Welches Overlay offen ist – höchstens eines, deshalb EIN Feld statt fünf Flaggen (#283). */
export type ChartOverlay = 'key' | 'capo' | 'sec' | 'appearance' | 'menu' | null;

/**
 * Die Auswahl-Overlays der Lied-Anzeige (#314 – vorher inline in `pages/ChordChart.tsx`).
 *
 * Fünf Blätter, die sich gegenseitig ausschließen: Aussehen, Lied-Menü, Tonart, Kapo und die
 * Abschnitts-Transposition. Sie hier zu bündeln hält die Regel an EINER Stelle, dass immer nur
 * eines offen ist – vorher standen fünf `{overlay === '…' && …}`-Blöcke verstreut im JSX.
 *
 * Die Overlays schließen sich nach einer Auswahl selbst; das erledigt durchgehend `onClose`.
 */
interface ChartOverlaysProps {
  overlay: ChartOverlay;
  onOverlay: (o: ChartOverlay) => void;
  song: SetlistSong;
  set: SongSettings;
  /** Klingende Tonart. */
  curKey: string;
  /** Alle Arrangements des Lieds (#320) – zum Umschalten im Lied-Menü. */
  arrangements: SongArrangementOption[];
  /** Arrangement aus dem Ablauf – die Wahl darauf heißt „keine eigene Wahl". */
  ablaufArrangementId: number;
  /** Gegriffene Tonart (Kapo abgezogen). */
  shapeKey: string;
  sections: ChordProSection[];
  versions: ResolvedVersion[];
  currentVersion: ResolvedVersion;
  isOriginal: boolean;
  hasVersions: boolean;
  canEditSong: boolean;
  /** Eine Einstellung des aktiven Lieds ändern. */
  onSetting: (patch: Partial<SongSettings>) => void;
  onSelectVersion: (versionKey: string) => void;
  onSharePdf: () => void;
  onEditCurrent: () => void;
  onNewVersion: () => void;
  onDeleteVersion: () => void;
}

export function ChartOverlays({
  overlay,
  onOverlay,
  song,
  set,
  curKey,
  shapeKey,
  sections,
  arrangements,
  ablaufArrangementId,
  versions,
  currentVersion,
  isOriginal,
  hasVersions,
  canEditSong,
  onSetting,
  onSelectVersion,
  onSharePdf,
  onEditCurrent,
  onNewVersion,
  onDeleteVersion,
}: ChartOverlaysProps) {
  const schliessen = () => onOverlay(null);

  if (overlay === 'appearance') {
    return (
      <ChartAppearanceMenu
        fontSize={set.fontSize}
        cols={set.cols}
        onFontSize={(fontSize) => onSetting({ fontSize })}
        onCols={(cols) => onSetting({ cols })}
        onClose={schliessen}
      />
    );
  }

  if (overlay === 'menu') {
    return (
      <SongMenu
        song={song}
        set={set}
        curKey={curKey}
        sections={sections}
        arrangements={arrangements}
        ablaufArrangementId={ablaufArrangementId}
        versions={versions}
        currentVersion={currentVersion}
        isOriginal={isOriginal}
        hasVersions={hasVersions}
        canEditSong={canEditSong}
        onClose={schliessen}
        onOpenKeyPicker={() => onOverlay('key')}
        onOpenCapoPicker={() => onOverlay('capo')}
        onOpenSectionTranspose={() => onOverlay('sec')}
        onSharePdf={onSharePdf}
        onEditCurrent={onEditCurrent}
        onNewVersion={onNewVersion}
        onDeleteVersion={onDeleteVersion}
        onChange={onSetting}
        onSelectVersion={onSelectVersion}
      />
    );
  }

  if (overlay === 'key') {
    return (
      <KeyPicker
        currentKey={curKey}
        defaultKey={song.targetKey}
        isCustom={set.key !== null}
        onPick={(k) => {
          onSetting({ key: k });
          schliessen();
        }}
        onReset={() => {
          onSetting({ key: null });
          schliessen();
        }}
        onClose={schliessen}
      />
    );
  }

  if (overlay === 'capo') {
    return (
      <CapoPicker
        capo={set.capo}
        shapeKey={shapeKey}
        soundingKey={curKey}
        onPick={(c) => {
          onSetting({ capo: c });
          schliessen();
        }}
        onClose={schliessen}
      />
    );
  }

  if (overlay === 'sec') {
    return (
      <SectionTransposeSheet
        sections={sections}
        value={set.secShift}
        onChange={(index, semitones) => {
          // Eine Verschiebung von 0 wird ENTFERNT, nicht als 0 gespeichert: Sonst wüchse die
          // Einstellung mit jedem Hin-und-Her, und die gespeicherte Form unterschiede sich von der
          // eines Lieds, an dem nie etwas verstellt wurde.
          const nextShift = { ...set.secShift };
          if (semitones === 0) delete nextShift[index];
          else nextShift[index] = semitones;
          onSetting({ secShift: nextShift });
        }}
        onReset={() => onSetting({ secShift: {} })}
        onClose={schliessen}
      />
    );
  }

  return null;
}
