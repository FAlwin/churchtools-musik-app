/**
 * Rate-Limit-Schlüssel aus einer IP-Adresse (#146).
 *
 * Warum nicht einfach `req.ip`: Bei **IPv6** bekommt ein Anschluss üblicherweise ein ganzes /64-Netz
 * (Milliarden Adressen). Mit der rohen Adresse als Schlüssel hätte ein Angreifer pro Adresse ein
 * frisches Kontingent – die Brute-Force-Bremse vor dem Login wäre praktisch wirkungslos. Daher
 * schlüsseln wir IPv6 auf das /64-Präfix (= den Anschluss), IPv4 bleibt die volle Adresse.
 * (Hinweis: In Block-Kommentaren nie `**` direkt vor einem Schrägstrich schreiben – das beendet
 * den Kommentar.)
 *
 * (`ipKeyGenerator` aus express-rate-limit gibt es erst ab v8; installiert ist v7 – diese Funktion
 * erfüllt denselben Zweck, ohne einen Major-Sprung der Abhängigkeit zu erzwingen.)
 */

/** Anzahl 16-Bit-Gruppen, die ein /64-Präfix ausmachen. */
const IPV6_PREFIX_GROUPS = 4;

/**
 * Normalisiert eine IP für den Rate-Limit-Schlüssel:
 *  - IPv4 (auch IPv4-mapped `::ffff:1.2.3.4`) → unverändert die Adresse
 *  - IPv6 → `<erste vier Gruppen>::/64`
 *  - unbekannt/leer → `'unbekannt'` (alle solchen Anfragen teilen ein Kontingent)
 */
export function ipRateKey(ip: string | undefined | null): string {
  if (!ip) return 'unbekannt';
  // Zone-Index (z. B. `fe80::1%eth0`) gehört nicht zur Adresse.
  const addr = ip.trim().toLowerCase().split('%')[0];
  if (!addr) return 'unbekannt';

  // IPv4-mapped IPv6 (`::ffff:127.0.0.1`) wie IPv4 behandeln – sonst landeten alle in EINEM /64.
  const mapped = addr.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];

  if (!addr.includes(':')) return addr; // reines IPv4

  const groups = expandIpv6(addr);
  if (!groups) return addr; // nicht parsebar → unverändert nutzen, statt alles zu vermischen
  return `${groups.slice(0, IPV6_PREFIX_GROUPS).join(':')}::/64`;
}

/**
 * Schreibt eine (evtl. mit `::` verkürzte) IPv6-Adresse in ihre 8 Gruppen aus. Führende Nullen
 * werden entfernt, damit `2001:0db8:…` und `2001:db8:…` denselben Schlüssel ergeben.
 * Gibt `null` zurück, wenn die Adresse nicht plausibel ist.
 */
function expandIpv6(addr: string): string[] | null {
  const parts = addr.split('::');
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(':') : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  if (parts.length === 1) {
    if (head.length !== 8) return null;
    return head.map(normGroup);
  }
  const fill = 8 - head.length - tail.length;
  if (fill < 0) return null;
  return [...head, ...Array<string>(fill).fill('0'), ...tail].map(normGroup);
}

/** Eine Gruppe ohne führende Nullen (`0db8` → `db8`, `0000` → `0`). */
function normGroup(g: string): string {
  const s = g.replace(/^0+/, '');
  return s === '' ? '0' : s;
}
