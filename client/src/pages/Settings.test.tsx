// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DEFAULT_SITE_CONFIG, type SiteConfig } from '@shared/types/index';

/**
 * **„Mehr" – was die Seite tut, festgehalten VOR dem Aufteilen** (#407, 23.09.2026).
 *
 * `Settings.tsx` hatte 623 Zeilen und keinen einzigen Test. Diese Tests wurden gegen den alten Stand
 * geschrieben und dort grün gesehen; danach wurde die Seite in Bereiche geschnitten. Sie halten fest,
 * was ein Umbau still verändern könnte: welche Bereiche wem erscheinen, dass jede Schalter-Zeile
 * über Zeile UND Schalter genau einmal schaltet, dass die Verwaltungs-Fenster sich öffnen und ihre
 * Entwürfe mit dem gespeicherten Stand beginnen, und dass „Speichern" nur bei einer Änderung kommt.
 */
const speichern = vi.fn();
vi.mock('../hooks/useSiteConfig', () => ({
  useUpdateSiteConfig: () => ({ mutate: speichern, isPending: false, isError: false }),
  useGroups: () => ({
    isLoading: false,
    isError: false,
    data: [
      { id: 1, name: 'Musikteam' },
      { id: 2, name: 'Technik' },
    ],
  }),
  useGroupRoles: () => ({ isLoading: false, isError: false, data: [{ id: 9, name: 'Leitung' }] }),
}));
vi.mock('../hooks/useUpdateCheck', () => ({ useUpdateCheck: () => ({ available: false }) }));
vi.mock('../queryClient', () => ({ getOfflineStatus: () => Promise.resolve(null) }));
const autoOffline = vi.fn();
vi.mock('../services/offlineAuto', () => ({
  isOfflineAutoEnabled: () => false,
  setOfflineAutoEnabled: (v: boolean) => autoOffline(v),
}));
const teilen = vi.fn();
vi.mock('../hooks/useSharing', () => ({
  useSharing: () => ({ enabled: false, error: null, toggle: teilen }),
}));
vi.mock('../hooks/usePwaInstall', () => ({
  usePwaInstall: () => ({ standalone: true, canPrompt: false, platform: 'ios' }),
}));
vi.mock('../services/pwaInstall', () => ({ promptInstall: vi.fn() }));
vi.mock('../components/LinksManager', () => ({ LinksManager: () => <div>Links-Verwaltung</div> }));
vi.mock('../components/TerminArtenManager', () => ({
  TerminArtenManager: () => <div>Termin-Arten-Verwaltung</div>,
}));
vi.mock('../components/SupportBox', () => ({ SupportBox: () => null }));

const { Settings } = await import('./Settings');

const SITE: SiteConfig = {
  ...DEFAULT_SITE_CONFIG,
  orgName: 'ECG Donrath',
  links: [{ id: 'a', label: 'Liederliste', url: 'https://example.org', showOnLogin: false }],
  musicianGroupIds: [1],
  noteRoles: [],
};

function zeige(p: { isAdmin?: boolean; canUseGlobalNotes?: boolean } = {}) {
  const onToggleWake = vi.fn();
  const onLogout = vi.fn();
  const onReplayIntro = vi.fn();
  render(
    <Settings
      site={SITE}
      theme="light"
      themePref="system"
      setThemePref={vi.fn()}
      wakePref={false}
      onToggleWake={onToggleWake}
      isAdmin={p.isAdmin ?? false}
      canUseGlobalNotes={p.canUseGlobalNotes ?? false}
      userName="Alwin Friesen"
      onLogout={onLogout}
      onReplayIntro={onReplayIntro}
    />,
  );
  return { onToggleWake, onLogout, onReplayIntro };
}

beforeEach(() => vi.clearAllMocks());

describe('Mehr – Aufbau', () => {
  it('zeigt Überschrift, Gemeinde, Konto und die Links für alle', () => {
    zeige();
    expect(screen.getByRole('heading', { name: 'Mehr' })).toBeTruthy();
    expect(screen.getByText('ECG Donrath')).toBeTruthy();
    expect(screen.getByText('Angemeldet als Alwin Friesen')).toBeTruthy();
    expect(screen.getByText('Liederliste')).toBeTruthy();
  });

  it('zeigt Verwaltung und Team-Notizen nur, wer sie darf', () => {
    zeige();
    expect(screen.queryByText('Verwaltung')).toBeNull();
    expect(screen.queryByText('Team-Notizen')).toBeNull();
  });

  it('zeigt beides mit den Rechten dazu', () => {
    zeige({ isAdmin: true, canUseGlobalNotes: true });
    expect(screen.getByText('Verwaltung')).toBeTruthy();
    expect(screen.getByText('Team-Notizen')).toBeTruthy();
  });
});

describe('Mehr – Schalter-Zeilen schalten genau einmal, über Zeile ODER Schalter', () => {
  it('sagt den Zustand an – ein Knopf mit aria-pressed, kein Knopf im Knopf', () => {
    zeige();
    const schalter = screen.getByRole('button', { name: 'Display aktiv halten' });
    expect(schalter.getAttribute('aria-pressed')).toBe('false');
    expect(schalter.querySelector('button')).toBeNull();
  });

  it('Display aktiv halten', () => {
    const { onToggleWake } = zeige();
    fireEvent.click(screen.getByText('Display aktiv halten'));
    fireEvent.click(screen.getByRole('button', { name: 'Display aktiv halten' }));
    expect(onToggleWake).toHaveBeenCalledTimes(2);
  });

  it('Kommende Gottesdienste offline halten', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Kommende Gottesdienste offline halten' }));
    expect(autoOffline).toHaveBeenCalledTimes(1);
    expect(autoOffline).toHaveBeenCalledWith(true);
  });

  it('Meine Anmerkungen teilen', () => {
    zeige({ canUseGlobalNotes: true });
    fireEvent.click(screen.getByText('Meine Anmerkungen teilen'));
    fireEvent.click(screen.getByRole('button', { name: 'Meine Anmerkungen teilen' }));
    expect(teilen).toHaveBeenCalledTimes(2);
  });
});

describe('Mehr – Hilfe und Konto', () => {
  it('Einführung und Abmelden rufen ihre Aktion', () => {
    const { onReplayIntro, onLogout } = zeige();
    fireEvent.click(screen.getByText('Einführung nochmal ansehen'));
    fireEvent.click(screen.getByText('Abmelden'));
    expect(onReplayIntro).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

describe('Mehr – Verwaltung', () => {
  it('„Organisation / Name" öffnet mit dem gespeicherten Namen und speichert den neuen', () => {
    zeige({ isAdmin: true });
    fireEvent.click(screen.getByText('Organisation / Name'));
    const feld = screen.getByPlaceholderText<HTMLInputElement>('z. B. Meine Gemeinde');
    expect(feld.value).toBe('ECG Donrath');
    fireEvent.change(feld, { target: { value: 'ECG Lohmar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(speichern.mock.calls[0][0]).toMatchObject({ orgName: 'ECG Lohmar' });
  });

  it('Links und Termin-Arten öffnen ihr Fenster', () => {
    zeige({ isAdmin: true });
    fireEvent.click(screen.getByText('Links verwalten'));
    expect(screen.getByText('Links-Verwaltung')).toBeTruthy();
    fireEvent.click(screen.getByText('Abwesenheiten: Termin-Arten'));
    expect(screen.getByText('Termin-Arten-Verwaltung')).toBeTruthy();
  });

  it('Gruppen-Zuweisung beginnt mit dem gespeicherten Stand; „Speichern" erst nach einer Änderung', () => {
    zeige({ isAdmin: true });
    fireEvent.click(screen.getByText('Anmerkungen', { selector: 'span' }));
    fireEvent.click(screen.getByText('Gruppen-Zuweisung'));

    expect(screen.getByRole('checkbox', { name: /Musikteam/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByRole('checkbox', { name: /Technik/ }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(screen.queryByRole('button', { name: /^Speichern/ })).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: /Technik/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern (2 Gruppen)' }));
    expect(speichern.mock.calls[0][0]).toMatchObject({ musicianGroupIds: [1, 2] });
  });

  it('Rollen-Zuweisung speichert die angehakte Rolle je Gruppe', () => {
    zeige({ isAdmin: true });
    fireEvent.click(screen.getByText('Anmerkungen', { selector: 'span' }));
    fireEvent.click(screen.getByText('Rollen-Zuweisung'));
    fireEvent.click(screen.getByRole('checkbox', { name: /Leitung/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(speichern.mock.calls[0][0]).toMatchObject({ noteRoles: [{ groupId: 1, roles: [9] }] });
  });
});
