/**
 * Wachtest (#152): `GET /api/site-config` ist ÖFFENTLICH (der Login-Screen braucht Name/Links).
 * Unauthentifiziert dürfen die internen IDs (`musicianGroupIds`/`noteRoles`) NICHT nach außen
 * gelangen; angemeldet schon (die Admin-Einstellungen brauchen sie). Der Test hält die
 * Beschneidung fest, damit ein Refactoring sie nicht still entfernt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const FULL = {
  appName: 'Worship Charts',
  description: 'Chord Charts',
  orgName: 'ECG Donrath',
  links: [{ label: 'Website', url: 'https://example.org' }],
  musicianGroupIds: [9],
  noteRoles: [{ groupId: 9, roles: [15, 16] }],
};

vi.mock('../services/siteConfig.js', () => ({
  getSiteConfig: () => Promise.resolve(FULL),
  saveSiteConfig: vi.fn(),
  siteConfigSchema: { safeParse: vi.fn() },
}));
vi.mock('../services/churchtools.js', () => ({ getGroups: vi.fn(), getGroupRoles: vi.fn() }));

const readSession = vi.fn();
const isSessionExpired = vi.fn();
vi.mock('../middleware/session.js', () => ({
  readSession: (...a: unknown[]) => readSession(...a),
  isSessionExpired: (...a: unknown[]) => isSessionExpired(...a),
}));

const { getSiteConfigCtrl } = await import('./siteConfigController.js');

function runCtrl(): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const res = { json: (body: Record<string, unknown>) => resolve(body) } as unknown as Response;
    void getSiteConfigCtrl({} as Request, res);
  });
}

beforeEach(() => {
  readSession.mockReset();
  isSessionExpired.mockReset();
});

describe('GET /api/site-config – Beschneidung ohne Anmeldung (#152)', () => {
  it('liefert unauthentifiziert KEINE musicianGroupIds/noteRoles', async () => {
    readSession.mockReturnValue(null);
    const body = await runCtrl();
    expect(body.musicianGroupIds).toEqual([]);
    expect(body.noteRoles).toEqual([]);
    // Anzeige-Felder bleiben da (der Login-Screen braucht sie).
    expect(body.orgName).toBe('ECG Donrath');
    expect(body.links).toEqual(FULL.links);
  });

  it('beschneidet auch bei ABGELAUFENER Session', async () => {
    readSession.mockReturnValue({ issuedAt: 1 });
    isSessionExpired.mockReturnValue(true);
    const body = await runCtrl();
    expect(body.musicianGroupIds).toEqual([]);
    expect(body.noteRoles).toEqual([]);
  });

  it('liefert angemeldet die vollständige Konfiguration', async () => {
    readSession.mockReturnValue({ issuedAt: Date.now() });
    isSessionExpired.mockReturnValue(false);
    const body = await runCtrl();
    expect(body.musicianGroupIds).toEqual([9]);
    expect(body.noteRoles).toEqual(FULL.noteRoles);
  });
});
