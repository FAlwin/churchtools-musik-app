// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartHeader } from './ChartHeader';
import type { HeadInfoPart } from '../utils/activeSongView';

/**
 * Die Kopfzeile war bis hierhin ungeprüft – aufgefallen ist das erst durch eine **leere
 * Gegenprobe**: Der gemeldete Fehler „der Puls wird erst sichtbar, wenn ich in ChurchTools
 * gespeichert habe" liess sich zurücknehmen, ohne dass ein Test fiel.
 *
 * Geprüft wird deshalb genau das, was hier entschieden wird und sonst nirgends: **welche Zahl in
 * der Info-Zeile steht** und **womit der Puls schlägt**. Beides ist im Tempo-Menü unterschiedlich –
 * angezeigt werden die Grundschläge (so steht es in ChurchTools), gepulst wird im gezählten Tempo.
 */
const props = {
  songTitle: 'Höher',
  headInfo: [] as HeadInfoPart[],
  menuOpen: false,
  appearanceOpen: false,
  viewing: false,
  showsDocument: false,
  canUseGlobalNotes: false,
  drawMode: false,
  zoomed: false,
  bpmPulse: false,
  pulsBpm: null as number | null,
  klickBpm: null as number | null,
  taktStartMs: null as number | null,
  schlaegeProTakt: 4,
  tempoOpen: false,
  tempoAktiv: false,
  onToggleTempo: vi.fn(),
  onBack: vi.fn(),
  onToggleMenu: vi.fn(),
  onToggleAppearance: vi.fn(),
  onResetZoom: vi.fn(),
  onToggleTeamNotes: vi.fn(),
  onToggleDraw: vi.fn(),
};

function zeige(over: Partial<typeof props> = {}) {
  return render(<ChartHeader {...props} {...over} />);
}

/** Die Info-Zeile unter dem Titel als Text. */
const infoZeile = (c: HTMLElement) =>
  (c.querySelector('[class*="menuInfo"]')?.textContent ?? '').trim();

describe('ChartHeader – die Tempo-Angabe', () => {
  it('zeigt das Tempo des Lieds', () => {
    const { container } = zeige({ headInfo: [{ art: 'bpm', bpm: 72 }] });
    expect(infoZeile(container)).toContain('72');
  });

  it('zeigt statt dessen das EINGESTELLTE Tempo, sobald eines abweicht', () => {
    const { container } = zeige({ headInfo: [{ art: 'bpm', bpm: 72 }], pulsBpm: 96 });
    expect(infoZeile(container)).toContain('96');
    expect(infoZeile(container)).not.toContain('72');
  });

  it('zeigt ein eingestelltes Tempo AUCH, wenn im Lied keines steht', () => {
    // Der gemeldete Fehler: Ohne Tempo in ChurchTools gab es keinen Tempo-Teil in `headInfo` – also
    // weder Zahl noch Puls, obwohl der Klick längst damit lief. „Man sieht nichts, bis man
    // gespeichert hat."
    const { container } = zeige({ headInfo: [{ art: 'key', text: 'A' }], pulsBpm: 96 });
    expect(infoZeile(container)).toContain('96');
  });

  it('zeigt es sogar, wenn das Lied gar keine Info-Zeile hätte', () => {
    const { container } = zeige({ headInfo: [], pulsBpm: 96 });
    expect(infoZeile(container)).toContain('96');
  });

  it('zeigt ohne jedes Tempo auch keines an', () => {
    const { container } = zeige({ headInfo: [{ art: 'key', text: 'A' }] });
    expect(infoZeile(container)).toBe('A');
  });

  it('hängt das Tempo NICHT doppelt an, wenn das Lied schon eines hat', () => {
    const { container } = zeige({ headInfo: [{ art: 'bpm', bpm: 72 }], pulsBpm: 96 });
    expect(infoZeile(container).match(/96/g)?.length).toBe(1);
  });
});

describe('ChartHeader – der Puls schlägt im GEZÄHLTEN Tempo', () => {
  /** Wie schnell pulst es? Ausgelesen aus dem, was die Kopfzeile an `BpmPulse` weiterreicht. */
  function pulsTempo(over: Partial<typeof props>): number | null {
    const { container } = zeige({ ...over, bpmPulse: true });
    // Der Punkt erscheint nur bei brauchbarem Tempo – seine Anwesenheit ist das Signal.
    const punkt = container.querySelector('[class*="punkt"]');
    return punkt ? 1 : null;
  }

  it('pulst, wenn ein gezähltes Tempo da ist', () => {
    expect(pulsTempo({ headInfo: [{ art: 'bpm', bpm: 120 }], klickBpm: 40 })).toBe(1);
  });

  it('pulst NICHT, wenn das gezählte Tempo unbrauchbar wird', () => {
    // 30 Grundschläge in Dreiergruppen = 10 gezählte je Minute. Angezeigt wird trotzdem die 30 –
    // gepulst wird nichts. Nähme der Puls die angezeigte Zahl, schlüge er dreimal zu schnell.
    expect(pulsTempo({ headInfo: [{ art: 'bpm', bpm: 30 }], klickBpm: 10 })).toBeNull();
  });

  it('zeigt dabei weiter die Grundschläge an', () => {
    const { container } = zeige({ headInfo: [{ art: 'bpm', bpm: 120 }], klickBpm: 40 });
    expect(infoZeile(container)).toContain('120');
    expect(infoZeile(container)).not.toContain('40');
  });
});

describe('ChartHeader – der Tempo-Knopf', () => {
  it('ist auch ohne gepflegtes Tempo da – dort trägt man ja eines nach', () => {
    zeige({ headInfo: [{ art: 'key', text: 'A' }] });
    expect(screen.getByRole('button', { name: /^Tempo:/ })).toBeTruthy();
  });

  it('verschwindet beim Ansehen fremder Notizen', () => {
    zeige({ viewing: true });
    expect(screen.queryByRole('button', { name: /^Tempo:/ })).toBeNull();
  });
});
