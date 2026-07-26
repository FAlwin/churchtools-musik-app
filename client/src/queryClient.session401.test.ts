import { describe, it, expect, vi, afterEach } from 'vitest';
import { MutationObserver } from '@tanstack/react-query';
import { queryClient, setSessionExpiredHandler } from './queryClient';
import { ApiError } from './services/api';

/**
 * Globaler „Session abgelaufen"-Fänger (#186): Ein 401 aus IRGENDEINER Query oder Mutation muss den
 * registrierten Handler auslösen (→ App.tsx meldet ab und zeigt den Login), andere Fehler nicht.
 */
afterEach(() => {
  setSessionExpiredHandler(null);
  queryClient.clear();
});

describe('globaler 401-Fänger (#186)', () => {
  it('löst den Handler bei einem 401 aus einer Query aus', async () => {
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);
    await expect(
      queryClient.fetchQuery({
        queryKey: ['test-401'],
        retry: false,
        queryFn: () => Promise.reject(new ApiError(401, 'Session abgelaufen')),
      }),
    ).rejects.toThrow();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('löst den Handler auch bei einem 401 aus einer Mutation aus', async () => {
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);
    const obs = new MutationObserver(queryClient, {
      mutationFn: () => Promise.reject(new ApiError(401, 'Session abgelaufen')),
      retry: false,
    });
    await obs.mutate().catch(() => {});
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('ignoriert Nicht-401-Fehler (z.B. 502/offline bleibt „Erneut versuchen")', async () => {
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);
    await expect(
      queryClient.fetchQuery({
        queryKey: ['test-502'],
        retry: false,
        queryFn: () => Promise.reject(new ApiError(502, 'Server nicht erreichbar')),
      }),
    ).rejects.toThrow();
    expect(onExpired).not.toHaveBeenCalled();
  });
});
