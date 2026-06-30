/**
 * Fragt GitHub nach dem neuesten veröffentlichten Release und cached die Antwort.
 *
 * Die anonyme GitHub-API erlaubt nur ~60 Anfragen/Stunde pro IP. Damit viele Clients (und viele
 * Gemeinde-Instanzen) das Limit nicht reißen, fragt der Server höchstens 1× pro Cache-Fenster und
 * liefert allen Clients dieselbe gecachte Antwort. Bei Fehlern/Offline wird ein leeres Ergebnis
 * geliefert (die App zeigt dann einfach keinen Update-Hinweis).
 */
import type { UpdateInfo } from '@shared/types/index';

const REPO = 'FAlwin/churchtools-musik-app';
const CACHE_MS = 6 * 60 * 60 * 1000; // Erfolg: 6 Stunden cachen
const ERROR_CACHE_MS = 15 * 60 * 1000; // Fehler/leer: nur kurz cachen, damit ein neues Release bald sichtbar wird
const EMPTY: UpdateInfo = { latest: null, tag: null, url: null };

let cache: { until: number; data: UpdateInfo } | null = null;

export async function getLatestRelease(): Promise<UpdateInfo> {
  if (cache && Date.now() < cache.until) return cache.data;

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'churchtools-musik-app',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      // z. B. 404 (noch kein veröffentlichtes Release) oder vorübergehendes Rate-Limit/5xx →
      // leer, aber nur kurz cachen (nicht 6 h), damit ein bald erscheinendes Release sichtbar wird.
      cache = { until: Date.now() + ERROR_CACHE_MS, data: EMPTY };
      return EMPTY;
    }

    const json = (await res.json()) as { tag_name?: string; html_url?: string };
    const tag = json.tag_name ?? null;
    const latest = tag ? tag.replace(/^v/, '') : null;
    const data: UpdateInfo = { latest, tag, url: json.html_url ?? null };
    cache = { until: Date.now() + CACHE_MS, data };
    return data;
  } catch {
    // Offline / Timeout: nicht cachen, beim nächsten Aufruf erneut versuchen.
    return EMPTY;
  }
}
