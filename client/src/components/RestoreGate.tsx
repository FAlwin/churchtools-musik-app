import type { ReactNode } from 'react';
import { useIsRestoring } from '@tanstack/react-query';

/**
 * Hält die App zurück, bis der persistierte Query-Cache aus IndexedDB wiederhergestellt ist (#32).
 * Ohne dieses Gate rendert die App im ersten Moment mit LEEREM Cache → sie hält sich für
 * „nicht angemeldet" und zeigt kurz den Login-Screen (offline eine Sackgasse) und löscht sogar den
 * gemerkten Gottesdienst. Der kurze Ladehinweis überbrückt genau dieses Fenster.
 */
export function RestoreGate({ children }: { children: ReactNode }) {
  const isRestoring = useIsRestoring();
  if (!isRestoring) return <>{children}</>;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg, #f5f6f8)',
        color: 'var(--text2, #667)',
        fontFamily: 'var(--ui, system-ui, sans-serif)',
        fontSize: 15,
      }}
    >
      Einen Moment…
    </div>
  );
}
