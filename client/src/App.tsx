import { useState } from 'react';
import type { Service, SetlistSong } from '@shared/types/index';
import { Login } from './pages/Login';
import { Agenda } from './pages/Agenda';
import { Setlist } from './pages/Setlist';
import { ChordChart } from './pages/ChordChart';
import { useSettings } from './hooks/useSettings';
import { MOCK_SERVICES, MOCK_SONGS, MOCK_SETLISTS } from './services/mockData';
import type { Screen as ScreenName } from './types/index';

/** Songs eines Gottesdienstes aus den Mock-Daten zusammenstellen. */
function songsForService(service: Service): SetlistSong[] {
  const ids = MOCK_SETLISTS[service.id] ?? [];
  return ids.map((id) => MOCK_SONGS.find((s) => s.id === id)).filter((s): s is SetlistSong => Boolean(s));
}

/** Wurzel-Komponente: steuert Screen-Navigation und globale Einstellungen. */
export default function App() {
  const [screen, setScreen] = useState<ScreenName>('login');
  const [service, setService] = useState<Service | null>(null);
  const [songIndex, setSongIndex] = useState(0);
  const settings = useSettings();

  const songs = service ? songsForService(service) : [];

  // Mock-Login: in Schritt 8 durch echte ChurchTools-Anmeldung ersetzt
  async function handleLogin() {
    await new Promise((r) => setTimeout(r, 600));
    setScreen('agenda');
  }

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {screen === 'login' && <Login onLogin={handleLogin} />}

      {screen === 'agenda' && (
        <Agenda
          services={MOCK_SERVICES}
          onSelect={(s) => {
            setService(s);
            setScreen('setlist');
          }}
          onLogout={() => setScreen('login')}
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
          songs={songs}
          onSelect={(i) => {
            setSongIndex(i);
            setScreen('chart');
          }}
          onBack={() => setScreen('agenda')}
        />
      )}

      {screen === 'chart' && service && songs.length > 0 && (
        <ChordChart
          songs={songs}
          startIndex={songIndex}
          onBack={() => setScreen('setlist')}
          theme={settings.theme}
          wakePref={settings.wakePref}
          fontId={settings.fontId}
        />
      )}
    </div>
  );
}
