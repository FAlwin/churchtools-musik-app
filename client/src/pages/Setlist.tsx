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
import { CenterMessage } from '../components/CenterMessage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AddItemSheet } from '../components/AddItemSheet';
import { ItemActionSheet } from '../components/ItemActionSheet';
import { Icon } from '../components/icons';
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
  /** Setzt die Bemerkung/Notiz eines Punkts. Wirft bei Fehler. */
  onSetNote: (itemId: number, note: string) => Promise<void>;
  /** Legt einen neuen Punkt an. Wirft bei Fehler. */
  onAdd: (data: {
    type: 'header' | 'text' | 'song';
    title?: string;
    arrangementId?: number;
    responsible?: string;
    note?: string;
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
 * „Voller Ablauf": alle Punkte mit Uhrzeit, Dauer, Notiz und Zuständigen (wie in ChurchTools,
 * aber aufgeräumt). Lieder sind antippbar (→ Charts). Die Uhrzeit (`item.time`) ist bereits
 * serverseitig korrekt: in ChurchTools ausgeblendete Punkte (Auge) liefern keine Zeit.
 */
function AgendaFullView({
  items,
  onSelect,
}: {
  items: AgendaItem[];
  onSelect: (songIndex: number) => void;
}) {
  let songIndex = -1;
  return (
    <div className={styles.flowList}>
      {items.map((item) => {
        const showTime = !!item.time;
        if (item.isHeader) {
          return (
            <div key={item.id} className={styles.sectionBand}>
              {showTime && <span className={styles.bandTime}>{item.time}</span>}
              {item.title}
            </div>
          );
        }
        const timeCol = <div className={styles.flowTime}>{showTime ? item.time : ''}</div>;
        const body = (
          <div className={styles.flowBody}>
            <div className={styles.flowHead}>
              <span className={styles.flowTitle}>{item.song ? item.song.title : item.title}</span>
              {item.song && <span className={styles.flowSongTag}>🎵</span>}
              {item.durationMin && <span className={styles.flowDur}>{item.durationMin} Min</span>}
            </div>
            {item.note && <div className={styles.flowNote}>{item.note}</div>}
            <ResponsibleLine entries={item.responsible} />
          </div>
        );
        if (item.song) {
          songIndex += 1;
          const idx = songIndex;
          return (
            <button
              key={item.id}
              className={`${styles.flowRowBtn} ${styles.songRow}`}
              onClick={() => onSelect(idx)}
            >
              {timeCol}
              {body}
            </button>
          );
        }
        return (
          <div key={item.id} className={styles.flowRow}>
            {timeCol}
            {body}
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
  // Überschriften bleiben schmale Bänder wie in der Ansicht – nur mit Ziehen-Griff davor,
  // damit sich beim Umschalten in den Bearbeiten-Modus Position und Höhe nicht ändern.
  if (item.isHeader) {
    return (
      <div ref={setNodeRef} style={style} className={`${styles.sectionBand} ${styles.editBand}`}>
        <button className={styles.bandHandle} {...attributes} {...listeners} aria-label="Verschieben">
          ⠿
        </button>
        {item.title}
      </div>
    );
  }

  // Normale Zeile: gleiche Optik wie die Ansicht (Zeit-Spalte → Ziehen-Griff), Antippen öffnet
  // das Aktionsmenü statt zu den Charts zu führen. Dauer + Zuständige bleiben sichtbar, damit die
  // Zeilenhöhe exakt der Ansicht entspricht.
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.flowRow}${item.song ? ' ' + styles.songRow : ''}`}
    >
      <button className={styles.dragCol} {...attributes} {...listeners} aria-label="Verschieben">
        ⠿
      </button>
      <button className={styles.editBody} onClick={() => onOpenActions(item)}>
        <div className={styles.flowHead}>
          <span className={styles.flowTitle}>{item.song ? item.song.title : item.title}</span>
          {item.song && <span className={styles.flowSongTag}>🎵</span>}
          {item.durationMin && <span className={styles.flowDur}>{item.durationMin} Min</span>}
        </div>
        {item.note && <div className={styles.flowNote}>{item.note}</div>}
        <ResponsibleLine entries={item.responsible} />
      </button>
      <button className={styles.rowEdit} onClick={() => onOpenActions(item)} aria-label="Bearbeiten">
        <Icon name="pencil" size={15} stroke={2} />
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
  onSetNote,
  onAdd,
  services,
  canEdit = false,
}: SetlistProps) {
  const [editMode, setEditMode] = useState(false);
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
                : 'Ziehen (⠿) zum Sortieren · Eintrag antippen zum Bearbeiten.'}
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
          <AgendaFullView items={items} onSelect={onSelect} />
        )}
        <div style={{ height: 20 }} />
      </Scroll>

      {pendingDelete && (
        <ConfirmDialog
          title="Eintrag löschen?"
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
          timeHidden={actionItem.time === null}
          onToggleHidden={(hidden) => onToggleHidden(actionItem.id, hidden)}
          onSetNote={(note) => onSetNote(actionItem.id, note)}
          onRequestDelete={() => setPendingDelete(actionItem)}
        />
      )}
    </Screen>
  );
}
