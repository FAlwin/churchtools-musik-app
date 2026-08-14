import { useEffect, useRef, useState } from 'react';
import type { AgendaItem, AgendaServiceOption, Service } from '@shared/types/index';
import type { AgendaItemUpdate } from '../services/churchtoolsApi';
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
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Screen, Scroll } from '../components/Screen';
import { NavBar, IconButton } from '../components/NavBar';
import { CenterMessage } from '../components/CenterMessage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AddItemSheet } from '../components/AddItemSheet';
import { AgendaFullView } from '../components/AgendaFullView';
import { SortableRow } from '../components/AgendaSortableRow';
import { ItemActionSheet } from '../components/ItemActionSheet';
import { Icon } from '../components/icons';
import { itemLabel } from '../utils/agendaItemTitle';
import { Coachmarks } from '../components/Coachmarks';
import {
  SETLIST_STEPS,
  SETLIST_EDIT_STEPS,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  isTourDone,
  markTourDone,
} from '../utils/onboarding';
import { generateSetlistPdf } from '../utils/chordPdf';
import { sharePdf } from '../utils/sharePdf';
import { loadSongPdfOpts, loadAppLogo } from '../utils/songPdfOpts';
import { selectedVersionKey, versionText } from '../utils/songVersions';
import { innerScrollOnly, resetViewportAfterDrag } from '../utils/dndAutoScroll';
import styles from './Setlist.module.scss';

/** Neuer Ablaufpunkt (Payload von `AgendaActions.add`). */
interface NewAgendaItem {
  type: 'header' | 'text' | 'song';
  title?: string;
  arrangementId?: number;
  responsible?: string;
  note?: string;
  durationMin?: number;
}

/**
 * Gebündelte Bearbeiten-Aktionen des Ablaufs – EIN Objekt statt einzelner Callback-Props durch
 * alle Ebenen. Alle Aktionen werfen bei Fehler (z. B. fehlende Rechte); die UI zeigt die Meldung.
 */
interface AgendaActions {
  /** Speichert die neue Reihenfolge (Item-IDs). */
  reorder: (order: number[]) => Promise<void>;
  /** Löscht einen Ablaufpunkt. */
  remove: (itemId: number) => Promise<void>;
  /** Schreibt geänderte Felder eines Punkts gesammelt (ein Request). */
  update: (itemId: number, fields: AgendaItemUpdate) => Promise<void>;
  /** Blendet die Uhrzeit eines Punkts in ChurchTools aus (true) oder ein (false). */
  setHidden: (itemId: number, hidden: boolean) => Promise<void>;
  /** Legt einen neuen Punkt an. */
  add: (data: NewAgendaItem) => Promise<void>;
}

interface SetlistProps {
  service: Service;
  items: AgendaItem[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** Wird mit dem Index des Lieds (nur Lieder gezählt) aufgerufen. */
  onSelect: (songIndex: number) => void;
  onBack: () => void;
  /** Bearbeiten-Aktionen (Reihenfolge, Löschen, Feld-Änderungen, Anlegen). */
  actions: AgendaActions;
  isReordering?: boolean;
  /** Verfügbare ChurchTools-Dienste (Chips im Verantwortlich-Editor). */
  services: AgendaServiceOption[];
  /** Darf der Nutzer den Ablauf bearbeiten? (blendet die Bearbeiten-UI aus) */
  canEdit?: boolean;
}

export function Setlist({
  service,
  items,
  isLoading,
  isError,
  onRetry,
  onSelect,
  onBack,
  actions,
  isReordering,
  services,
  canEdit = false,
}: SetlistProps) {
  const [editMode, setEditMode] = useState(false);
  // Geführte Einführung (#Onboarding, Gruppen 3+4): Ablauf-Ansicht beim ersten Öffnen, Bearbeiten-
  // Modus beim ersten Wechsel dorthin. Startet erst, wenn die Ziel-Elemente gerendert sind.
  const [setlistTour, setSetlistTour] = useState(false);
  const [editTour, setEditTour] = useState(false);
  // Bearbeiten-Modus/Drag arbeitet nur mit echten Punkten – die „entfernt"-Platzhalter (#161
  // Etappe B) gehören ausschließlich in die read-only Ansicht.
  const [localItems, setLocalItems] = useState<AgendaItem[]>(items.filter((i) => !i.removed));
  const [err, setErr] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AgendaItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [actionItem, setActionItem] = useState<AgendaItem | null>(null);
  // Nach dem Hinzufügen eines Lieds automatisch dessen Bearbeiten-Modal öffnen (Dauer usw. sofort
  // einstellbar). Wir merken uns die IDs vor dem Anlegen und öffnen den erst danach neu
  // auftauchenden Punkt, sobald der aktualisierte Ablauf eintrifft.
  const [awaitNewSong, setAwaitNewSong] = useState(false);
  const idsBeforeAddRef = useRef<Set<number>>(new Set());

  // Server-Stand (auch nach dem Speichern) übernehmen – ohne „entfernt"-Platzhalter.
  useEffect(() => {
    setLocalItems(items.filter((i) => !i.removed));
  }, [items]);

  // Einführung Ablauf-Ansicht beim ersten Öffnen (Daten geladen, Ansicht-Modus).
  useEffect(() => {
    if (!isLoading && !isError && items.length > 0 && !editMode && !isTourDone(TOUR_SETLIST)) {
      setSetlistTour(true);
    }
  }, [isLoading, isError, items.length, editMode]);

  // Einführung Bearbeiten-Modus beim ersten Wechsel dorthin.
  useEffect(() => {
    if (editMode && !isTourDone(TOUR_SETLIST_EDIT)) setEditTour(true);
  }, [editMode]);

  // Neu angelegtes Lied im aktualisierten Ablauf finden und sein Bearbeiten-Modal öffnen.
  useEffect(() => {
    if (!awaitNewSong) return;
    const created = items.find((i) => !idsBeforeAddRef.current.has(i.id));
    if (created) {
      setActionItem(created);
      setAwaitNewSong(false);
    }
  }, [items, awaitNewSong]);

  /** Legt einen Punkt an; bei Liedern anschließend das Bearbeiten-Modal öffnen. */
  async function handleAdd(data: NewAgendaItem): Promise<void> {
    const isSong = data.type === 'song';
    if (isSong) idsBeforeAddRef.current = new Set(items.map((i) => i.id));
    await actions.add(data); // wirft bei Fehler → AddItemSheet zeigt die Meldung, schließt nicht
    if (isSong) setAwaitNewSong(true);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    resetViewportAfterDrag(); // #56: weggerutschte Kopfleiste zurückholen (auch ohne Umsortierung)
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = localItems.findIndex((i) => i.id === active.id);
    const newIndex = localItems.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(localItems, oldIndex, newIndex);
    setLocalItems(next); // optimistisch
    setErr(null);
    actions.reorder(next.map((i) => i.id)).catch((e: unknown) => {
      setLocalItems(items); // zurückrollen
      setErr(e instanceof Error ? e.message : 'Reihenfolge konnte nicht gespeichert werden.');
    });
  }

  /** Schreibt Feld-Änderungen (ein Request); Titel optimistisch lokal spiegeln. */
  function handleUpdate(itemId: number, fields: AgendaItemUpdate): Promise<void> {
    setErr(null);
    if (fields.title !== undefined) {
      const title = fields.title;
      setLocalItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, title } : i)));
    }
    // Fehler wird vom Aktionsmenü angezeigt – hier nur lokal zurückrollen und weiterwerfen.
    return actions.update(itemId, fields).catch((e: unknown) => {
      setLocalItems(items.filter((i) => !i.removed));
      throw e;
    });
  }

  function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    setErr(null);
    setLocalItems((prev) => prev.filter((i) => i.id !== target.id)); // optimistisch
    actions.remove(target.id).catch((e: unknown) => {
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
  // Lieder, die NUR wegen eines Ladefehlers fehlen würden (#274). Ohne diesen Hinweis fiele das Lied
  // stumm aus der geteilten PDF – und niemandem fällt auf, dass ein Blatt fehlt.
  const nichtGeladen = items
    .map((i) => i.song)
    .filter((s): s is NonNullable<typeof s> => !!s && !!s.chordproFailed)
    .map((s) => s.title);

  async function handleExportPdf() {
    if (nichtGeladen.length > 0) {
      const liste = nichtGeladen.join(', ');
      const weiter = window.confirm(
        `Von ${nichtGeladen.length === 1 ? 'einem Lied' : `${nichtGeladen.length} Liedern`} konnten die Akkorde nicht geladen werden (${liste}). ` +
          `${nichtGeladen.length === 1 ? 'Es fehlt' : 'Sie fehlen'} dann im PDF.\n\nTrotzdem teilen?`,
      );
      if (!weiter) return;
    }
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
                  dataTour="setlist-share"
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
                  dataTour="setlist-edit"
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
              {isReordering ? (
                'Speichere…'
              ) : (
                <>
                  Ziehen <Icon name="grip" size={14} className={styles.hintIcon} /> zum Sortieren ·
                  Eintrag antippen zum Bearbeiten.
                </>
              )}
            </div>
            {err && <div className={styles.editError}>{err}</div>}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              onDragCancel={resetViewportAfterDrag}
              autoScroll={innerScrollOnly}
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
            <button className={styles.addBtn} data-tour="edit-add" onClick={() => setShowAdd(true)}>
              ＋ Eintrag hinzufügen
            </button>
          </>
        ) : (
          <AgendaFullView items={items} eventId={service.id} onSelect={onSelect} />
        )}
        <div style={{ height: 20 }} />
      </Scroll>

      {pendingDelete && (
        <ConfirmDialog
          title="Eintrag löschen?"
          message={`„${itemLabel(pendingDelete)}" wird aus dem Ablauf in ChurchTools entfernt.`}
          confirmLabel="Löschen"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {showAdd && (
        <AddItemSheet
          eventId={service.id}
          eventName={service.name}
          onClose={() => setShowAdd(false)}
          onAdd={handleAdd}
          services={services}
        />
      )}

      {actionItem && (
        <ItemActionSheet
          // Beim Wechsel eines anderen Punkts frischen Dialog-Zustand aufbauen.
          key={actionItem.id}
          item={actionItem}
          services={services}
          onClose={() => setActionItem(null)}
          onUpdate={(fields) => handleUpdate(actionItem.id, fields)}
          timeHidden={actionItem.time === null}
          onSetHidden={(hidden) => actions.setHidden(actionItem.id, hidden)}
          onRequestDelete={() => setPendingDelete(actionItem)}
        />
      )}

      {setlistTour && (
        <Coachmarks
          steps={SETLIST_STEPS}
          onClose={() => {
            markTourDone(TOUR_SETLIST);
            setSetlistTour(false);
          }}
        />
      )}
      {editTour && (
        <Coachmarks
          steps={SETLIST_EDIT_STEPS}
          onClose={() => {
            markTourDone(TOUR_SETLIST_EDIT);
            setEditTour(false);
          }}
        />
      )}
    </Screen>
  );
}
