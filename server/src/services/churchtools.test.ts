import { describe, it, expect } from 'vitest';
import { fileIdFromUrl, extractSessionCookie } from './churchtools.js';

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
