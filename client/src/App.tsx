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
  useCapabilities,
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

  const capsQuery = useCapabilities(auth.isAuthenticated);
  const caps = capsQuery.data;
  const canViewAgendas = caps?.canViewAgendas ?? false;
  const canViewSongs = caps?.canViewSongs ?? false;
  const canEditAgendas = caps?.canEditAgendas ?? false;
  const canEditSongs = caps?.canEditSongs ?? false;

  const servicesQuery = useServices(auth.isAuthenticated && canViewAgendas);
  const agendaQuery = useAgenda(service?.id ?? null);
  const reorderAgenda = useReorderAgenda(service?.id ?? null);
  const deleteAgendaItem = useDeleteAgendaItem(service?.id ?? null);
  const renameAgendaItem = useRenameAgendaItem(service?.id ?? null);
  const createAgendaItem = useCreateAgendaItem(service?.id ?? null);
  const songLibrary = useSongLibrary(auth.isAuthenticated && (screen === 'songs' || screen === 'songchart'));
  // Statistik nur für Ablauf-Berechtigte (sie wird aus Abläufen berechnet).
  const songUsage = useSongUsage(auth.isAuthenticated && screen === 'songs' && canViewAgendas);
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

  // Wer keine Abläufe sehen darf, startet direkt im Liederbuch
  useEffect(() => {
    if (caps && !caps.canViewAgendas && caps.canViewSongs && screen === 'agenda') {
      setScreen('songs');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps]);

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

  // Rechte werden noch geladen → kurz warten (verhindert Aufblitzen falscher Ansichten)
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

  // Weder Lieder noch Abläufe erlaubt
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

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {screen === 'agenda' && canViewAgendas && (
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
          onShowSongs={canViewSongs ? () => setScreen('songs') : undefined}
          theme={settings.theme}
          onToggleTheme={settings.toggleTheme}
          wakePref={settings.wakePref}
          onToggleWake={settings.toggleWake}
          fontId={settings.fontId}
          setFontId={settings.setFontId}
        />
      )}

      {screen === 'songs' && canViewSongs && (
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
            setScreen('songchart');
          }}
          onBack={canViewAgendas ? () => setScreen('agenda') : undefined}
          onLogout={() => auth.logout()}
        />
      )}

      {screen === 'songchart' &&
        canViewSongs &&
        (songChart.data ? (
          <ChordChart
            songs={[songChart.data]}
            startIndex={0}
            onBack={() => setScreen('songs')}
            onReload={() => songChart.refetch()}
            reloading={songChart.isFetching}
            canEditSong={canEditSongs}
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
          canEdit={canEditAgendas}
        />
      )}

      {screen === 'chart' && service && songs.length > 0 && (
        <ChordChart
          songs={songs}
          startIndex={songIndex}
          onBack={() => setScreen('setlist')}
          onReload={() => agendaQuery.refetch()}
          reloading={agendaQuery.isFetching}
          canEditSong={canEditSongs}
          theme={settings.theme}
          wakePref={settings.wakePref}
          fontId={settings.fontId}
        />
      )}
    </div>
  );
}
