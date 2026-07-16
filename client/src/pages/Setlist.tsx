import { useEffect, useRef, useState } from 'react';
import type { AgendaItem, AgendaServiceOption, Service } from '@shared/types/index';
import type { AgendaItemUpdate } from '../services/churchtoolsApi';
import { disintegrate } from '../utils/disintegrate';
import { vanishedRows, type ShownRow } from '../utils/vanishedRows';
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
export interface NewAgendaItem {
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
export interface AgendaActions {
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
        {entries.map((e, i) => {
          // Kommagetrennt; das Komma steht MIT im Namens-Span, damit es beim Umbruch am Namen bleibt.
          const sep = i < entries.length - 1 ? ',' : '';
          return e.open ? (
            <span key={i} className={styles.respOpen}>
              {e.label} ?{sep}
            </span>
          ) : (
            <span key={i} className={styles.respName}>
              {e.label}
              {sep}
            </span>
          );
        })}
      </span>
    </div>
  );
}

/**
 * „Voller Ablauf": alle Punkte mit Uhrzeit, Dauer, Notiz und Zuständigen (wie in ChurchTools,
 * aber aufgeräumt). Lieder sind antippbar (→ Charts). Die Uhrzeit (`item.time`) ist bereits
 * serverseitig korrekt: in ChurchTools ausgeblendete Punkte (Auge) liefern keine Zeit.
 */
/**
 * Zeile eines entfernten Ablaufpunkts (#161 Etappe B): kurz durchgestrichen sichtbar, dann
 * „poof"-Zerfall à la iOS – die Zeile wird abfotografiert, in Partikel zerlegt (utils/disintegrate)
 * und die echte Zeile fällt zusammen. Fällt html2canvas aus, wird einfach ausgeblendet.
 */
function DisintegratingRow({ title }: { title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    // Reduzierte Bewegung: kein Effekt, direkt zusammenfalten.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setGone(true);
      return;
    }
    const t = setTimeout(async () => {
      const rect = el.getBoundingClientRect();
      try {
        const html2canvas = (await import('html2canvas')).default;
        if (cancelled) return;
        const snap = await html2canvas(el, { backgroundColor: null, scale: 1, logging: false });
        if (cancelled) return;
        setGone(true); // echte Zeile verschwindet + fällt zusammen …
        disintegrate(snap, rect); // … während die Partikel verwehen
      } catch {
        if (!cancelled) setGone(true);
      }
    }, 450); // kurz lesbar, bevor es zerfällt
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);
  return (
    <div
      ref={ref}
      className={`${styles.removedRow}${gone ? ` ${styles.removedGone}` : ''}`}
      aria-label={`Entfernt: ${title}`}
    >
      <div className={styles.flowTime} />
      <div className={styles.flowBody}>
        <div className={styles.flowHead}>
          <span className={styles.removedTitle}>{title}</span>
          <span className={styles.removedTag}>entfernt</span>
        </div>
      </div>
    </div>
  );
}

function AgendaFullView({
  items,
  eventId,
  onSelect,
}: {
  items: AgendaItem[];
  eventId: number;
  onSelect: (songIndex: number) => void;
}) {
  let songIndex = -1;
  // Lokal erzeugte „aufgelöst"-Platzhalter (#178): Punkte, die seit dem Betreten hinzukamen und
  // wieder gelöscht wurden, stehen nicht in der „gesehen"-Basislinie → der Server liefert für sie
  // KEINEN removed-Platzhalter. Die Ansicht merkt sich deshalb selbst, was sie zuletzt gezeigt
  // hat, und lässt auch solche Punkte sichtbar zerfallen statt sie kommentarlos zu entfernen.
  const prevShown = useRef<{ eventId: number; items: AgendaItem[]; rows: ShownRow[] } | null>(null);
  const [localRemoved, setLocalRemoved] = useState<
    { id: number; title: string; afterId: number | null; at: number }[]
  >([]);
  // SYNCHRON während des Renderns abgleichen (NICHT useEffect): sonst rendert erst ein Frame OHNE
  // die gelöschte Zeile (Layout springt), dann fügt der Effekt den Platzhalter wieder ein
  // („blinkt"). Bedingtes setState im Render ist das dokumentierte „State an geänderte Props
  // anpassen"-Muster – gleiche #113-Lektion wie in usePageDraw.
  const prev = prevShown.current;
  if (!prev || prev.eventId !== eventId || prev.items !== items) {
    const shown: ShownRow[] = items
      .filter((i) => !i.removed)
      .map((i) => ({ id: i.id, title: i.song ? i.song.title : i.title }));
    prevShown.current = { eventId, items, rows: shown };
    if (!prev || prev.eventId !== eventId) {
      // Terminwechsel/Erstaufbau: nichts auflösen, nur Merkstand setzen.
      if (localRemoved.length) setLocalRemoved([]);
    } else {
      const presentIds = new Set(items.map((i) => i.id));
      const vanished = vanishedRows(prev.rows, presentIds);
      const now = Date.now();
      setLocalRemoved((cur) => {
        // Wieder aufgetauchte IDs (rückgängig gemacht) und alte, längst zerfallene Einträge räumen.
        const kept = cur.filter((c) => !presentIds.has(c.id) && now - c.at < 60_000);
        const fresh = vanished
          .filter((v) => !kept.some((c) => c.id === v.id))
          .map((v) => ({ ...v, at: now }));
        return fresh.length || kept.length !== cur.length ? [...kept, ...fresh] : cur;
      });
    }
  }
  // Lokale Platzhalter an ihrer alten Position einfügen (gleiches Muster wie serverseitig).
  const rendered: (AgendaItem | { id: number; title: string; removed: true })[] = [];
  for (const lr of localRemoved) {
    if (lr.afterId == null) rendered.push({ id: lr.id, title: lr.title, removed: true });
  }
  for (const item of items) {
    rendered.push(item);
    for (const lr of localRemoved) {
      if (lr.afterId === item.id) rendered.push({ id: lr.id, title: lr.title, removed: true });
    }
  }
  return (
    <div className={styles.flowList}>
      {rendered.map((item) => {
        // Entfernter Punkt (#161 Etappe B): kurz sichtbar, dann „poof"-Zerfall.
        if (item.removed) {
          return <DisintegratingRow key={item.id} title={item.title} />;
        }
        const showTime = !!item.time;
        // Geänderter/neuer/verschobener Punkt (#161) leuchtet beim Öffnen kurz auf.
        const chg = item.changed ? ` ${styles.changed}` : '';
        if (item.isHeader) {
          return (
            <div key={item.id} className={`${styles.sectionBand}${chg}`}>
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
              className={`${styles.flowRowBtn} ${styles.songRow}${chg}`}
              data-tour={idx === 0 ? 'setlist-song' : undefined}
              onClick={() => onSelect(idx)}
            >
              {timeCol}
              {body}
            </button>
          );
        }
        return (
          <div key={item.id} className={`${styles.flowRow}${chg}`}>
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
        <button
          className={styles.bandHandle}
          {...attributes}
          {...listeners}
          aria-label="Verschieben"
        >
          <Icon name="grip" size={16} />
        </button>
        <button className={styles.bandEdit} onClick={() => onOpenActions(item)}>
          {item.title}
        </button>
        <button
          className={styles.rowEdit}
          onClick={() => onOpenActions(item)}
          aria-label="Bearbeiten"
        >
          <Icon name="pencil" size={15} stroke={2} />
        </button>
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
      <button
        className={styles.dragCol}
        data-tour="edit-drag"
        {...attributes}
        {...listeners}
        aria-label="Verschieben"
      >
        <Icon name="grip" size={18} />
      </button>
      <button className={styles.editBody} data-tour="edit-item" onClick={() => onOpenActions(item)}>
        <div className={styles.flowHead}>
          <span className={styles.flowTitle}>{item.song ? item.song.title : item.title}</span>
          {item.song && <span className={styles.flowSongTag}>🎵</span>}
          {item.durationMin && <span className={styles.flowDur}>{item.durationMin} Min</span>}
        </div>
        {item.note && <div className={styles.flowNote}>{item.note}</div>}
        <ResponsibleLine entries={item.responsible} />
      </button>
      <button
        className={styles.rowEdit}
        onClick={() => onOpenActions(item)}
        aria-label="Bearbeiten"
      >
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
          message={`„${pendingDelete.song ? pendingDelete.song.title : pendingDelete.title}" wird aus dem Ablauf in ChurchTools entfernt.`}
          confirmLabel="Löschen"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {showAdd && (
        <AddItemSheet onClose={() => setShowAdd(false)} onAdd={handleAdd} services={services} />
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
