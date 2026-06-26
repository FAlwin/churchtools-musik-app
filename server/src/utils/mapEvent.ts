import type { EventTeamMember, Service } from '@shared/types/index';
import type { CtEvent } from '../services/churchtools.js';

const TZ = 'Europe/Berlin';
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function parts(iso: string): { day: string; month: string; weekday: string; time: string } {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('de-DE', { day: '2-digit', timeZone: TZ }).format(d);
  const monthNum = Number(new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: TZ }).format(d));
  const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long', timeZone: TZ }).format(d);
  const time = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(d);
  return { day, month: MONTHS[monthNum - 1] ?? '', weekday, time: `${time} Uhr` };
}

/** Wandelt ein ChurchTools-Event in unser Service-Format um. */
export function mapEventToService(ev: CtEvent, songCount: number, subtitle: string | null = null): Service {
  const p = parts(ev.startDate);
  const team: EventTeamMember[] = (ev.services ?? [])
    .filter((s) => s.person?.title)
    .map((s) => ({
      role: s.name ?? '',
      name: s.person!.title!.trim(),
      agreed: s.agreed ?? true,
    }));
  return {
    id: ev.id,
    day: p.day,
    month: p.month,
    weekday: p.weekday,
    name: ev.name,
    subtitle,
    date: ev.startDate.slice(0, 10),
    time: p.time,
    location: ev.calendar?.title ?? '',
    songCount,
    team,
  };
}
