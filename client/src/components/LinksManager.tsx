import { useState } from 'react';
import type { SiteConfig, SiteLink } from '@shared/types/index';
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
import { Spinner } from './Spinner';
import { Icon } from './icons';
import { useUpdateSiteConfig } from '../hooks/useSiteConfig';
import styles from './LinksManager.module.scss';

/** Eindeutige ID – mit Fallback, da crypto.randomUUID nur im sicheren Kontext (HTTPS) existiert. */
function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function newLink(): SiteLink {
  return { id: genId(), label: '', url: '', showOnLogin: false };
}

/** Eine sortierbare Link-Karte (Text, Adresse, Login-Schalter, Löschen). */
function SortableLink({
  link,
  onChange,
  onRemove,
}: {
  link: SiteLink;
  onChange: (next: SiteLink) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 1 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className={styles.card}>
      <div className={styles.cardTop}>
        <button className={styles.handle} {...attributes} {...listeners} aria-label="Verschieben">
          ⠿
        </button>
        <input
          className={styles.labelInput}
          value={link.label}
          maxLength={60}
          placeholder="Button-Text"
          onChange={(e) => onChange({ ...link, label: e.target.value })}
        />
        <button className={styles.del} onClick={onRemove} aria-label="Link löschen">
          <Icon name="trash" size={18} />
        </button>
      </div>
      <input
        className={styles.urlInput}
        value={link.url}
        inputMode="url"
        placeholder="https://…"
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => onChange({ ...link, url: e.target.value })}
      />
      <button
        type="button"
        className={styles.loginRow}
        onClick={() => onChange({ ...link, showOnLogin: !link.showOnLogin })}
      >
        <span className={styles.loginLbl}>Auch auf Login-Seite zeigen</span>
        <span className={`${styles.tog}${link.showOnLogin ? ' ' + styles.togOn : ''}`}>
          <span className={styles.togThumb} />
        </span>
      </button>
    </div>
  );
}

/** Admin-Verwaltung der frei konfigurierbaren Links (im Sheet eingebettet). */
export function LinksManager({ site, onClose }: { site: SiteConfig; onClose: () => void }) {
  const [links, setLinks] = useState<SiteLink[]>(site.links);
  const [err, setErr] = useState<string | null>(null);
  const update = useUpdateSiteConfig();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = links.findIndex((l) => l.id === active.id);
    const newIndex = links.findIndex((l) => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setLinks(arrayMove(links, oldIndex, newIndex));
  }

  function save() {
    setErr(null);
    // Leere Zeilen verwerfen, Eingaben säubern.
    const cleaned = links
      .map((l) => ({ ...l, label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.label || l.url);
    for (const l of cleaned) {
      if (!l.label || !l.url) {
        setErr('Bitte für jeden Link einen Text und eine Adresse angeben.');
        return;
      }
      if (!/^https?:\/\//i.test(l.url)) {
        setErr('Adressen müssen mit http:// oder https:// beginnen.');
        return;
      }
    }
    update.mutate(
      { ...site, links: cleaned },
      { onSuccess: onClose, onError: () => setErr('Speichern fehlgeschlagen.') },
    );
  }

  return (
    <div className={styles.wrap}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={links.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <div className={styles.list}>
            {links.map((l) => (
              <SortableLink
                key={l.id}
                link={l}
                onChange={(next) =>
                  setLinks((cur) => cur.map((x) => (x.id === next.id ? next : x)))
                }
                onRemove={() => setLinks((cur) => cur.filter((x) => x.id !== l.id))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button className={styles.add} onClick={() => setLinks((cur) => [...cur, newLink()])}>
        <Icon name="plus" size={18} /> Link hinzufügen
      </button>

      {err && <div className={styles.err}>{err}</div>}

      <button className={styles.save} onClick={save} disabled={update.isPending}>
        {update.isPending ? <Spinner /> : 'Speichern'}
      </button>
    </div>
  );
}
