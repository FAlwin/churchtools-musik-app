/**
 * Alle Zwischenspeicher, die an EINEM Session-Cookie hängen – an einer Stelle (#280).
 *
 * Es sind vier: Konto-ID (12 h), Rechte (5 min), CSRF-Token (1 min) und die laufenden Token-Abrufe.
 * Sie lagen früher über
 * `churchtools.ts` verstreut, jede mit ihrer eigenen handgeschriebenen Ablaufprüfung – und `logout`
 * räumte nur eine davon. Ein abgemeldetes Cookie lieferte dadurch bis zu fünf Minuten lang gecachte
 * Rechte, ohne ChurchTools zu fragen.
 *
 * **Deshalb dieses Modul: `forgetSession()` kennt alle drei.** Kommt eine vierte sitzungsgebundene
 * Ablage dazu, gehört sie hierhin – nicht daneben. Das ist der Unterschied zwischen einer Regel im
 * Kommentar und einer Regel im Bauplan.
 *
 * ⚠️ Prozesslokal – siehe „Ein Prozess, ein Zustand" in `docs/entwicklung/entscheidungen.md`.
 */
import { createTtlMemo } from './ttlMemo.js';
import type { UserCapabilities } from '@shared/types/index';

// Cookie → ChurchTools-Person-ID, gecacht mit 12-h-Auffrischung – spart whoami-Abrufe je Anmerkung
// und prüft periodisch, ob das Cookie noch gilt (unabhängig von der App-Cookie-Lebensdauer).
const USER_ID_TTL_MS = 12 * 3_600_000;

export const userIdMemo = createTtlMemo<number>(USER_ID_TTL_MS);

// ── Kurzzeit-Memo der Capabilities je Session-Cookie ─────────────────────────────────────────
// Die Fremd-Lese-Endpunkte (Team-Notizen) prüfen das Nutzungsrecht bei JEDER Anfrage. Ein
// Live-Gang zu ChurchTools pro Anfrage wäre teuer UND anfällig für CT-Aussetzer (genau so sind
// in der ersten Team-Notizen-Version sporadisch „alle Notizen weg"-Effekte entstanden).
const CAPS_MEMO_TTL_MS = 5 * 60_000;

export const capsMemo = createTtlMemo<UserCapabilities>(CAPS_MEMO_TTL_MS);

/**
 * Gültigkeitsdauer des zwischengespeicherten CSRF-Tokens (#298).
 *
 * Bewusst KURZ: Ein CSRF-Token ist an die ChurchTools-Session gebunden und bliebe theoretisch lange
 * gültig – aber ein zu lange gehaltenes Token ist genau die Art Annahme, die später still bricht.
 * Eine Minute reicht für den Zweck (eine Bearbeitungs-Sitzung: mehrere Speichervorgänge, Umsortieren
 * per Ziehen) und macht ein abgelaufenes Token praktisch unmöglich.
 */
const CSRF_TTL_MS = 60_000;

export const csrfCache = createTtlMemo<string>(CSRF_TTL_MS);

/** Laufende Abrufe je Cookie – damit parallele Schreibvorgänge EINEN GET teilen, nicht je einen. */
export const csrfInflight = new Map<string, Promise<string>>();

/**
 * Alles vergessen, was an EINEM Session-Cookie hängt – die eine Stelle, die alle Sitzungs-Speicher
 * kennt. Wer einen neuen hinzufügt, trägt ihn hier ein; sonst überlebt er das Abmelden.
 *
 * **Auch der laufende Token-Abruf**, nicht nur die fertigen Werte: Meldet sich jemand ab, während
 * gerade ein CSRF-Token geholt wird, landete das Ergebnis sonst NACH dem Abmelden im Speicher – ein
 * totes Cookie hätte danach eine Minute lang ein Token gehabt. Praktisch harmlos (das Cookie gilt bei
 * ChurchTools ohnehin nicht mehr), aber es widerspräche genau der Zusage dieses Moduls. `getCsrfToken`
 * prüft deshalb vor dem Merken, ob sein Abruf noch der aktuelle ist.
 */
export function forgetSession(cookie: string): void {
  userIdMemo.delete(cookie);
  capsMemo.delete(cookie);
  csrfCache.delete(cookie);
  csrfInflight.delete(cookie);
}

/** Nur für Tests: alle sitzungsgebundenen Speicher leeren (Konto-ID, Rechte, CSRF-Token). */
export function __resetSessionMemosForTests(): void {
  userIdMemo.clear();
  capsMemo.clear();
  csrfCache.clear();
  csrfInflight.clear();
}
