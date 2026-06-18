/**
 * Schlanke Line-Icons im ChurchTools-Stil (portiert aus dem Design-Handoff).
 * Nutzung: <Icon name="calendar" size={24} stroke={1.9} />
 */
import type { CSSProperties } from 'react';

export type IconName =
  | 'calendar'
  | 'calendar-fill'
  | 'music'
  | 'music-fill'
  | 'cog'
  | 'cog-fill'
  | 'chev-left'
  | 'chev-right'
  | 'chev-down'
  | 'search'
  | 'sun'
  | 'moon'
  | 'lock'
  | 'type'
  | 'logout'
  | 'check'
  | 'pencil'
  | 'columns'
  | 'people'
  | 'clock'
  | 'pin'
  | 'link'
  | 'trash'
  | 'heading'
  | 'plus';

interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
  className?: string;
}

export function Icon({ name, size = 22, stroke = 2, style, className }: IconProps) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style,
    className,
  };
  const f = { ...p, fill: 'currentColor', stroke: 'none' };
  switch (name) {
    case 'calendar':
      return (
        <svg {...p}>
          <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
          <path d="M3 9h18M8 2.5v4M16 2.5v4" />
        </svg>
      );
    case 'calendar-fill':
      return (
        <svg {...f}>
          <path d="M6 2.2a1 1 0 0 1 1 1V4h10v-.8a1 1 0 1 1 2 0V4.5h.5A2.5 2.5 0 0 1 22 7v12.5A2.5 2.5 0 0 1 19.5 22h-15A2.5 2.5 0 0 1 2 19.5V7a2.5 2.5 0 0 1 2.5-2.5H5v-.3a1 1 0 0 1 1-1ZM4 9.5v10a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5v-10H4Z" />
        </svg>
      );
    case 'music':
      return (
        <svg {...p}>
          <path d="M9 18V5l10-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="16" cy="16" r="3" />
        </svg>
      );
    case 'music-fill':
      return (
        <svg {...f}>
          <path d="M20 3.2a1.2 1.2 0 0 0-1.46-1.17l-10 2.2A1.2 1.2 0 0 0 7.6 5.4v9.04A4.2 4.2 0 1 0 10 18.2V9.16l8-1.76v4.28A4.2 4.2 0 1 0 20 15.5V3.2Z" />
        </svg>
      );
    case 'cog':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V20a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 18.35a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 14a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 3.6a1.7 1.7 0 0 0 1.03-1.56V2a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 3.65a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 8v.05A1.7 1.7 0 0 0 21 9.09H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03Z" />
        </svg>
      );
    case 'cog-fill':
      return (
        <svg {...f}>
          <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm9.3 5.2-.9-.52a7.6 7.6 0 0 0 0-2.36l.9-.52a1.3 1.3 0 0 0 .48-1.78l-1.2-2.08a1.3 1.3 0 0 0-1.78-.48l-.9.52a7.7 7.7 0 0 0-2.05-1.18V4.3a1.3 1.3 0 0 0-1.3-1.3h-2.4a1.3 1.3 0 0 0-1.3 1.3v1.04A7.7 7.7 0 0 0 7.1 6.5l-.9-.52a1.3 1.3 0 0 0-1.78.48l-1.2 2.08a1.3 1.3 0 0 0 .48 1.78l.9.52a7.6 7.6 0 0 0 0 2.36l-.9.52a1.3 1.3 0 0 0-.48 1.78l1.2 2.08a1.3 1.3 0 0 0 1.78.48l.9-.52a7.7 7.7 0 0 0 2.05 1.18v1.04a1.3 1.3 0 0 0 1.3 1.3h2.4a1.3 1.3 0 0 0 1.3-1.3v-1.04a7.7 7.7 0 0 0 2.05-1.18l.9.52a1.3 1.3 0 0 0 1.78-.48l1.2-2.08a1.3 1.3 0 0 0-.48-1.78Z" />
        </svg>
      );
    case 'chev-left':
      return (
        <svg {...p}>
          <path d="M15 5l-7 7 7 7" />
        </svg>
      );
    case 'chev-right':
      return (
        <svg {...p}>
          <path d="M9 5l7 7-7 7" />
        </svg>
      );
    case 'chev-down':
      return (
        <svg {...p}>
          <path d="M5 9l7 7 7-7" />
        </svg>
      );
    case 'search':
      return (
        <svg {...p}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...p}>
          <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5 8.5 8.5 0 1 0 20.5 14.3Z" />
        </svg>
      );
    case 'lock':
      return (
        <svg {...p}>
          <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
          <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
        </svg>
      );
    case 'type':
      return (
        <svg {...p}>
          <path d="M4 6.5V5h16v1.5M9 19h6M12 5v14" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...p}>
          <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
        </svg>
      );
    case 'check':
      return (
        <svg {...p}>
          <path d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'pencil':
      return (
        <svg {...p}>
          <path d="M16.5 4.5l3 3L8 19l-4 1 1-4Z" />
        </svg>
      );
    case 'columns':
      return (
        <svg {...p}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <path d="M12 4.5v15" />
        </svg>
      );
    case 'people':
      return (
        <svg {...p}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.2a3.2 3.2 0 0 1 0 6M16.5 14c2.5.3 4 2.2 4 5" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      );
    case 'pin':
      return (
        <svg {...p}>
          <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.6" />
        </svg>
      );
    case 'link':
      return (
        <svg {...p}>
          <path d="M9.5 14.5l5-5" />
          <path d="M11.5 7.5l1-1a4 4 0 0 1 5.66 5.66l-1 1" />
          <path d="M12.5 16.5l-1 1a4 4 0 0 1-5.66-5.66l1-1" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...p}>
          <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
        </svg>
      );
    case 'heading':
      return (
        <svg {...p}>
          <path d="M6 4v16M18 4v16M6 12h12" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...p}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    default:
      return null;
  }
}
