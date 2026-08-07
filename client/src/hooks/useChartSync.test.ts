// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

/**
 * #314: Die Auffrischung der Chart-Ansicht lag als drei Effekte über einer 860-Zeilen-Komponente
 * verteilt und war ungetestet. Geprüft wird das **Verhalten**, nicht die Konfiguration:
 *
 *  - **Im Zeichenmodus wird nichts nachgeladen.** Ein Neuaufbau mitten im Strich verliert ihn –
 *    das ist die Regel, die im Gottesdienst am meisten wehtut.
 *  - **Die Rückkehr ist entprellt.** `focus` und `visibilitychange` feuern beide; ohne Entprellung
 *    liefe jede Rückkehr doppelt gegen ChurchTools.
 *  - **Der Ablauf wird auch im Zeichenmodus nachgeladen** – sonst stünde ein gestrichenes Lied ewig
 *    da. Das ist bewusst die Ausnahme von der ersten Regel.
 *
 * Mit **Fake-Timern**: Mit echten Timern liefen die 30- und 60-Sekunden-Takte nie, und jeder Test
 * wäre grün geblieben, ganz gleich was der Code tut.
 */
vi.mock('../services/annotations', () => ({
  pullAnnotations: vi.fn(() => Promise.resolve()),
  migrateLocalAnnotations: vi.fn(() => Promise.resolve()),
  resumePendingAnnotations: vi.fn(() => Promise.resolve()),
}));
vi.mock('../services/userSettings', () => ({
  pullSettings: vi.fn(() => Promise.resolve()),
  migrateLocalSettings: vi.fn(() => Promise.resolve()),
  resumePendingSettings: vi.fn(() => Promise.resolve()),
}));

const anno = await import('../services/annotations');
const settings = await import('../services/userSettings');
const { useChartSync, useResyncAfterEditor, ANNO_REFRESH_MS, CONTENT_REFRESH_MS } =
  await import('./useChartSync');

const songs = [{ id: 12 }, { id: 34 }] as never;

/** Standard-Argumente; `over` überschreibt einzelne Felder. */
function args(over: Record<string, unknown> = {}) {
  return {
    songs,
    songsSig: 'sig-1',
    drawMode: false,
    onReload: vi.fn(),
    reloadSettings: vi.fn(),
    ...over,
  } as Parameters<typeof useChartSync>[0] & {
    onReload: ReturnType<typeof vi.fn>;
    reloadSettings: ReturnType<typeof vi.fn>;
  };
}

/** Den Erst-Sync durchlaufen lassen (er besteht aus drei await-Runden). */
async function erstSyncAbwarten() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useChartSync – Erst-Sync', () => {
  it('holt Liegengebliebenes VOR dem Server-Stand, sonst überschreibt der Pull es', async () => {
    renderHook(() => useChartSync(args()));
    await erstSyncAbwarten();

    const resume = anno.resumePendingAnnotations as ReturnType<typeof vi.fn>;
    const migrate = anno.migrateLocalAnnotations as ReturnType<typeof vi.fn>;
    const pull = anno.pullAnnotations as ReturnType<typeof vi.fn>;
    expect(resume.mock.invocationCallOrder[0]).toBeLessThan(migrate.mock.invocationCallOrder[0]);
    expect(migrate.mock.invocationCallOrder[0]).toBeLessThan(pull.mock.invocationCallOrder[0]);
  });

  it('übernimmt danach die Einstellungen und meldet ein Signal an die Anzeige', async () => {
    const a = args();
    const { result } = renderHook(() => useChartSync(a));
    expect(result.current.syncTick).toBe(0);
    await erstSyncAbwarten();
    expect(a.reloadSettings).toHaveBeenCalled();
    expect(result.current.syncTick).toBe(1);
  });

  it('ruft den Nachlauf für die Team-Notizen auf (er entsteht erst später im Render)', async () => {
    const onAfterInitialPull = vi.fn();
    renderHook(() => useChartSync(args({ onAfterInitialPull })));
    await erstSyncAbwarten();
    expect(onAfterInitialPull).toHaveBeenCalledTimes(1);
  });

  it('synchronisiert erneut, wenn sich der INHALT ändert – nicht nur die Lied-Liste', async () => {
    const { rerender } = renderHook(
      (p: { sig: string }) => useChartSync(args({ songsSig: p.sig })),
      {
        initialProps: { sig: 'sig-1' },
      },
    );
    await erstSyncAbwarten();
    const vorher = (anno.pullAnnotations as ReturnType<typeof vi.fn>).mock.calls.length;
    rerender({ sig: 'sig-2' });
    await erstSyncAbwarten();
    expect((anno.pullAnnotations as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
      vorher,
    );
  });
});

describe('useChartSync – laufende Takte', () => {
  it('holt die Anmerkungen im 30-Sekunden-Takt nach', async () => {
    renderHook(() => useChartSync(args()));
    await erstSyncAbwarten();
    const vorher = (anno.pullAnnotations as ReturnType<typeof vi.fn>).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ANNO_REFRESH_MS);
    });
    expect((anno.pullAnnotations as ReturnType<typeof vi.fn>).mock.calls.length).toBe(vorher + 1);
  });

  it('lädt den Ablauf im 60-Sekunden-Takt nach', async () => {
    const a = args();
    renderHook(() => useChartSync(a));
    await erstSyncAbwarten();
    a.onReload.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONTENT_REFRESH_MS);
    });
    expect(a.onReload).toHaveBeenCalledTimes(1);
  });

  it('pausiert BEIDE Takte im Zeichenmodus – ein Neuaufbau würde den Strich verlieren', async () => {
    const a = args({ drawMode: true });
    renderHook(() => useChartSync(a));
    await erstSyncAbwarten();
    const vorher = (anno.pullAnnotations as ReturnType<typeof vi.fn>).mock.calls.length;
    a.onReload.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONTENT_REFRESH_MS);
    });
    expect((anno.pullAnnotations as ReturnType<typeof vi.fn>).mock.calls.length).toBe(vorher);
    expect(a.onReload).not.toHaveBeenCalled();
  });

  it('pausiert beide Takte, solange die App im Hintergrund ist', async () => {
    const a = args();
    renderHook(() => useChartSync(a));
    await erstSyncAbwarten();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    const vorher = (anno.pullAnnotations as ReturnType<typeof vi.fn>).mock.calls.length;
    a.onReload.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONTENT_REFRESH_MS);
    });
    expect((anno.pullAnnotations as ReturnType<typeof vi.fn>).mock.calls.length).toBe(vorher);
    expect(a.onReload).not.toHaveBeenCalled();
  });

  it('meldet Takte und Listener beim Verlassen wieder ab', async () => {
    const a = args();
    const { unmount } = renderHook(() => useChartSync(a));
    await erstSyncAbwarten();
    unmount();
    const vorher = (anno.pullAnnotations as ReturnType<typeof vi.fn>).mock.calls.length;
    a.onReload.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONTENT_REFRESH_MS * 2);
      window.dispatchEvent(new Event('focus'));
    });
    expect((anno.pullAnnotations as ReturnType<typeof vi.fn>).mock.calls.length).toBe(vorher);
    expect(a.onReload).not.toHaveBeenCalled();
  });
});

describe('useChartSync – Rückkehr zur App', () => {
  it('frischt bei „focus" Anmerkungen, Einstellungen und Ablauf auf', async () => {
    const a = args();
    renderHook(() => useChartSync(a));
    await erstSyncAbwarten();
    const vorherAnno = (anno.pullAnnotations as ReturnType<typeof vi.fn>).mock.calls.length;
    const vorherSet = (settings.pullSettings as ReturnType<typeof vi.fn>).mock.calls.length;
    a.onReload.mockClear();

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect((anno.pullAnnotations as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      vorherAnno + 1,
    );
    expect((settings.pullSettings as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      vorherSet + 1,
    );
    expect(a.onReload).toHaveBeenCalledTimes(1);
  });

  it('entprellt: „focus" und „visibilitychange" direkt nacheinander ergeben EINE Auffrischung', async () => {
    const a = args();
    renderHook(() => useChartSync(a));
    await erstSyncAbwarten();
    a.onReload.mockClear();

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(a.onReload).toHaveBeenCalledTimes(1);
  });

  it('lädt den Ablauf auch im Zeichenmodus – sonst stünde ein gestrichenes Lied ewig da', async () => {
    const a = args({ drawMode: true });
    renderHook(() => useChartSync(a));
    await erstSyncAbwarten();
    const vorher = (anno.pullAnnotations as ReturnType<typeof vi.fn>).mock.calls.length;
    a.onReload.mockClear();

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(0);
    });
    // Der Ablauf ja, die Anmerkungen bewusst nicht.
    expect(a.onReload).toHaveBeenCalledTimes(1);
    expect((anno.pullAnnotations as ReturnType<typeof vi.fn>).mock.calls.length).toBe(vorher);
  });

  it('tut bei einer Rückkehr im Hintergrund gar nichts', async () => {
    const a = args();
    renderHook(() => useChartSync(a));
    await erstSyncAbwarten();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    a.onReload.mockClear();

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(a.onReload).not.toHaveBeenCalled();
  });
});

describe('useResyncAfterEditor', () => {
  it('meldet beim SCHLIESSEN des Editors ein Signal', () => {
    const bump = vi.fn();
    const { rerender } = renderHook(
      (p: { offen: boolean }) => useResyncAfterEditor(p.offen, bump),
      {
        initialProps: { offen: true },
      },
    );
    expect(bump).not.toHaveBeenCalled();
    rerender({ offen: false });
    expect(bump).toHaveBeenCalledTimes(1);
  });

  it('meldet beim ÖFFNEN keines – dort verschiebt sich noch nichts', () => {
    const bump = vi.fn();
    const { rerender } = renderHook(
      (p: { offen: boolean }) => useResyncAfterEditor(p.offen, bump),
      {
        initialProps: { offen: false },
      },
    );
    rerender({ offen: true });
    expect(bump).not.toHaveBeenCalled();
  });
});
