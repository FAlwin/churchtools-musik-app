/**
 * Darstellung einzelner Ablaufpunkte: Typ, Uhrzeit, Dienstnamen, Zuständige (#198).
 *
 * Rein und ohne Netzzugriff. Hier stecken die kleinen ChurchTools-Eigenheiten, die sonst überall
 * verstreut wären: Zeiten kommen als UTC und müssen als deutsche Ortszeit erscheinen, Dienst-Tokens
 * stehen in eckigen Klammern mit optionalem „?", und Zuständige kommen aus zwei Quellen
 * (`persons[]` und dem Freitextfeld), die zusammengeführt werden müssen.
 */
import type { ResponsibleEntry } from '@shared/types/index';

/** Erkennt am ChurchTools-Typ, ob ein Agenda-Punkt eine Überschrift / ein Abschnitt ist. */
export function isHeaderType(type?: string): boolean {
  return !!type && /header|überschrift|heading|section/i.test(type);
}

/** Formatiert eine CT-Startzeit (ISO/UTC) als deutsche Ortszeit „HH:MM"; null bei fehlender/ungültiger Zeit. */
export function formatBerlinTime(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(d);
}

/**
 * Säubert ein CT-Dienst-Token zum reinen Namen: entfernt alle eckigen Klammern und ein
 * etwaiges nachgestelltes „?" (CT-Offen-Marker). „[Kamera Studio]?" → „Kamera Studio".
 */
export function cleanServiceName(service?: string): string {
  return (service ?? '')
    .replace(/[[\]]/g, '')
    .replace(/\?+\s*$/, '')
    .trim();
}

/**
 * Zuständige als Einträge, ohne Duplikate: für besetzte Plätze der Personenname (open=false),
 * für offene Dienst-Plätze (z.B. „[Musik]") der Dienstname (open=true).
 *
 * Manuell als Freitext eingetragene Zuständige (nicht über einen Dienst zugewiesen) stehen in
 * ChurchTools nur im `text`-Feld, nicht in `persons[]` – die ergänzen wir zusätzlich. Dienst-Tokens
 * in eckigen Klammern (z.B. „[Moderation]") sind dort bereits über `persons[]` aufgelöst und werden
 * hier übersprungen.
 */
export function responsibleEntries(item: {
  responsible?: { text?: string; persons?: { service?: string; person?: { title?: string } }[] };
}): ResponsibleEntry[] {
  const entries: ResponsibleEntry[] = [];
  const seen = new Set<string>();
  const push = (label: string, open: boolean): void => {
    if (!label) return;
    const key = `${label}|${open}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ label, open });
  };
  for (const p of item.responsible?.persons ?? []) {
    const name = p.person?.title?.trim();
    push(name || cleanServiceName(p.service), !name);
  }
  for (const part of (item.responsible?.text ?? '').split(',')) {
    const label = part.trim();
    if (!label || label.includes('[')) continue; // Dienst-Tokens kommen über persons[]
    push(label, false);
  }
  return entries;
}
