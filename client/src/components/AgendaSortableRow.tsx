/**
 * Eine sortierbare Zeile im Bearbeiten-Modus (#198 – vorher in `pages/Setlist.tsx`).
 *
 * Tippen auf den Titel öffnet das Aktionsmenü; gezogen wird ausschließlich am Griff – sonst würde
 * jeder Tipp auf die Zeile ein Ziehen einleiten und das Menü ließe sich kaum öffnen.
 */
import type { AgendaItem } from '@shared/types/index';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from './icons';
import { ItemTitle, ResponsibleLine } from './AgendaRowParts';
import styles from '../pages/Setlist.module.scss';

/** Eine sortierbare Zeile im Bearbeiten-Modus. Tippen auf den Titel öffnet das Aktionsmenü. */
export function SortableRow({
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
          <ItemTitle item={item} />
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
