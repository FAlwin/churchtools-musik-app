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

/** Wurzel-Komponente: Auth + Tab-Navigation (Termine/Lieder/Mehr) mit echten ChurchTools-Daten. */
export default function App() {
  const settings = useSettings();
  useWakeLock(settings.wakePref);
  const auth = useAuth();
  const site = useSiteConfig().data;

  const [tab, setTab] = useState<TabId>('termine');
  const [view, setView] = useState<View>(null);
  const [service, setService] = useState<Service | null>(null);
  const [songIndex, setSongIndex] = useState(0);
  const [libSel, setLibSel] = useState<{ songId: number; arrangementId?: number } | null>(null);

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
  const agendaServices = useAgendaServices(
    auth.isAuthenticated && canEditAgendas && view?.type === 'setlist',
  );
  const createAgendaItem = useCreateAgendaItem(service?.id ?? null);
  const songLibrary = useSongLibrary(
    auth.isAuthenticated && (tab === 'lieder' || view?.type === 'chart'),
  );
  // Statistik nur für Ablauf-Berechtigte (sie wird aus Abläufen berechnet).
  const songUsage = useSongUsage(auth.isAuthenticated && tab === 'lieder' && canViewAgendas);
  const songChart = useSongChart(view?.type === 'chart' && view.source === 'lieder' ? libSel : null);
  const items = agendaQuery.data ?? [];
  const songs = items.flatMap((i) => (i.song ? [i.song] : []));

  // Nach dem Abmelden zurück in den Startzustand
  useEffect(() => {
    if (!auth.isAuthenticated) {
      setService(null);
      setView(null);
      setTab('termine');
    }
  }, [auth.isAuthenticated]);

  // Wer keine Abläufe sehen darf, startet im Lieder-Tab
  useEffect(() => {
    if (caps && !caps.canViewAgendas && caps.canViewSongs && tab === 'termine') {
      setTab('lieder');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps]);

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
        onRename={(itemId, title) => renameAgendaItem.mutateAsync({ itemId, title }).then(() => undefined)}
        onLinkSong={(itemId, arrangementId) =>
          linkSongToAgendaItem.mutateAsync({ itemId, arrangementId }).then(() => undefined)
        }
        onUnlinkSong={(itemId, title) =>
          unlinkSongFromAgendaItem.mutateAsync({ itemId, title }).then(() => undefined)
        }
        onSetResponsible={(itemId, responsible) =>
          setAgendaItemResponsible.mutateAsync({ itemId, responsible }).then(() => undefined)
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
            <CenterMessage icon="⚠️" text="Lied konnte nicht geladen werden." onRetry={() => songChart.refetch()} />
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
            onLogout={() => auth.logout()}
          />
        )}
      </div>
      <TabBar active={tab} tabs={tabs} onChange={setTab} />
    </div>
  );
}
