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
}

/** Eine sortierbare Zeile im Bearbeiten-Modus. */
function SortableRow({ item }: { item: AgendaItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 1 : undefined,
  };
  const label = item.song ? item.song.title : item.title;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.editRow}${item.isHeader ? ' ' + styles.editHeaderRow : ''}`}
    >
      <button className={styles.handle} {...attributes} {...listeners} aria-label="Verschieben">
        ⠿
      </button>
      <span className={styles.editTitle}>{label}</span>
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
}: SetlistProps) {
  const [editMode, setEditMode] = useState(false);
  const [localItems, setLocalItems] = useState<AgendaItem[]>(items);
  const [err, setErr] = useState<string | null>(null);

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
              {isReordering ? 'Speichere…' : 'Punkte am Griff ⠿ ziehen, um die Reihenfolge zu ändern.'}
            </div>
            {err && <div className={styles.editError}>{err}</div>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={localItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className={styles.list}>
                  {localItems.map((item) => (
                    <SortableRow key={item.id} item={item} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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
                    </div>
                    <span className={styles.arr}>›</span>
                  </div>
                );
              }
              return (
                <div key={item.id} className={styles.itemRow}>
                  <span className={styles.bullet} />
                  <div className={styles.itemTitle}>{item.title}</div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ height: 20 }} />
      </Scroll>
    </Screen>
  );
}
