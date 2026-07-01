// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { persistQueryClientSave, persistQueryClientRestore } from '@tanstack/react-query-persist-client';
import { createIdbPersister } from './queryClient';

const WEEK = 1000 * 60 * 60 * 24 * 7;
const flush = () => new Promise((r) => setTimeout(r, 50));

/** Prüft die Offline-Grundlage (#32): landen erfolgreiche Queries wirklich in IndexedDB und
 *  kommen nach einem „Neustart" (frischer QueryClient) vollständig zurück? */
describe('Offline-Persistenz (IndexedDB)', () => {
  it('persistiert erfolgreiche Queries und stellt sie nach Neustart wieder her', async () => {
    const persister = createIdbPersister(0);
    const opts = { persister, maxAge: WEEK, buster: 'test' };

    const c1 = new QueryClient({ defaultOptions: { queries: { gcTime: WEEK } } });
    c1.setQueryData(['me'], { authenticated: true, user: { firstName: 'A', lastName: 'B' } });
    c1.setQueryData(['services'], [{ id: 1, name: 'Gottesdienst' }]);
    c1.setQueryData(['agenda', 1], [{ id: 9, title: 'Lied', isHeader: false }]);

    await persistQueryClientSave({ queryClient: c1, ...opts });
    await flush();

    const c2 = new QueryClient({ defaultOptions: { queries: { gcTime: WEEK } } });
    await persistQueryClientRestore({ queryClient: c2, ...opts });

    expect(c2.getQueryData(['me'])).toEqual({
      authenticated: true,
      user: { firstName: 'A', lastName: 'B' },
    });
    expect(c2.getQueryData(['services'])).toEqual([{ id: 1, name: 'Gottesdienst' }]);
    expect(c2.getQueryData(['agenda', 1])).toEqual([{ id: 9, title: 'Lied', isHeader: false }]);
  });
});
