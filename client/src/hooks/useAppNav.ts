import { useEffect, useState } from 'react';
import type { Service } from '@shared/types/index';
import type { TabId } from '../components/TabBar';
import { type View, type PersistedNav, loadNav, saveNav, clearNav } from '../utils/navStorage';

interface UseAppNavArgs {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  /** Geladene Terminliste – nötig, um den gespeicherten Gottesdienst nach einem Kaltstart wiederzufinden. */
  services: Service[] | undefined;
  servicesLoading: boolean;
}

interface AppNav {
  /** Beim Mount einmalig gelesener gespeicherter Stand (oder null). */
  restored: PersistedNav | null;
  tab: TabId;
  setTab: (t: TabId) => void;
  view: View;
  setView: (v: View) => void;
  service: Service | null;
  setService: (s: Service | null) => void;
  songIndex: number;
  setSongIndex: (i: number) => void;
  libSel: { songId: number; arrangementId?: number } | null;
  setLibSel: (s: { songId: number; arrangementId?: number } | null) => void;
}

/**
 * Navigations-Zustand der App (Tab / Vollbild-Ansicht / gewählter Gottesdienst & Lied) inklusive
 * Persistenz gegen den iOS-PWA-Kaltstart: sichert den Stand laufend und stellt ihn beim Start wieder
 * her. Reine Zustands-/Speicherlogik – ohne sie wäre `App` mit drei Effekten und sechs States voll.
 */
export function useAppNav({ isAuthenticated, isAuthLoading, services, servicesLoading }: UseAppNavArgs): AppNav {
  // Einmalig beim Mount den gespeicherten Stand lesen (oder null).
  const [restored] = useState(loadNav);
  const [tab, setTab] = useState<TabId>(() => restored?.tab ?? 'termine');
  const [view, setView] = useState<View>(() => restored?.view ?? null);
  const [service, setService] = useState<Service | null>(null);
  const [songIndex, setSongIndex] = useState(() => restored?.songIndex ?? 0);
  const [libSel, setLibSel] = useState<{ songId: number; arrangementId?: number } | null>(
    () => restored?.libSel ?? null,
  );

  // Nach dem Abmelden (nicht: während des initialen Auth-Ladens) zurück in den Startzustand
  // und gespeicherte Ansicht verwerfen.
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      setService(null);
      setView(null);
      setTab('termine');
      setSongIndex(0);
      setLibSel(null);
      clearNav();
    }
  }, [isAuthLoading, isAuthenticated]);

  // Wiederherstellung: gespeicherten Gottesdienst anhand der ID erneut auswählen, sobald die
  // Terminliste geladen ist. Nur wenn eine Ansicht wiederhergestellt wurde (view != null).
  // Lässt er sich nicht finden (z. B. nicht mehr in der Liste), zurück zur Startansicht –
  // damit hängt nichts im Lade-Screen.
  useEffect(() => {
    if (!restored?.serviceId || service || !isAuthenticated || !view) return;
    if (servicesLoading) return;
    const found = services?.find((s) => s.id === restored.serviceId);
    if (found) setService(found);
    else setView(null);
  }, [restored, service, isAuthenticated, view, servicesLoading, services]);

  // Aktuellen Stand sichern (nur eingeloggt), damit ein iOS-PWA-Kaltstart unsichtbar bleibt.
  useEffect(() => {
    if (!isAuthenticated) return;
    saveNav({ tab, view, serviceId: service?.id ?? null, songIndex, libSel, savedAt: Date.now() });
  }, [isAuthenticated, tab, view, service, songIndex, libSel]);

  return {
    restored,
    tab,
    setTab,
    view,
    setView,
    service,
    setService,
    songIndex,
    setSongIndex,
    libSel,
    setLibSel,
  };
}
