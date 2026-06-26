import { useEffect, useState } from 'react';
import type { AgendaItem, AgendaServiceOption, Service } from '@shared/types/index';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Screen, Scroll } from '../components/Screen';
import { NavBar, IconButton } from '../components/NavBar';
import { Segment } from '../components/Segment';
import { CenterMessage } from '../components/CenterMessage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AddItemSheet } from '../components/AddItemSheet';
import { ItemActionSheet } from '../components/ItemActionSheet';
import { Icon } from '../components/icons';
import { NoteTile } from '../components/NoteTile';
import { generateSetlistPdf } from '../utils/chordPdf';
import { sharePdf } from '../utils/sharePdf';
import { loadSongPdfOpts, loadAppLogo } from '../utils/songPdfOpts';
import { selectedVersionKey, versionText } from '../utils/songVersions';
import styles from './Setlist.module.scss';

interface SetlistProps {
  service: Service;
  items: AgendaItem[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** Wird mit dem Index des Lieds (nur Lieder gezählt) aufgerufen. */
  onSelect: (songIndex: number) => void;
  onBack: () => void;
  /** Speichert die neue Reihenfolge (Item-IDs). Wirft bei Fehler (z.B. fehlende Rechte). */
  onReorder: (order: number[]) => Promise<void>;
  isReordering?: boolean;
  /** Löscht einen Ablaufpunkt. Wirft bei Fehler (z.B. fehlende Rechte). */
  onDelete: (itemId: number) => Promise<void>;
  /** Benennt einen Punkt um (nur Text/Überschrift). Wirft bei Fehler. */
  onRename: (itemId: number, title: string) => Promise<void>;
  /** Verknüpft einen bestehenden Punkt mit einem Lied. Wirft bei Fehler. */
  onLinkSong: (itemId: number, arrangementId: number) => Promise<void>;
  /** Hebt die Lied-Verknüpfung eines Punkts wieder auf. Wirft bei Fehler. */
  onUnlinkSong: (itemId: number, title: string) => Promise<void>;
  /** Setzt das Verantwortlich-Textfeld eines Punkts. Wirft bei Fehler. */
  onSetResponsible: (itemId: number, responsible: string) => Promise<void>;
  /** Setzt die Dauer eines Punkts in Minuten (CT berechnet die Uhrzeiten neu). Wirft bei Fehler. */
  onSetDuration: (itemId: number, durationMin: number) => Promise<void>;
  /** Blendet die Uhrzeit eines Punkts in ChurchTools aus (true) oder ein (false). Wirft bei Fehler. */
  onToggleHidden: (itemId: number, hidden: boolean) => Promise<void>;
  /** Legt einen neuen Punkt an. Wirft bei Fehler. */
  onAdd: (data: {
    type: 'header' | 'text' | 'song';
    title?: string;
    arrangementId?: number;
    responsible?: string;
  }) => Promise<void>;
  /** Verfügbare ChurchTools-Dienste (Chips im Verantwortlich-Editor). */
  services: AgendaServiceOption[];
  /** Darf der Nutzer den Ablauf bearbeiten? (blendet die Bearbeiten-UI aus) */
  canEdit?: boolean;
}

/** Dezentes Linien-Icon für die Zuständigen (statt Emoji). */
function RespIcon() {
  return (
    <svg
      className={styles.respIcon}
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.3" />
      <path d="M5.5 19c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" strokeLinecap="round" />
    </svg>
  );
}

/** Zeile der Zuständigen: besetzte als Name, offene Dienste rot mit „?". */
function ResponsibleLine({ entries }: { entries: AgendaItem['responsible'] }) {
  if (entries.length === 0) return null;
  return (
    <div className={styles.resp}>
      <RespIcon />
      <span className={styles.respList}>
        {entries.map((e, i) =>
          e.open ? (
            <span key={i} className={styles.respOpen}>
              {e.label} ?
            </span>
          ) : (
            <span key={i} className={styles.respName}>
              {e.label}
            </span>
          ),
        )}
      </span>
    </div>
  );
}

/**
 * Read-only „voller Ablauf": alle Punkte mit Uhrzeit, Dauer, Notiz und Zuständigen (wie in
 * ChurchTools). Mit Bearbeiten-Recht lässt sich pro Punkt die Uhrzeit aus-/einblenden (Auge),
 * was direkt in ChurchTools geschrieben wird.
 */
function AgendaFullView({
  items,
  canEdit,
  onToggleHidden,
}: {
  items: AgendaItem[];
  canEdit: boolean;
  onToggleHidden: (itemId: number, hidden: boolean) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);
  function toggle(item: AgendaItem) {
    setBusyId(item.id);
    // Hat der Punkt eine Uhrzeit, blenden wir sie aus (hidden=true); sonst wieder ein.
    void onToggleHidden(item.id, item.time !== null).finally(() => setBusyId(null));
  }
  return (
    <div className={styles.flowList}>
      {items.map((item) => {
        if (item.isHeader) {
          return (
            <div key={item.id} className={styles.sectionBand}>
              {item.time && <span className={styles.bandTime}>{item.time}</span>}
              {item.title}
            </div>
          );
        }
        const title = item.song ? item.song.title : item.title;
        const hidden = item.time === null;
        return (
          <div key={item.id} className={styles.flowRow}>
            <div className={styles.flowTime}>{item.time ?? ''}</div>
            <div className={styles.flowBody}>
              <div className={styles.flowHead}>
                <span className={styles.flowTitle}>{title}</span>
                {item.song && <span className={styles.flowSongTag}>🎵</span>}
                {item.durationMin && <span className={styles.flowDur}>{item.durationMin} Min</span>}
              </div>
              {item.note && <div className={styles.flowNote}>{item.note}</div>}
              <ResponsibleLine entries={item.responsible} />
            </div>
            {canEdit && (
              <button
                className={styles.eyeBtn}
                disabled={busyId === item.id}
                onClick={() => toggle(item)}
                title={hidden ? 'Uhrzeit einblenden' : 'Uhrzeit ausblenden'}
                aria-label={hidden ? 'Uhrzeit einblenden' : 'Uhrzeit ausblenden'}
              >
                <Icon name={hidden ? 'eye-off' : 'eye'} size={17} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Eine sortierbare Zeile im Bearbeiten-Modus. Tippen auf den Titel öffnet das Aktionsmenü. */
function SortableRow({
  item,
  onOpenActions,
}: {
  item: AgendaItem;
  onOpenActions: (item: AgendaItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 1 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.editRow}${item.isHeader ? ' ' + styles.editHeaderRow : ''}`}
    >
      <button className={styles.handle} {...attributes} {...listeners} aria-label="Verschieben">
        ⠿
      </button>
      <button className={styles.editTitleBtn} onClick={() => onOpenActions(item)}>
        <span className={styles.editTitleText}>{item.song ? item.song.title : item.title}</span>
        {item.song && <span className={styles.editSongTag}>🎵</span>}
        <span className={styles.editChevron}>›</span>
      </button>
    </div>
  );
}

/** Kompletter Ablauf eines Gottesdienstes: anzeigen + (mit Rechten) per Drag & Drop umsortieren. */
export function Setlist({
  service,
  items,
  isLoading,
  isError,
  onRetry,
  onSelect,
  onBack,
  onReorder,
  isReordering,
  onDelete,
  onRename,
  onLinkSong,
  onUnlinkSong,
  onSetResponsible,
  onSetDuration,
  onToggleHidden,
  onAdd,
  services,
  canEdit = false,
}: SetlistProps) {
  const [editMode, setEditMode] = useState(false);
  const [view, setView] = useState<'songs' | 'agenda'>('songs');
  const [localItems, setLocalItems] = useState<AgendaItem[]>(items);
  const [err, setErr] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AgendaItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [actionItem, setActionItem] = useState<AgendaItem | null>(null);

  // Server-Stand (auch nach dem Speichern) übernehmen.
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = localItems.findIndex((i) => i.id === active.id);
    const newIndex = localItems.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(localItems, oldIndex, newIndex);
    setLocalItems(next); // optimistisch
    setErr(null);
    onReorder(next.map((i) => i.id)).catch((e: unknown) => {
      setLocalItems(items); // zurückrollen
      setErr(e instanceof Error ? e.message : 'Reihenfolge konnte nicht gespeichert werden.');
    });
  }

  function handleRename(itemId: number, title: string): Promise<void> {
    setErr(null);
    setLocalItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, title } : i)));
    // Fehler wird vom Aktionsmenü angezeigt – hier nur lokal zurückrollen und weiterwerfen.
    return onRename(itemId, title).catch((e: unknown) => {
      setLocalItems(items);
      throw e;
    });
  }

  function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    setErr(null);
    setLocalItems((prev) => prev.filter((i) => i.id !== target.id)); // optimistisch
    onDelete(target.id).catch((e: unknown) => {
      setLocalItems(items); // zurückrollen
      setErr(e instanceof Error ? e.message : 'Punkt konnte nicht gelöscht werden.');
    });
  }

  // Alle Lieder des Ablaufs als eine PDF teilen – jedes Lied EXAKT wie in der App angezeigt
  // (gespeicherte Tonart/Kapo/Schrift/Spalten + die jeweils gewählte Version + Logo im Kopf).
  const exportableSongs = items
    .map((i) => i.song)
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map((s) => {
      const vk = selectedVersionKey(s);
      return { song: { ...s, chordpro: versionText(s, vk) }, versionKey: vk };
    })
    .filter((e) => e.song.chordpro.length > 0);
  async function handleExportPdf() {
    if (exportableSongs.length === 0) return;
    const logo = await loadAppLogo();
    const doc = generateSetlistPdf(
      exportableSongs.map((e) => e.song),
      (s) => {
        const e = exportableSongs.find((x) => x.song.id === s.id);
        return loadSongPdfOpts(s, logo, e?.versionKey);
      },
    );
    void sharePdf(doc, service.name || 'Ablauf');
  }

  // Laufender Zähler über die Lieder – für die Charts-Navigation (Index ins Songs-Array).
  let songIndex = -1;

  return (
    <Screen>
      <NavBar
        title={service.name}
        subtitle={`${service.weekday}, ${service.day}. ${service.month} · ${service.time}`}
        back={onBack}
        backLabel="Termine"
        right={
          !isLoading && !isError && items.length > 0 ? (
            <>
              {exportableSongs.length > 0 && !editMode && (
                <IconButton
                  onClick={() => void handleExportPdf()}
                  title="Alle Lieder als PDF teilen"
                >
                  <Icon name="share" size={20} stroke={2.2} />
                </IconButton>
              )}
              {canEdit && (
                <IconButton
                  onClick={() => {
                    setErr(null);
                    setEditMode((v) => !v);
                  }}
                  title={editMode ? 'Fertig' : 'Ablauf bearbeiten'}
                >
                  <Icon name={editMode ? 'check' : 'pencil'} size={20} stroke={2.2} />
                </IconButton>
              )}
            </>
          ) : undefined
        }
      />
      <Scroll onRefresh={editMode ? undefined : onRetry}>
        {isLoading ? (
          <CenterMessage loading text="Ablauf wird geladen…" />
        ) : isError ? (
          <CenterMessage icon="⚠️" text="Ablauf konnte nicht geladen werden." onRetry={onRetry} />
        ) : items.length === 0 ? (
          <CenterMessage icon="📋" text="Dieser Ablauf enthält noch keine Punkte." />
        ) : editMode ? (
          <>
            <div className={styles.editHint}>
              {isReordering
                ? 'Speichere…'
                : 'Ziehen (⠿) zum Sortieren · Punkt antippen für Umbenennen / Lied verknüpfen / Löschen.'}
            </div>
            {err && <div className={styles.editError}>{err}</div>}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localItems.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className={styles.list}>
                  {localItems.map((item) => (
                    <SortableRow key={item.id} item={item} onOpenActions={setActionItem} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <button className={styles.addBtn} onClick={() => setShowAdd(true)}>
              ＋ Eintrag hinzufügen
            </button>
          </>
        ) : (
          <>
            <Segment
              className={styles.viewSeg}
              value={view}
              options={[
                { value: 'songs', label: 'Lieder' },
                { value: 'agenda', label: 'Ablauf' },
              ]}
              onChange={setView}
            />
            {view === 'agenda' ? (
              <AgendaFullView items={items} canEdit={canEdit} onToggleHidden={onToggleHidden} />
            ) : (
              <div className={styles.list}>
                {items.map((item) => {
                  if (item.isHeader) {
                    return (
                      <div key={item.id} className={styles.sectionBand}>
                        {item.title}
                      </div>
                    );
                  }
                  if (item.song) {
                    songIndex += 1;
                    const idx = songIndex;
                    const song = item.song;
                    const savedKey = localStorage.getItem(`worship_key_${song.id}`);
                    const dispKey = savedKey || song.targetKey;
                    const transposed = song.originalKey !== dispKey;
                    return (
                      <button
                        key={item.id}
                        className={styles.songRow}
                        onClick={() => onSelect(idx)}
                      >
                        <div className={styles.num}>{idx + 1}</div>
                        <NoteTile size={38} />
                        <div className={styles.info}>
                          <div className={styles.name}>{song.title}</div>
                          <div className={styles.sub}>
                            {song.bpm !== null && <span>♩ {song.bpm}</span>}
                            {song.bpm !== null && song.timeSig && (
                              <span className={styles.dotSep}>·</span>
                            )}
                            {song.timeSig && <span>{song.timeSig}</span>}
                          </div>
                          <ResponsibleLine entries={item.responsible} />
                        </div>
                        <span className={styles.keyPill}>
                          {transposed && <span className={styles.keyOrig}>{song.originalKey}</span>}
                          {dispKey}
                        </span>
                        <Icon name="chev-right" size={18} stroke={2.2} className={styles.chev} />
                      </button>
                    );
                  }
                  return (
                    <div key={item.id} className={styles.textTile}>
                      <div className={styles.textTitle}>{item.title}</div>
                      <ResponsibleLine entries={item.responsible} />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        <div style={{ height: 20 }} />
      </Scroll>

      {pendingDelete && (
        <ConfirmDialog
          title="Punkt löschen?"
          message={`„${pendingDelete.song ? pendingDelete.song.title : pendingDelete.title}" wird aus dem Ablauf in ChurchTools entfernt.`}
          confirmLabel="Löschen"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {showAdd && (
        <AddItemSheet onClose={() => setShowAdd(false)} onAdd={onAdd} services={services} />
      )}

      {actionItem && (
        <ItemActionSheet
          item={actionItem}
          services={services}
          onClose={() => setActionItem(null)}
          onRename={(title) => handleRename(actionItem.id, title)}
          onLinkSong={(arrangementId) => onLinkSong(actionItem.id, arrangementId)}
          onUnlinkSong={() =>
            onUnlinkSong(actionItem.id, actionItem.song?.title ?? actionItem.title)
          }
          onSetResponsible={(responsible) => onSetResponsible(actionItem.id, responsible)}
          onSetDuration={(durationMin) => onSetDuration(actionItem.id, durationMin)}
          onRequestDelete={() => setPendingDelete(actionItem)}
        />
      )}
    </Screen>
  );
}
