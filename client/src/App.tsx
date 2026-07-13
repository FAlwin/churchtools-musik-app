import { useEffect, useState, lazy, Suspense, type ComponentProps } from 'react';
import { Login } from './pages/Login';
import { Agenda } from './pages/Agenda';
import { useSettings } from './hooks/useSettings';
import { useWakeLock } from './hooks/useWakeLock';
import { useAuth } from './hooks/useAuth';
import { useSiteConfig } from './hooks/useSiteConfig';
import { useAppNav } from './hooks/useAppNav';
import { useOfflineAutoSync } from './hooks/useOfflineAutoSync';
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
  useSetAgendaItemNote,
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
import { Toast, useToast } from './components/Toast';
import { Coachmarks } from './components/Coachmarks';
import {
  TERMINE_STEPS,
  TOUR_TERMINE,
  isTourDone,
  markTourDone,
  resetTours,
} from './utils/onboarding';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { ApiError } from './services/api';

/** Lade-Anzeige, während ein per Code-Splitting nachgeladener Seiten-Chunk eintrifft (#142). */
const PAGE_FALLBACK = (
  <Screen>
    <CenterMessage loading text="Einen Moment…" />
  </Screen>
);

// Code-Splitting (#142): nur Login + Agenda (Erststart) werden sofort geladen. Die schweren, erst
// nach einer Aktion nötigen Seiten kommen als eigene Chunks nach – v. a. ChordChart, das pdf.js
// (~1 MB) über useSetlistPages hineinzieht. Der Service Worker precacht alle Chunks (globPatterns
// js/mjs) → offline bleiben sie verfügbar (#32); es blitzt nur beim allerersten Nachladen kurz der
// Lade-Screen. Jede Seite bekommt einen dünnen Wrapper mit Suspense, damit die Verwendungsstellen
// unten unverändert bleiben (`<Setlist … />`).
const SetlistLazy = lazy(() => import('./pages/Setlist').then((m) => ({ default: m.Setlist })));
const ChordChartLazy = lazy(() =>
  import('./pages/ChordChart').then((m) => ({ default: m.ChordChart })),
);
const AllSongsLazy = lazy(() => import('./pages/AllSongs').then((m) => ({ default: m.AllSongs })));
const SettingsLazy = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));

const Setlist = (props: ComponentProps<typeof SetlistLazy>) => (
  <Suspense fallback={PAGE_FALLBACK}>
    <SetlistLazy {...props} />
  </Suspense>
);
const ChordChart = (props: ComponentProps<typeof ChordChartLazy>) => (
  <Suspense fallback={PAGE_FALLBACK}>
    <ChordChartLazy {...props} />
  </Suspense>
);
const AllSongs = (props: ComponentProps<typeof AllSongsLazy>) => (
  <Suspense fallback={PAGE_FALLBACK}>
    <AllSongsLazy {...props} />
  </Suspense>
);
const Settings = (props: ComponentProps<typeof SettingsLazy>) => (
  <Suspense fallback={PAGE_FALLBACK}>
    <SettingsLazy {...props} />
  </Suspense>
);

/** Wurzel-Komponente: Auth + Tab-Navigation (Termine/Lieder/Mehr) mit echten ChurchTools-Daten. */
export default function App() {
  const settings = useSettings();
  useWakeLock(settings.wakePref);
  const auth = useAuth();
  const site = useSiteConfig().data;

  const capsQuery = useCapabilities(auth.isAuthenticated);
  const caps = capsQuery.data;
  // Abgelaufene/ungültige ChurchTools-Sitzung: Unser App-Cookie ist noch da (darum kein Login-
  // Screen), aber ChurchTools kennt uns nicht mehr (401). Wiederholen ist zwecklos → automatisch
  // abmelden (verwirft das tote Cookie) und zum Login führen, statt „Erneut versuchen" anzubieten.
  const sessionExpired = capsQuery.error instanceof ApiError && capsQuery.error.status === 401;
  const canViewAgendas = caps?.canViewAgendas ?? false;
  const canViewSongs = caps?.canViewSongs ?? false;
  const canEditAgendas = caps?.canEditAgendas ?? false;
  const canEditSongs = caps?.canEditSongs ?? false;
  const isAdmin = caps?.isAdmin ?? false;

  // servicesQuery hängt nicht vom Navigations-Zustand ab → vor useAppNav, das die Terminliste
  // braucht, um den gespeicherten Gottesdienst nach einem Kaltstart wiederzufinden.
  const servicesQuery = useServices(auth.isAuthenticated && canViewAgendas);
  // Hält den nächsten Gottesdienst automatisch offline bereit (falls in den Einstellungen aktiv).
  useOfflineAutoSync(servicesQuery.data);
  // Offline-Zustand: Liedersammlung braucht das Netz (Charts werden je Lied geladen) → Tab wird
  // ohne Netz ausgegraut, ein Tipp erklärt das kurz (#32).
  const online = useOnlineStatus();
  const { toast: offlineToast, showToast: showOfflineToast } = useToast();

  // Geführte Einführung (#Onboarding): startet automatisch beim ersten Mal, sobald die Termine
  // geladen sind (dann existieren die hervorzuhebenden Elemente). „Einführung nochmal ansehen"
  // im Mehr-Tab setzt zurück und startet sie erneut.
  const [tourActive, setTourActive] = useState(false);

  const {
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
  } = useAppNav({
    isAuthenticated: auth.isAuthenticated,
    isAuthLoading: auth.isLoading,
    services: servicesQuery.data,
    servicesLoading: servicesQuery.isLoading,
  });

  const agendaQuery = useAgenda(service?.id ?? null);
  const reorderAgenda = useReorderAgenda(service?.id ?? null);
  const deleteAgendaItem = useDeleteAgendaItem(service?.id ?? null);
  const renameAgendaItem = useRenameAgendaItem(service?.id ?? null);
  const linkSongToAgendaItem = useLinkSongToAgendaItem(service?.id ?? null);
  const unlinkSongFromAgendaItem = useUnlinkSongFromAgendaItem(service?.id ?? null);
  const setAgendaItemResponsible = useSetAgendaItemResponsible(service?.id ?? null);
  const setAgendaItemDuration = useSetAgendaItemDuration(service?.id ?? null);
  const setAgendaItemHidden = useSetAgendaItemHidden(service?.id ?? null);
  const setAgendaItemNote = useSetAgendaItemNote(service?.id ?? null);
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

  // Wer keine Abläufe sehen darf, startet im Lieder-Tab
  useEffect(() => {
    if (caps && !caps.canViewAgendas && caps.canViewSongs && tab === 'termine') {
      setTab('lieder');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps]);

  // Abgelaufene Sitzung → automatisch abmelden, damit der Login-Screen erscheint.
  useEffect(() => {
    if (sessionExpired) void auth.logout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionExpired]);

  // Einführung beim ersten Mal automatisch starten – erst wenn die Termine da sind (dann existieren
  // die hervorzuhebenden Elemente) und keine Vollansicht offen ist.
  useEffect(() => {
    if (
      tab === 'termine' &&
      view === null &&
      canViewAgendas &&
      (servicesQuery.data?.length ?? 0) > 0 &&
      !isTourDone(TOUR_TERMINE)
    ) {
      setTourActive(true);
    }
  }, [tab, view, canViewAgendas, servicesQuery.data]);

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
        offline={!online}
        onLogin={async (email, password) => {
          await auth.login(email, password);
        }}
      />
    );
  }

  if (!caps) {
    return (
      <Screen>
        {sessionExpired ? (
          // Sitzung abgelaufen: Der Effekt oben meldet gerade ab → gleich erscheint der Login.
          <CenterMessage loading text="Sitzung abgelaufen – bitte neu anmelden…" />
        ) : !online ? (
          // Offline und keine gespeicherten Berechtigungen (z. B. nach einem App-Update) → kein
          // Endlos-Warten, sondern klare Meldung + Rückweg (statt Sackgasse).
          <CenterMessage
            icon="📴"
            text="Offline – Berechtigungen nicht verfügbar. Bitte die App einmal online öffnen."
            actionLabel="Abmelden"
            onAction={() => auth.logout()}
          />
        ) : capsQuery.isError ? (
          // Echter ChurchTools-Aussetzer (leere Rechte-Zuordnungen, 502): getCapabilities wirft,
          // nach den automatischen Neuversuchen landet man hier mit „Erneut versuchen".
          <CenterMessage
            icon="⚠️"
            text="Berechtigungen konnten nicht geladen werden. Bitte erneut versuchen."
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

  // Während eine wiederhergestellte Ansicht ihre Daten nachlädt: kurzer Lade-Screen, statt
  // kurz zur Tab-Ebene zu springen. Greift nur nach einem Kaltstart mit gespeichertem Stand.
  const restoringView =
    !!restored &&
    view !== null &&
    ((view.type === 'setlist' && !service) ||
      (view.type === 'chart' &&
        view.source === 'setlist' &&
        (!service || (songs.length === 0 && agendaQuery.isLoading))));
  // Direktes „Liederheft" aus der Terminliste: Charts geöffnet, aber der Ablauf (und damit die
  // Lieder) lädt noch → kurzer Lade-Screen statt Durchfall zur Tab-Ebene.
  const loadingSongbook =
    view?.type === 'chart' &&
    view.source === 'setlist' &&
    !!service &&
    songs.length === 0 &&
    agendaQuery.isLoading;
  if (restoringView || loadingSongbook) {
    return (
      <Screen>
        <CenterMessage
          loading
          text="Einen Moment…"
          // Sicherheits-Rückweg: dauert das Laden (z. B. offline, Daten nicht im Cache) zu lange,
          // kommt man immer zur Terminübersicht zurück – kein Hängenbleiben im Lade-Screen.
          actionLabel="Zur Übersicht"
          onAction={() => {
            setService(null);
            setView(null);
            setTab('termine');
          }}
        />
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
        onUnlinkSong={(itemId) =>
          unlinkSongFromAgendaItem.mutateAsync({ itemId }).then(() => undefined)
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
        onSetNote={(itemId, note) =>
          setAgendaItemNote.mutateAsync({ itemId, note }).then(() => undefined)
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
          canEditSong={canEditSongs}
          canUseGlobalNotes={caps.canUseGlobalNotes}
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
          canEditSong={canEditSongs}
          canUseGlobalNotes={caps.canUseGlobalNotes}
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
            onOpenSongs={(s) => {
              setService(s);
              setSongIndex(0);
              setView({ type: 'chart', source: 'setlist' });
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
              if (!online) {
                showOfflineToast('Liedersammlung ist offline nicht verfügbar.');
                return;
              }
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
            canUseGlobalNotes={caps.canUseGlobalNotes}
            userName={auth.user ? `${auth.user.firstName} ${auth.user.lastName}`.trim() : undefined}
            onLogout={() => auth.logout()}
            onReplayIntro={() => {
              resetTours();
              setTab('termine');
              setTourActive(true);
            }}
          />
        )}
      </div>
      <TabBar
        active={tab}
        tabs={tabs}
        dimmed={online ? [] : ['lieder']}
        onChange={(t) => {
          if (!online && t === 'lieder') {
            showOfflineToast('Liedersammlung ist offline nicht verfügbar.');
            return;
          }
          setTab(t);
        }}
      />
      <Toast message={offlineToast} />
      {tab === 'termine' && tourActive && (
        <Coachmarks
          steps={TERMINE_STEPS}
          onClose={() => {
            markTourDone(TOUR_TERMINE);
            setTourActive(false);
          }}
        />
      )}
    </div>
  );
}
