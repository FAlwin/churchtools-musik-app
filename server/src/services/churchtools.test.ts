import { describe, it, expect } from 'vitest';
import { fileIdFromUrl, extractSessionCookie, parseCapabilities } from './churchtools.js';

describe('fileIdFromUrl', () => {
  it('liest die id aus einer ChurchTools-Download-URL', () => {
    expect(fileIdFromUrl('https://x.church.tools/?q=public/filedownload&id=4711')).toBe(4711);
  });
  it('liest die id auch, wenn sie der erste Parameter ist', () => {
    expect(fileIdFromUrl('https://x.church.tools/?id=12&q=x')).toBe(12);
  });
  it('liefert null, wenn keine id enthalten ist', () => {
    expect(fileIdFromUrl('https://x.church.tools/datei.pdf')).toBeNull();
  });
});

describe('extractSessionCookie', () => {
  const resWithCookies = (cookies: string[]): Response => {
    const headers = new Headers();
    for (const c of cookies) headers.append('set-cookie', c);
    return { headers } as unknown as Response;
  };

  it('extrahiert das ChurchTools_-Session-Cookie (name=value, ohne Attribute)', () => {
    const res = resWithCookies(['ChurchTools_abc=xyz123; Path=/; HttpOnly; SameSite=Lax']);
    expect(extractSessionCookie(res)).toBe('ChurchTools_abc=xyz123');
  });

  it('ignoriert fremde Cookies', () => {
    const res = resWithCookies(['other_session=1; Path=/']);
    expect(extractSessionCookie(res)).toBeNull();
  });

  it('pickt das ChurchTools-Cookie aus mehreren Set-Cookie-Headern', () => {
    const res = resWithCookies(['foo=bar; Path=/', 'ChurchTools_sess=token99; HttpOnly']);
    expect(extractSessionCookie(res)).toBe('ChurchTools_sess=token99');
  });
});

describe('parseCapabilities', () => {
  // Leere/ungültige Antwort = Aussetzer → wirft, damit der Client neu versucht (statt „keine Rechte").
  it('wirft bei komplett leerer Antwort', () => {
    expect(() => parseCapabilities({})).toThrow();
  });
  it('wirft bei null/undefined', () => {
    expect(() => parseCapabilities(null)).toThrow();
    expect(() => parseCapabilities(undefined)).toThrow();
  });

  // Antwort vorhanden, aber kein churchservice-Block = Nutzer hat wirklich keine Lieder-/Ablauf-
  // Rechte → false-Werte, KEIN Wurf.
  it('liefert false ohne Wurf, wenn andere Module da sind aber churchservice fehlt', () => {
    const caps = parseCapabilities({ churchcore: { 'administer settings': [] } });
    expect(caps.canViewSongs).toBe(false);
    expect(caps.canViewAgendas).toBe(false);
  });

  it('erkennt vorhandene Lieder-/Ablauf-Rechte (Arrays mit IDs)', () => {
    const caps = parseCapabilities({
      churchservice: { 'view songcategory': [1, 2], 'view agenda': [5] },
    });
    expect(caps.canViewSongs).toBe(true);
    expect(caps.canViewAgendas).toBe(true);
  });

  it('wertet leere Rechte-Arrays im churchservice als „nein"', () => {
    const caps = parseCapabilities({
      churchservice: { 'view songcategory': [], 'view agenda': [] },
    });
    expect(caps.canViewSongs).toBe(false);
    expect(caps.canViewAgendas).toBe(false);
  });

  // Admin (churchcore:administer persons) darf alles – auch ohne explizite Kategorie-/Kalender-Rechte.
  it('gibt Admins Zugriff, auch bei leeren Kategorie-/Kalender-Rechten', () => {
    const caps = parseCapabilities({
      churchcore: { 'administer persons': [1] },
      churchservice: { 'view songcategory': [], 'view agenda': [] },
    });
    expect(caps.isAdmin).toBe(true);
    expect(caps.canViewSongs).toBe(true);
    expect(caps.canViewAgendas).toBe(true);
  });
});
