import { describe, it, expect, beforeEach } from 'vitest';
import { getReachable, markReachable, subscribeReachable } from './reachability';

describe('Server-Erreichbarkeit (#32)', () => {
  beforeEach(() => markReachable(true)); // Grundzustand: erreichbar

  it('startet erreichbar', () => {
    expect(getReachable()).toBe(true);
  });

  it('markReachable(false) setzt offline und benachrichtigt Abonnenten', () => {
    let seen: boolean | null = null;
    const unsub = subscribeReachable((v) => (seen = v));
    markReachable(false);
    expect(getReachable()).toBe(false);
    expect(seen).toBe(false);
    unsub();
  });

  it('benachrichtigt NICHT bei unverändertem Wert (kein Rerender-Sturm)', () => {
    markReachable(false);
    let calls = 0;
    const unsub = subscribeReachable(() => calls++);
    markReachable(false); // gleicher Wert → keine Benachrichtigung
    expect(calls).toBe(0);
    markReachable(true); // Wechsel → genau eine Benachrichtigung
    expect(calls).toBe(1);
    unsub();
  });

  it('nach unsubscribe keine Benachrichtigung mehr', () => {
    let calls = 0;
    const unsub = subscribeReachable(() => calls++);
    unsub();
    markReachable(false);
    expect(calls).toBe(0);
  });
});
