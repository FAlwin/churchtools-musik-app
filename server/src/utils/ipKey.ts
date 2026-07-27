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
 *  - IPv4 (auch IPv4-mapped, in JEDER Schreibweise) → unverändert die Adresse
 *  - IPv6 → `<erste vier Gruppen>::/64`
 *  - unbekannt/leer → `'unbekannt'` (alle solchen Anfragen teilen ein Kontingent)
 *  - nicht parsebar → die Adresse selbst (lieber ein eigener Schlüssel als alles vermischen)
 */
export function ipRateKey(ip: string | undefined | null): string {
  if (!ip) return 'unbekannt';
  // Zone-Index (z. B. `fe80::1%eth0`) gehört nicht zur Adresse.
  const addr = ip.trim().toLowerCase().split('%')[0];
  if (!addr) return 'unbekannt';
  if (!addr.includes(':')) return addr; // reines IPv4

  const groups = expandIpv6(addr);
  if (!groups) return addr;

  // IPv4-mapped wie IPv4 behandeln – sonst landeten alle IPv4-Clients hinter einem Proxy in EINEM
  // gemeinsamen Kontingent. Die Prüfung sitzt bewusst NACH dem Ausschreiben, damit sie jede
  // Schreibweise erfasst: `::ffff:1.2.3.4` genauso wie `0:0:0:0:0:ffff:1.2.3.4` (#215).
  const mapped = mappedIpv4(groups);
  if (mapped) return mapped;

  return `${groups.slice(0, IPV6_PREFIX_GROUPS).join(':')}::/64`;
}

/**
 * Schreibt eine (evtl. mit `::` verkürzte) IPv6-Adresse in ihre 8 Gruppen aus. Führende Nullen
 * werden entfernt, damit `2001:0db8:…` und `2001:db8:…` denselben Schlüssel ergeben. Eine
 * eingebettete IPv4 am Ende (`::ffff:1.2.3.4`) wird in zwei Hex-Gruppen umgeschrieben.
 *
 * Gibt `null` zurück, wenn die Adresse nicht plausibel ist – inklusive ungültiger Hex-Gruppen
 * (`zzzz::1`) und Oktetten über 255. Vorher rutschte solcher Müll durch und bekam einen
 * Schlüssel, als wäre er eine echte Adresse (#215).
 */
function expandIpv6(addr: string): string[] | null {
  const text = rewriteEmbeddedIpv4(addr);
  if (text === null) return null;

  const parts = text.split('::');
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(':') : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(':') : [];

  let groups: string[];
  if (parts.length === 1) {
    if (head.length !== 8) return null;
    groups = head;
  } else {
    const fill = 8 - head.length - tail.length;
    // `::` muss mindestens eine Gruppe ersetzen – `1:2:3:4:5:6:7::8` ist keine gültige Adresse.
    if (fill < 1) return null;
    groups = [...head, ...Array<string>(fill).fill('0'), ...tail];
  }
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map(normGroup);
}

/**
 * Ersetzt eine am Ende eingebettete IPv4 durch zwei Hex-Gruppen (`::ffff:1.2.3.4` →
 * `::ffff:102:304`). Ohne eingebettete IPv4 bleibt die Adresse unverändert; bei ungültigen
 * Oktetten kommt `null`.
 */
function rewriteEmbeddedIpv4(addr: string): string | null {
  const m = addr.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (!m) return addr;
  const octets = m[2].split('.').map(Number);
  if (octets.some((o) => !Number.isInteger(o) || o > 255)) return null;
  const hex = (n: number): string => n.toString(16);
  return `${m[1]}${hex((octets[0] << 8) | octets[1])}:${hex((octets[2] << 8) | octets[3])}`;
}

/** Die IPv4 hinter einer IPv4-mapped Adresse (`::ffff:a.b.c.d`) – sonst `null`. */
function mappedIpv4(groups: string[]): string | null {
  const istMapped = groups.slice(0, 5).every((g) => g === '0') && groups[5] === 'ffff';
  if (!istMapped) return null;
  const hi = parseInt(groups[6], 16);
  const lo = parseInt(groups[7], 16);
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

/** Eine Gruppe ohne führende Nullen (`0db8` → `db8`, `0000` → `0`). */
function normGroup(g: string): string {
  const s = g.replace(/^0+/, '');
  return s === '' ? '0' : s;
}
