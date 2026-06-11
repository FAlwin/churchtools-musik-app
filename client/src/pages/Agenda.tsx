import { useState } from 'react';
import type { Service } from '@shared/types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar, IconButton } from '../components/NavBar';
import { Sheet } from '../components/Sheet';
import { CenterMessage } from '../components/CenterMessage';
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
  theme,
  onToggleTheme,
  wakePref,
  onToggleWake,
  fontId,
  setFontId,
}: AgendaProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showFonts, setShowFonts] = useState(false);
  const currentFont = FONTS.find((f) => f.id === fontId) ?? FONTS[0];

  return (
    <Screen>
      <NavBar
        title="Gottesdienste"
        subtitle="ECG Donrath"
        right={
          <>
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

      <Scroll onRefresh={onRetry}>
        {isLoading ? (
          <CenterMessage loading text="Gottesdienste werden geladen…" />
        ) : isError ? (
          <CenterMessage icon="⚠️" text="Gottesdienste konnten nicht geladen werden." onRetry={onRetry} />
        ) : services.length === 0 ? (
          <CenterMessage icon="📅" text="Keine Gottesdienste mit Setlist gefunden." />
        ) : (
        <div className={styles.list}>
          {services.map((s) => (
            <div key={s.id} className={styles.card} onClick={() => onSelect(s)}>
              <div className={styles.dateBadge}>
                <span className={styles.day}>{s.day}</span>
                <span className={styles.month}>{s.month}</span>
              </div>
              <div className={styles.info}>
                <div className={styles.svcName}>
                  {s.weekday} · {s.name}
                </div>
                <div className={styles.meta}>
                  <span>{s.time}</span>
                  <span>{s.location}</span>
                  <span>{s.songCount} Songs</span>
                </div>
              </div>
              <span className={styles.arr}>›</span>
            </div>
          ))}
        </div>
        )}
      </Scroll>
    </Screen>
  );
}
