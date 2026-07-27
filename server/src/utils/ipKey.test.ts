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

/**
 * Randfälle aus dem Code-Check v2.14.1 (#215). Praktisch selten – Node liefert die Kurzform –,
 * aber der Schlüssel darf nicht davon abhängen, WIE eine Adresse geschrieben ist.
 */
describe('ipRateKey – Schreibweisen und Müll', () => {
  it('IPv4-mapped in JEDER Schreibweise ergibt dieselbe IPv4', () => {
    // Vorher bekam die ausgeschriebene Form einen eigenen Schlüssel – ein Client hätte damit
    // zwei Kontingente gehabt, je nachdem wie der Vorschalt-Server die Adresse schreibt.
    for (const form of [
      '::ffff:203.0.113.7',
      '0:0:0:0:0:ffff:203.0.113.7',
      '0000:0000:0000:0000:0000:ffff:203.0.113.7',
      '::ffff:cb00:7107',
    ]) {
      expect(ipRateKey(form)).toBe('203.0.113.7');
    }
  });

  it('ungültige Hex-Gruppen bekommen keinen Adress-Schlüssel untergeschoben', () => {
    // `zzzz::1` lief vorher durch und wurde wie ein echtes /64 behandelt.
    expect(ipRateKey('zzzz::1')).toBe('zzzz::1');
    expect(ipRateKey('12345::1')).toBe('12345::1');
  });

  it('Oktette über 255 sind keine gültige eingebettete IPv4', () => {
    expect(ipRateKey('::ffff:999.1.2.3')).toBe('::ffff:999.1.2.3');
  });

  it('`::` muss mindestens eine Gruppe ersetzen', () => {
    expect(ipRateKey('1:2:3:4:5:6:7::8')).toBe('1:2:3:4:5:6:7::8');
  });

  it('zu kurze ausgeschriebene Adresse wird nicht als /64 gedeutet', () => {
    expect(ipRateKey('2001:db8:1:2:3')).toBe('2001:db8:1:2:3');
  });

  it('echte IPv6 mit eingebetteter IPv4 bleibt ein /64 (nicht IPv4)', () => {
    // Nur die mapped-Form (fünf Null-Gruppen + ffff) zählt als IPv4.
    expect(ipRateKey('2001:db8::1.2.3.4')).toBe('2001:db8:0:0::/64');
  });
});
