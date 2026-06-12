import { useEffect, useState } from 'react';
import type { Service } from '@shared/types/index';
import { Login } from './pages/Login';
import { Agenda } from './pages/Agenda';
import { Setlist } from './pages/Setlist';
import { ChordChart } from './pages/ChordChart';
import { AllSongs } from './pages/AllSongs';
import { useSettings } from './hooks/useSettings';
import { useAuth } from './hooks/useAuth';
import {
  useServices,
  useAgenda,
  useReorderAgenda,
  useDeleteAgendaItem,
  useRenameAgendaItem,
  useCreateAgendaItem,
  useSongLibrary,
  useSongUsage,
  useSongChart,
} from './hooks/useServices';
import { Screen } from './components/Screen';
import { CenterMessage } from './components/CenterMessage';
import type { Screen as ScreenName } from './types/index';

/** Wurzel-Komponente: Auth-Status + Screen-Navigation mit echten ChurchTools-Daten. */
export default function App() {
  const settings = useSettings();
  const auth = useAuth();

  const [screen, setScreen] = useState<ScreenName>('agenda');
  const [service, setService] = useState<Service | null>(null);
  const [songIndex, setSongIndex] = useState(0);
  const [libSel, setLibSel] = useState<{ songId: number; arrangementId?: number } | null>(null);

  const servicesQuery = useServices(auth.isAuthenticated);
  const agendaQuery = useAgenda(service?.id ?? null);
  const reorderAgenda = useReorderAgenda(service?.id ?? null);
  const deleteAgendaItem = useDeleteAgendaItem(service?.id ?? null);
  const renameAgendaItem = useRenameAgendaItem(service?.id ?? null);
  const createAgendaItem = useCreateAgendaItem(service?.id ?? null);
  const songLibrary = useSongLibrary(auth.isAuthenticated && (screen === 'songs' || screen === 'songchart'));
  const songUsage = useSongUsage(auth.isAuthenticated && screen === 'songs');
  const songChart = useSongChart(screen === 'songchart' ? libSel : null);
  const items = agendaQuery.data ?? [];
  // Nur die Lieder – für die Index-Navigation der Charts.
  const songs = items.flatMap((i) => (i.song ? [i.song] : []));

  // Nach dem Abmelden zurück auf die Agenda-Startansicht
  useEffect(() => {
    if (!auth.isAuthenticated) {
      setService(null);
      setScreen('agenda');
    }
  }, [auth.isAuthenticated]);

  // Initialer Auth-Check läuft noch
  if (auth.isLoading) {
    return (
      <Screen>
        <CenterMessage loading text="Einen Moment…" />
      </Screen>
    );
  }

  // Nicht angemeldet → Login
  if (!auth.isAuthenticated) {
    return (
      <Login
        onLogin={async (email, password) => {
          await auth.login(email, password);
        }}
      />
    );
  }

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {screen === 'agenda' && (
        <Agenda
          services={servicesQuery.data ?? []}
          isLoading={servicesQuery.isLoading}
          isError={servicesQuery.isError}
          onRetry={() => servicesQuery.refetch()}
          onSelect={(s) => {
            setService(s);
            setScreen('setlist');
          }}
          onLogout={() => auth.logout()}
          onShowSongs={() => setScreen('songs')}
          theme={settings.theme}
          onToggleTheme={settings.toggleTheme}
          wakePref={settings.wakePref}
          onToggleWake={settings.toggleWake}
          fontId={settings.fontId}
          setFontId={settings.setFontId}
        />
      )}

      {screen === 'songs' && (
        <AllSongs
          songs={songLibrary.data ?? []}
          usage={songUsage.data}
          usageLoading={songUsage.isLoading}
          isLoading={songLibrary.isLoading}
          isError={songLibrary.isError}
          onRetry={() => songLibrary.refetch()}
          onSelect={(e) => {
            setLibSel({ songId: e.songId, arrangementId: e.arrangementId });
            setScreen('songchart');
          }}
          onBack={() => setScreen('agenda')}
        />
      )}

      {screen === 'songchart' &&
        (songChart.data ? (
          <ChordChart
            songs={[songChart.data]}
            startIndex={0}
            onBack={() => setScreen('songs')}
            onReload={() => songChart.refetch()}
            reloading={songChart.isFetching}
            theme={settings.theme}
            wakePref={settings.wakePref}
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
        ))}

      {screen === 'setlist' && service && (
        <Setlist
          service={service}
          items={items}
          isLoading={agendaQuery.isLoading}
          isError={agendaQuery.isError}
          onRetry={() => agendaQuery.refetch()}
          onSelect={(i) => {
            setSongIndex(i);
            setScreen('chart');
          }}
          onBack={() => setScreen('agenda')}
          onReorder={(order) => reorderAgenda.mutateAsync(order).then(() => undefined)}
          isReordering={reorderAgenda.isPending}
          onDelete={(itemId) => deleteAgendaItem.mutateAsync(itemId).then(() => undefined)}
          onRename={(itemId, title) =>
            renameAgendaItem.mutateAsync({ itemId, title }).then(() => undefined)
          }
          onAdd={(data) => createAgendaItem.mutateAsync(data).then(() => undefined)}
        />
      )}

      {screen === 'chart' && service && songs.length > 0 && (
        <ChordChart
          songs={songs}
          startIndex={songIndex}
          onBack={() => setScreen('setlist')}
          onReload={() => agendaQuery.refetch()}
          reloading={agendaQuery.isFetching}
          theme={settings.theme}
          wakePref={settings.wakePref}
          fontId={settings.fontId}
        />
      )}
    </div>
  );
}
