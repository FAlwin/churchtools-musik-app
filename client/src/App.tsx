import { useEffect, useState } from 'react';
import type { Service } from '@shared/types/index';
import { Login } from './pages/Login';
import { Agenda } from './pages/Agenda';
import { Setlist } from './pages/Setlist';
import { ChordChart } from './pages/ChordChart';
import { useSettings } from './hooks/useSettings';
import { useAuth } from './hooks/useAuth';
import { useServices, useAgenda, useReorderAgenda, useDeleteAgendaItem } from './hooks/useServices';
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

  const servicesQuery = useServices(auth.isAuthenticated);
  const agendaQuery = useAgenda(service?.id ?? null);
  const reorderAgenda = useReorderAgenda(service?.id ?? null);
  const deleteAgendaItem = useDeleteAgendaItem(service?.id ?? null);
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
          theme={settings.theme}
          onToggleTheme={settings.toggleTheme}
          wakePref={settings.wakePref}
          onToggleWake={settings.toggleWake}
          fontId={settings.fontId}
          setFontId={settings.setFontId}
        />
      )}

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
