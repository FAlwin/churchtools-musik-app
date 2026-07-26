import { describe, it, expect } from 'vitest';
import { ipRateKey } from './ipKey.js';

/**
 * Kern der IPv6-Härtung (#146): Alle Adressen EINES /64-Anschlusses müssen denselben
 * Rate-Limit-Schlüssel ergeben – sonst hat ein Angreifer pro Adresse ein frisches Kontingent.
 */
describe('ipRateKey', () => {
  it('IPv4 bleibt die volle Adresse', () => {
    expect(ipRateKey('203.0.113.7')).toBe('203.0.113.7');
    expect(ipRateKey('127.0.0.1')).toBe('127.0.0.1');
  });

  it('IPv4-mapped IPv6 wird wie IPv4 behandelt', () => {
    // Sonst landeten ALLE IPv4-Clients hinter einem Proxy in einem einzigen ::ffff:-Kontingent.
    expect(ipRateKey('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(ipRateKey('::FFFF:127.0.0.1')).toBe('127.0.0.1');
  });

  it('verschiedene Adressen im gleichen /64 ergeben denselben Schlüssel', () => {
    const a = ipRateKey('2001:db8:abcd:0012::1');
    const b = ipRateKey('2001:db8:abcd:0012::dead:beef');
    const c = ipRateKey('2001:db8:abcd:12:ffff:ffff:ffff:ffff');
    expect(a).toBe(b);
    expect(a).toBe(c);
    expect(a).toBe('2001:db8:abcd:12::/64');
  });

  it('unterschiedliche /64-Netze bleiben getrennt', () => {
    expect(ipRateKey('2001:db8:abcd:12::1')).not.toBe(ipRateKey('2001:db8:abcd:13::1'));
  });

  it('führende Nullen und Großschreibung ändern den Schlüssel nicht', () => {
    expect(ipRateKey('2001:0DB8:0000:0001::5')).toBe(ipRateKey('2001:db8:0:1::5'));
  });

  it('vollständig ausgeschriebene Adresse funktioniert', () => {
    expect(ipRateKey('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8:0:0::/64');
  });

  it('Zone-Index wird ignoriert', () => {
    expect(ipRateKey('fe80::1%eth0')).toBe(ipRateKey('fe80::2'));
  });

  it('Loopback-IPv6 wird zusammengefasst', () => {
    expect(ipRateKey('::1')).toBe('0:0:0:0::/64');
  });

  it('leer/unbekannt bekommt einen gemeinsamen Schlüssel', () => {
    expect(ipRateKey(undefined)).toBe('unbekannt');
    expect(ipRateKey(null)).toBe('unbekannt');
    expect(ipRateKey('   ')).toBe('unbekannt');
  });

  it('unparsebare Adresse wird unverändert genutzt (nicht alles vermischen)', () => {
    expect(ipRateKey('2001:db8::1::2')).toBe('2001:db8::1::2');
  });
});
