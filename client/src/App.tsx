import { useEffect, useState } from 'react';
import type { Service } from '@shared/types/index';
import { Login } from './pages/Login';
import { Agenda } from './pages/Agenda';
import { Setlist } from './pages/Setlist';
import { ChordChart } from './pages/ChordChart';
import { AllSongs } from './pages/AllSongs';
import { Settings } from './pages/Settings';
import { useSettings } from './hooks/useSettings';
import { useWakeLock } from './hooks/useWakeLock';
import { useAuth } from './hooks/useAuth';
import { useSiteConfig } from './hooks/useSiteConfig';
import {
  useServices,
  useAgenda,
  useReorderAgenda,
  useDeleteAgendaItem,
  useRenameAgendaItem,
  useLinkSongToAgendaItem,
  useUnlinkSongFromAgendaItem,
  useSetAgendaItemResponsible,
  useSetAgendaItemDuration,
  useSetAgendaItemHidden,
  useAgendaServices,
  useCreateAgendaItem,
  useSongLibrary,
  useSongUsage,
  useSongChart,
  useCapabilities,
} from './hooks/useServices';
import { Screen } from './components/Screen';
import { CenterMessage } from './components/CenterMessage';
import { TabBar, type TabId } from './components/TabBar';

/** Eine gepushte Vollbild-Ansicht über der Tab-Ebene. */
type View = null | { type: 'setlist' } | { type: 'chart'; source: 'setlist' | 'lieder' };

// ── Wiederherstellung der letzten Ansicht (gegen iOS-PWA-Kaltstart) ──
// iOS verwirft eine installierte PWA beim Wegwechseln oft aus dem Speicher; die Rückkehr ist ein
// Kaltstart. Wir können das nicht verhindern, machen es aber unsichtbar: den letzten Stand sichern
// und beim Start wiederherstellen.
const NAV_KEY = 'worship:nav-v1';
// Lebensdauer des gespeicherten Stands: überlebt ein Recycling (Minuten/Stunden),
// startet aber nicht Tage später noch im alten Lied.
const NAV_TTL_MS = 1000 * 60 * 60 * 8;

interface PersistedNav {
  tab: TabId;
  view: View;
  serviceId: number | null;
  songIndex: number;
  libSel: { songId: number; arrangementId?: number } | null;
  savedAt: number;
}

function loadNav(): PersistedNav | null {
  try {
    const raw = localStorage.getItem(NAV_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedNav;
    if (typeof p?.savedAt !== 'number' || Date.now() - p.savedAt > NAV_TTL_MS) return null;
    return p;
  } catch {
    return null;
  }
}

function saveNav(nav: PersistedNav): void {
  try {
    localStorage.setItem(NAV_KEY, JSON.stringify(nav));
  } catch {
    // Speicher nicht verfügbar – Wiederherstellung entfällt dann eben
  }
}

function clearNav(): void {
  try {
    localStorage.removeItem(NAV_KEY);
  } catch {
    // ignorieren
  }
}

/** Wurzel-Komponente: Auth + Tab-Navigation (Termine/Lieder/Mehr) mit echten ChurchTools-Daten. */
export default function App() {
  const settings = useSettings();
  useWakeLock(settings.wakePref);
  const auth = useAuth();
  const site = useSiteConfig().data;

  // Einmalig beim Mount den gespeicherten Stand lesen (oder null).
  const [restored] = useState(loadNav);
  const [tab, setTab] = useState<TabId>(() => restored?.tab ?? 'termine');
  const [view, setView] = useState<View>(() => restored?.view ?? null);
  const [service, setService] = useState<Service | null>(null);
  const [songIndex, setSongIndex] = useState(() => restored?.songIndex ?? 0);
  const [libSel, setLibSel] = useState<{ songId: number; arrangementId?: number } | null>(
    () => restored?.libSel ?? null,
  );

  const capsQuery = useCapabilities(auth.isAuthenticated);
  const caps = capsQuery.data;
  const canViewAgendas = caps?.canViewAgendas ?? false;
  const canViewSongs = caps?.canViewSongs ?? false;
  const canEditAgendas = caps?.canEditAgendas ?? false;
  const canEditSongs = caps?.canEditSongs ?? false;
  const isAdmin = caps?.isAdmin ?? false;

  const servicesQuery = useServices(auth.isAuthenticated && canViewAgendas);
  const agendaQuery = useAgenda(service?.id ?? null);
  const reorderAgenda = useReorderAgenda(service?.id ?? null);
  const deleteAgendaItem = useDeleteAgendaItem(service?.id ?? null);
  const renameAgendaItem = useRenameAgendaItem(service?.id ?? null);
  const linkSongToAgendaItem = useLinkSongToAgendaItem(service?.id ?? null);
  const unlinkSongFromAgendaItem = useUnlinkSongFromAgendaItem(service?.id ?? null);
  const setAgendaItemResponsible = useSetAgendaItemResponsible(service?.id ?? null);
  const setAgendaItemDuration = useSetAgendaItemDuration(service?.id ?? null);
  const setAgendaItemHidden = useSetAgendaItemHidden(service?.id ?? null);
  const agendaServices = useAgendaServices(
    auth.isAuthenticated && canEditAgendas && view?.type === 'setlist',
  );
  const createAgendaItem = useCreateAgendaItem(service?.id ?? null);
  const songLibrary = useSongLibrary(
    auth.isAuthenticated && (tab === 'lieder' || view?.type === 'chart'),
  );
  // Statistik nur für Ablauf-Berechtigte (sie wird aus Abläufen berechnet).
  const songUsage = useSongUsage(auth.isAuthenticated && tab === 'lieder' && canViewAgendas);
  const songChart = useSongChart(
    view?.type === 'chart' && view.source === 'lieder' ? libSel : null,
  );
  const items = agendaQuery.data ?? [];
  const songs = items.flatMap((i) => (i.song ? [i.song] : []));

  // Nach dem Abmelden (nicht: während des initialen Auth-Ladens) zurück in den Startzustand
  // und gespeicherte Ansicht verwerfen.
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      setService(null);
      setView(null);
      setTab('termine');
      setSongIndex(0);
      setLibSel(null);
      clearNav();
    }
  }, [auth.isLoading, auth.isAuthenticated]);

  // Wer keine Abläufe sehen darf, startet im Lieder-Tab
  useEffect(() => {
    if (caps && !caps.canViewAgendas && caps.canViewSongs && tab === 'termine') {
      setTab('lieder');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps]);

  // Wiederherstellung: gespeicherten Gottesdienst anhand der ID erneut auswählen, sobald die
  // Terminliste geladen ist. Nur wenn eine Ansicht wiederhergestellt wurde (view != null).
  // Lässt er sich nicht finden (z. B. nicht mehr in der Liste), zurück zur Startansicht –
  // damit hängt nichts im Lade-Screen.
  useEffect(() => {
    if (!restored?.serviceId || service || !auth.isAuthenticated || !view) return;
    if (servicesQuery.isLoading) return;
    const found = servicesQuery.data?.find((s) => s.id === restored.serviceId);
    if (found) setService(found);
    else setView(null);
  }, [restored, service, auth.isAuthenticated, view, servicesQuery.isLoading, servicesQuery.data]);

  // Aktuellen Stand sichern (nur eingeloggt), damit ein iOS-PWA-Kaltstart unsichtbar bleibt.
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    saveNav({ tab, view, serviceId: service?.id ?? null, songIndex, libSel, savedAt: Date.now() });
  }, [auth.isAuthenticated, tab, view, service, songIndex, libSel]);

  if (auth.isLoading) {
    return (
      <Screen>
        <CenterMessage loading text="Einen Moment…" />
      </Screen>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <Login
        site={site}
        theme={settings.theme}
        onLogin={async (email, password) => {
          await auth.login(email, password);
        }}
      />
    );
  }

  if (!caps) {
    return (
      <Screen>
        {capsQuery.isError ? (
          <CenterMessage
            icon="⚠️"
            text="Berechtigungen konnten nicht geladen werden."
            onRetry={() => capsQuery.refetch()}
            actionLabel="Abmelden"
            onAction={() => auth.logout()}
          />
        ) : (
          <CenterMessage loading text="Einen Moment…" />
        )}
      </Screen>
    );
  }

  if (!canViewAgendas && !canViewSongs) {
    return (
      <Screen>
        <CenterMessage
          icon="🔒"
          text="Dein ChurchTools-Konto hat keine Berechtigung für Lieder oder Abläufe."
          actionLabel="Abmelden"
          onAction={() => auth.logout()}
        />
      </Screen>
    );
  }

  // Während eine wiederhergestellte Ansicht ihre Daten nachlädt: kurzer Lade-Screen, statt
  // kurz zur Tab-Ebene zu springen. Greift nur nach einem Kaltstart mit gespeichertem Stand.
  const restoringView =
    !!restored &&
    view !== null &&
    ((view.type === 'setlist' && !service) ||
      (view.type === 'chart' &&
        view.source === 'setlist' &&
        (!service || (songs.length === 0 && agendaQuery.isLoading))));
  if (restoringView) {
    return (
      <Screen>
        <CenterMessage loading text="Einen Moment…" />
      </Screen>
    );
  }

  // ── Gepushte Vollbild-Ansichten (ohne Tab-Bar) ──
  if (view?.type === 'setlist' && service) {
    return (
      <Setlist
        service={service}
        items={items}
        isLoading={agendaQuery.isLoading}
        isError={agendaQuery.isError}
        onRetry={() => agendaQuery.refetch()}
        onSelect={(i) => {
          setSongIndex(i);
          setView({ type: 'chart', source: 'setlist' });
        }}
        onBack={() => setView(null)}
        onReorder={(order) => reorderAgenda.mutateAsync(order).then(() => undefined)}
        isReordering={reorderAgenda.isPending}
        onDelete={(itemId) => deleteAgendaItem.mutateAsync(itemId).then(() => undefined)}
        onRename={(itemId, title) =>
          renameAgendaItem.mutateAsync({ itemId, title }).then(() => undefined)
        }
        onLinkSong={(itemId, arrangementId) =>
          linkSongToAgendaItem.mutateAsync({ itemId, arrangementId }).then(() => undefined)
        }
        onUnlinkSong={(itemId, title) =>
          unlinkSongFromAgendaItem.mutateAsync({ itemId, title }).then(() => undefined)
        }
        onSetResponsible={(itemId, responsible) =>
          setAgendaItemResponsible.mutateAsync({ itemId, responsible }).then(() => undefined)
        }
        onSetDuration={(itemId, durationMin) =>
          setAgendaItemDuration.mutateAsync({ itemId, durationMin }).then(() => undefined)
        }
        onToggleHidden={(itemId, hidden) =>
          setAgendaItemHidden.mutateAsync({ itemId, hidden }).then(() => undefined)
        }
        onAdd={(data) => createAgendaItem.mutateAsync(data).then(() => undefined)}
        services={agendaServices.data ?? []}
        canEdit={canEditAgendas}
      />
    );
  }

  if (view?.type === 'chart') {
    if (view.source === 'setlist' && service && songs.length > 0) {
      return (
        <ChordChart
          songs={songs}
          startIndex={songIndex}
          onBack={() => setView({ type: 'setlist' })}
          onReload={() => agendaQuery.refetch()}
          reloading={agendaQuery.isFetching}
          canEditSong={canEditSongs}
          theme={settings.theme}
          fontId={settings.fontId}
        />
      );
    }
    if (view.source === 'lieder') {
      return songChart.data ? (
        <ChordChart
          songs={[songChart.data]}
          startIndex={0}
          onBack={() => setView(null)}
          onReload={() => songChart.refetch()}
          reloading={songChart.isFetching}
          canEditSong={canEditSongs}
          theme={settings.theme}
          fontId={settings.fontId}
        />
      ) : (
        <Screen>
          {songChart.isError ? (
            <CenterMessage
              icon="⚠️"
              text="Lied konnte nicht geladen werden."
              onRetry={() => songChart.refetch()}
            />
          ) : (
            <CenterMessage loading text="Lied wird geladen…" />
          )}
        </Screen>
      );
    }
  }

  // ── Tab-Ebene (mit Tab-Bar) ──
  const tabs: TabId[] = [];
  if (canViewAgendas) tabs.push('termine');
  if (canViewSongs) tabs.push('lieder');
  tabs.push('mehr');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {tab === 'termine' && canViewAgendas && (
          <Agenda
            services={servicesQuery.data ?? []}
            isLoading={servicesQuery.isLoading}
            isError={servicesQuery.isError}
            onRetry={() => servicesQuery.refetch()}
            onSelect={(s) => {
              setService(s);
              setView({ type: 'setlist' });
            }}
          />
        )}

        {tab === 'lieder' && canViewSongs && (
          <AllSongs
            songs={songLibrary.data ?? []}
            usage={songUsage.data}
            usageLoading={songUsage.isLoading}
            showStats={canViewAgendas}
            isLoading={songLibrary.isLoading}
            isError={songLibrary.isError}
            onRetry={() => songLibrary.refetch()}
            onSelect={(e) => {
              setLibSel({ songId: e.songId, arrangementId: e.arrangementId });
              setView({ type: 'chart', source: 'lieder' });
            }}
            canAddToAgenda={canEditAgendas}
            services={servicesQuery.data ?? []}
          />
        )}

        {tab === 'mehr' && (
          <Settings
            site={site}
            theme={settings.theme}
            themePref={settings.themePref}
            setThemePref={settings.setThemePref}
            wakePref={settings.wakePref}
            onToggleWake={settings.toggleWake}
            isAdmin={isAdmin}
            userName={auth.user ? `${auth.user.firstName} ${auth.user.lastName}`.trim() : undefined}
            onLogout={() => auth.logout()}
          />
        )}
      </div>
      <TabBar active={tab} tabs={tabs} onChange={setTab} />
    </div>
  );
}
