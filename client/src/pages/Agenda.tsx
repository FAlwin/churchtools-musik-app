import { useState } from 'react';
import type { Service } from '@shared/types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar, IconButton } from '../components/NavBar';
import { Sheet } from '../components/Sheet';
import { CenterMessage } from '../components/CenterMessage';
import { usePastServices } from '../hooks/useServices';
import { FONTS } from '../utils/constants';
import type { Theme } from '../types/index';
import styles from './Agenda.module.scss';

interface AgendaProps {
  services: Service[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onSelect: (service: Service) => void;
  onLogout: () => void;
  onShowSongs: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  wakePref: boolean;
  onToggleWake: () => void;
  fontId: string;
  setFontId: (id: string) => void;
}

/** Übersicht der Gottesdienste + Einstellungen (Theme, Display-Sperre, Schriftart). */
export function Agenda({
  services,
  isLoading,
  isError,
  onRetry,
  onSelect,
  onLogout,
  onShowSongs,
  theme,
  onToggleTheme,
  wakePref,
  onToggleWake,
  fontId,
  setFontId,
}: AgendaProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showFonts, setShowFonts] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [monthsBack, setMonthsBack] = useState(1);
  const currentFont = FONTS.find((f) => f.id === fontId) ?? FONTS[0];

  const today = new Date().toISOString().slice(0, 10);
  const pastQuery = usePastServices(monthsBack, tab === 'past');
  const upcoming = services.filter((s) => s.date >= today);
  // Vergangene: jüngste zuerst
  const past = [...(pastQuery.data ?? [])]
    .filter((s) => s.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  /** Eine Gottesdienst-Karte. */
  function card(s: Service) {
    return (
      <div key={s.id} className={styles.card} onClick={() => onSelect(s)}>
        <div className={styles.dateBadge}>
          <span className={styles.day}>{s.day}</span>
          <span className={styles.month}>{s.month}</span>
        </div>
        <div className={styles.info}>
          <div className={styles.svcName}>
            {s.weekday} · {s.name}
            {s.subtitle && <span className={styles.subtitlePart}> · {s.subtitle}</span>}
          </div>
          <div className={styles.meta}>
            <span>{s.time}</span>
            <span>{s.location}</span>
            <span>{s.songCount} Songs</span>
          </div>
        </div>
        <span className={styles.arr}>›</span>
      </div>
    );
  }

  return (
    <Screen>
      <NavBar
        title="Gottesdienste"
        subtitle="ECG Donrath"
        right={
          <>
            <IconButton onClick={onShowSongs} title="Alle Lieder" style={{ fontSize: 18 }}>
              ♪
            </IconButton>
            <IconButton onClick={() => setShowSettings((v) => !v)} title="Einstellungen" style={{ fontSize: 18 }}>
              ⚙︎
            </IconButton>
            <IconButton onClick={onLogout} title="Abmelden" style={{ fontSize: 18 }}>
              ⏻
            </IconButton>
          </>
        }
      />

      {showSettings && (
        <>
          <div className={styles.scrim} onClick={() => setShowSettings(false)} />
          <div className={styles.menu}>
            <div className={styles.menuLbl}>Einstellungen</div>
            <div className={styles.mmItem} onClick={onToggleTheme} style={{ cursor: 'pointer' }}>
              <span>Erscheinungsbild</span>
              <button
                className={`${styles.switch}${theme === 'dark' ? ' ' + styles.on : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleTheme();
                }}
              >
                <span className={styles.thumb} />
              </button>
            </div>
            <div className={styles.mmItem} onClick={onToggleWake} style={{ cursor: 'pointer' }}>
              <span>Display anlassen</span>
              <button
                className={`${styles.switch}${wakePref ? ' ' + styles.on : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleWake();
                }}
              >
                <span className={styles.thumb} />
              </button>
            </div>
            <button
              className={styles.mmItem}
              onClick={() => {
                setShowFonts(true);
                setShowSettings(false);
              }}
            >
              <span>Schriftart</span>
              <span className={styles.fontValue} style={{ fontFamily: currentFont.family }}>
                {currentFont.label}
              </span>
            </button>
          </div>
        </>
      )}

      {showFonts && (
        <Sheet title="Schriftart" onClose={() => setShowFonts(false)}>
          {FONTS.map((f) => (
            <button
              key={f.id}
              className={`${styles.fontRow}${fontId === f.id ? ' ' + styles.active : ''}`}
              onClick={() => {
                setFontId(f.id);
                setShowFonts(false);
              }}
            >
              <span className={styles.fontSample} style={{ fontFamily: f.family }}>
                Ag
              </span>
              <span className={styles.fontMeta}>
                <span className={styles.fontName} style={{ fontFamily: f.family }}>
                  {f.label}
                </span>
                <span className={styles.fontDesc}>{f.desc}</span>
              </span>
              {fontId === f.id && <span className={styles.fontCheck}>✓</span>}
            </button>
          ))}
        </Sheet>
      )}

      <div className={styles.tabs}>
        <button
          className={`${styles.tab}${tab === 'upcoming' ? ' ' + styles.tabOn : ''}`}
          onClick={() => setTab('upcoming')}
        >
          Kommende
        </button>
        <button
          className={`${styles.tab}${tab === 'past' ? ' ' + styles.tabOn : ''}`}
          onClick={() => setTab('past')}
        >
          Vergangene
        </button>
      </div>

      <Scroll onRefresh={tab === 'upcoming' ? onRetry : () => pastQuery.refetch()}>
        {tab === 'upcoming' ? (
          isLoading ? (
            <CenterMessage loading text="Gottesdienste werden geladen…" />
          ) : isError ? (
            <CenterMessage icon="⚠️" text="Gottesdienste konnten nicht geladen werden." onRetry={onRetry} />
          ) : upcoming.length === 0 ? (
            <CenterMessage icon="📅" text="Keine kommenden Gottesdienste." />
          ) : (
            <div className={styles.list}>{upcoming.map(card)}</div>
          )
        ) : pastQuery.isLoading ? (
          <CenterMessage loading text="Vergangene werden geladen…" />
        ) : pastQuery.isError ? (
          <CenterMessage
            icon="⚠️"
            text="Vergangene konnten nicht geladen werden."
            onRetry={() => pastQuery.refetch()}
          />
        ) : (
          <>
            {past.length === 0 ? (
              <CenterMessage icon="📅" text="Keine vergangenen Gottesdienste im Zeitraum." />
            ) : (
              <div className={styles.list}>{past.map(card)}</div>
            )}
            <button
              className={styles.loadMore}
              disabled={pastQuery.isFetching}
              onClick={() => setMonthsBack((m) => m + 1)}
            >
              {pastQuery.isFetching ? 'Lädt…' : 'Mehr laden'}
            </button>
          </>
        )}
      </Scroll>
    </Screen>
  );
}
