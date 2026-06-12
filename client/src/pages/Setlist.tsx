import { useEffect, useState } from 'react';
import type { AgendaItem, Service } from '@shared/types/index';
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
import { CenterMessage } from '../components/CenterMessage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AddItemSheet } from '../components/AddItemSheet';
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
  /** Legt einen neuen Punkt an. Wirft bei Fehler. */
  onAdd: (data: { type: 'header' | 'text' | 'song'; title?: string; arrangementId?: number }) => Promise<void>;
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

/** Eine sortierbare Zeile im Bearbeiten-Modus. */
function SortableRow({
  item,
  onRequestDelete,
  onRename,
}: {
  item: AgendaItem;
  onRequestDelete: (item: AgendaItem) => void;
  onRename: (itemId: number, title: string) => void;
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
      {item.song ? (
        // Lieder: Titel = Songname, nicht hier umbenennbar
        <span className={styles.editTitle}>{item.song.title}</span>
      ) : (
        <input
          className={styles.editInput}
          defaultValue={item.title}
          aria-label="Titel"
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== item.title) onRename(item.id, v);
          }}
        />
      )}
      <button
        className={styles.delBtn}
        onClick={() => onRequestDelete(item)}
        aria-label="Punkt löschen"
        title="Punkt löschen"
      >
        🗑
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
  onAdd,
}: SetlistProps) {
  const [editMode, setEditMode] = useState(false);
  const [localItems, setLocalItems] = useState<AgendaItem[]>(items);
  const [err, setErr] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AgendaItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);

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

  function handleRename(itemId: number, title: string) {
    setErr(null);
    setLocalItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, title } : i)));
    onRename(itemId, title).catch((e: unknown) => {
      setLocalItems(items); // zurückrollen
      setErr(e instanceof Error ? e.message : 'Umbenennen fehlgeschlagen.');
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

  // Laufender Zähler über die Lieder – für die Charts-Navigation (Index ins Songs-Array).
  let songIndex = -1;

  return (
    <Screen>
      <NavBar
        title={service.name}
        subtitle={`${service.weekday}, ${service.day}. ${service.month} · ${service.time}`}
        left={<IconButton onClick={onBack}>‹</IconButton>}
        right={
          items.length > 0 && !isLoading && !isError ? (
            <IconButton
              onClick={() => {
                setErr(null);
                setEditMode((v) => !v);
              }}
              title={editMode ? 'Fertig' : 'Ablauf bearbeiten'}
              style={{ fontSize: 18 }}
            >
              {editMode ? '✓' : '✎'}
            </IconButton>
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
              {isReordering ? 'Speichere…' : 'Ziehen (⠿) zum Sortieren · Titel tippen zum Umbenennen · 🗑 zum Löschen.'}
            </div>
            {err && <div className={styles.editError}>{err}</div>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={localItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className={styles.list}>
                  {localItems.map((item) => (
                    <SortableRow
                      key={item.id}
                      item={item}
                      onRequestDelete={setPendingDelete}
                      onRename={handleRename}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <button className={styles.addBtn} onClick={() => setShowAdd(true)}>
              ＋ Punkt hinzufügen
            </button>
          </>
        ) : (
          <div className={styles.list}>
            {items.map((item) => {
              if (item.isHeader) {
                return (
                  <div key={item.id} className={styles.header}>
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
                return (
                  <div key={item.id} className={styles.row} onClick={() => onSelect(idx)}>
                    <div className={styles.num}>{idx + 1}</div>
                    <div className={styles.info}>
                      <div className={styles.name}>{song.title}</div>
                      <div className={styles.chips}>
                        <span className={styles.chipKey}>
                          {song.originalKey}
                          {song.originalKey !== dispKey && (
                            <>
                              <span className={styles.toArr}>→</span>
                              {dispKey}
                            </>
                          )}
                        </span>
                        {song.bpm !== null && <span className={styles.chipBpm}>♩ {song.bpm}</span>}
                        {song.timeSig && <span className={styles.timeSig}>{song.timeSig}</span>}
                      </div>
                      {item.responsible.length > 0 && (
                        <div className={styles.resp}>
                          <RespIcon /> {item.responsible.join(', ')}
                        </div>
                      )}
                    </div>
                    <span className={styles.arr}>›</span>
                  </div>
                );
              }
              return (
                <div key={item.id} className={styles.textTile}>
                  <div className={styles.textTitle}>{item.title}</div>
                  {item.responsible.length > 0 && (
                    <div className={styles.resp}>
                      <RespIcon /> {item.responsible.join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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

      {showAdd && <AddItemSheet onClose={() => setShowAdd(false)} onAdd={onAdd} />}
    </Screen>
  );
}
