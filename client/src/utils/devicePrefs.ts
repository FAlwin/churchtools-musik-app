/**
 * Reine GERÄTE-Vorlieben: Wie ist die Oberfläche auf DIESEM Gerät eingerichtet (#198).
 *
 * Abgegrenzt gegen die Lied-Einstellungen aus `chartSettings`/`songVersions`: Die gehören zum
 * Konto und werden synchronisiert – ein Kapo gilt auf jedem Gerät. Wo die Werkzeugleiste sitzt und
 * ob sie eingeklappt ist, hängt dagegen am Bildschirm und an der Hand, die ihn hält; das gehört
 * ausdrücklich **nicht** aufs Konto. Deshalb ein eigener Namensraum (`worship:…` statt
 * `worship_…`) – der Konto-Sync greift ihn dadurch gar nicht erst auf.
 *
 * Alle Zugriffe fangen Fehler ab: Ist der Speicher voll oder gesperrt (privater Modus), gilt die
 * Einstellung eben nur für diese Sitzung. Eine Vorliebe darf nie die Bedienung blockieren.
 */

const KEYS = {
  /** Ist die Anmerkungs-Werkzeugleiste zum Rand-Knopf eingeklappt? */
  drawbarCollapsed: 'worship:drawbar-collapsed',
  /** Senkrechte Verschiebung der Werkzeugleiste in Pixeln. */
  drawbarOffsetY: 'worship:drawbar-y',
  /** Gewählte Termin-Art im Tab „Abwesenheiten" (#400) – JSON-Liste mit höchstens einer ID, leer = alle. */
  abwesenheitenFilter: 'worship:abwesenheiten-filter',
  /** Ein Abmelden konnte den Server nicht erreichen und muss beim nächsten Start nachgeholt werden (#403). */
  abmeldenAusstehend: 'worship:abmelden-ausstehend',
} as const;

type PrefKey = keyof typeof KEYS;

function read(key: PrefKey): string | null {
  try {
    return localStorage.getItem(KEYS[key]);
  } catch {
    return null;
  }
}

function write(key: PrefKey, value: string): void {
  try {
    localStorage.setItem(KEYS[key], value);
  } catch {
    /* Speicher voll/gesperrt → Vorliebe gilt nur für diese Sitzung */
  }
}

export function getDrawbarCollapsed(): boolean {
  return read('drawbarCollapsed') === '1';
}

export function setDrawbarCollapsed(collapsed: boolean): void {
  write('drawbarCollapsed', collapsed ? '1' : '0');
}

/** Verschiebung der Werkzeugleiste; 0, wenn nichts oder Unsinn gespeichert ist. */
export function getDrawbarOffsetY(): number {
  const v = Number(read('drawbarOffsetY'));
  return Number.isFinite(v) ? v : 0;
}

export function setDrawbarOffsetY(y: number): void {
  write('drawbarOffsetY', String(y));
}

/**
 * Die im Tab „Abwesenheiten" gewählte Termin-Art (#400) – als Liste, weil eine Zwischenfassung
 * mehrere zuließ; gelesen wird höchstens die erste. Leer heißt „alle".
 *
 * Auf dem Gerät gemerkt, nicht im Konto (Entscheidung Alwin, 20.09.2026): Wer nur Gottesdienste
 * einträgt, stellt es einmal ein. Ein kaputter Wert ergibt „alle" – lieber zu viel zeigen als still
 * zu wenig.
 */
export function getAbwesenheitenFilter(): string[] {
  try {
    const roh: unknown = JSON.parse(read('abwesenheitenFilter') ?? '[]');
    return Array.isArray(roh) ? roh.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function setAbwesenheitenFilter(ids: string[]): void {
  write('abwesenheitenFilter', JSON.stringify(ids));
}

/**
 * **Abmelden steht noch aus** (#403). Kein Oberflächen-Wunsch, sondern Gerätezustand – deshalb aber
 * genau hier richtig: Der Doppelpunkt-Namensraum `worship:…` überlebt das Aufräumen beim Abmelden
 * (`clearDeviceData` löscht nur `worship_…`), und genau das muss dieser Merker.
 *
 * Warum es ihn gibt: Das Anmelde-Cookie ist `httpOnly`, nur der Server kann es löschen. Ist er beim
 * Abmelden nicht erreichbar (Flugmodus, WLAN weg), bliebe das Cookie liegen – und die nächste Person,
 * die das geteilte Gemeindegerät öffnet, wäre als die vorige angemeldet. Mit dem Merker holt die App
 * das Abmelden beim nächsten Start nach, bevor sie irgendwem ein Konto zeigt.
 */
export function getAbmeldenAusstehend(): boolean {
  return read('abmeldenAusstehend') === '1';
}

export function setAbmeldenAusstehend(ausstehend: boolean): void {
  if (ausstehend) {
    write('abmeldenAusstehend', '1');
    return;
  }
  try {
    localStorage.removeItem(KEYS.abmeldenAusstehend);
  } catch {
    /* Speicher gesperrt – dann war auch nichts gemerkt */
  }
}
