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
  | 'external'
  | 'share'
  | 'trash'
  | 'heading'
  | 'plus'
  | 'marker'
  | 'eraser'
  | 'eye'
  | 'eye-off'
  | 'zoom-reset'
  | 'download'
  | 'undo'
  | 'redo'
  | 'grip'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'cloud-check';

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
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.3 7.3 0 0 0-1.69-.98l-.38-2.65a.49.49 0 0 0-.49-.42h-4a.49.49 0 0 0-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.14.24.42.32.61.22l2.49-1c.52.39 1.08.73 1.69.98l.38 2.65c.04.24.25.42.49.42h4c.24 0 .45-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.19.1.47.02.61-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
          />
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
    case 'zoom-reset':
      return (
        <svg {...p}>
          <circle cx="10" cy="10" r="7" />
          <path d="M20 20l-4.3-4.3" />
          <path d="M7.6 9.2V7.6H9.2" />
          <path d="M10.8 7.6H12.4V9.2" />
          <path d="M7.6 10.8V12.4H9.2" />
          <path d="M12.4 10.8V12.4H10.8" />
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
          <path d="M21.17 6.81a1 1 0 0 0-3.98-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5Z" />
          <path d="m15 5 4 4" />
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
    case 'eye':
      return (
        <svg {...p}>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="2.8" />
        </svg>
      );
    case 'eye-off':
      return (
        <svg {...p}>
          <path d="M4 12s3.5-6.5 8-6.5c1.3 0 2.5.3 3.5.8M20 12s-1.2 2.2-3.3 3.9" />
          <path d="M9.8 9.9a2.8 2.8 0 0 0 3.9 3.9" />
          <path d="M4.5 4.5l15 15" />
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
    case 'external':
      return (
        <svg {...p}>
          <path d="M14 5h5v5M19 5l-8 8" />
          <path d="M18 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.5" />
        </svg>
      );
    case 'share':
      return (
        <svg {...p}>
          <path d="M12 3v13" />
          <path d="M8 7l4-4 4 4" />
          <path d="M6 12H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1" />
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
    case 'marker':
      return (
        <svg {...p}>
          <path d="m9 11-6 6v3h9l3-3" />
          <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
        </svg>
      );
    case 'eraser':
      return (
        <svg {...p}>
          <path d="m7 21-4.3-4.3a1.7 1.7 0 0 1 0-2.4l9.3-9.3a1.7 1.7 0 0 1 2.4 0l5.6 5.6a1.7 1.7 0 0 1 0 2.4L13 21Z" />
          <path d="M22 21H7" />
          <path d="m5 11 9 9" />
        </svg>
      );
    case 'download':
      return (
        <svg {...p}>
          <path d="M12 3v12M8 11l4 4 4-4" />
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
      );
    // Wolke mit Häkchen: „liegt offline vor" (Termin-Badge, #32).
    case 'cloud-check':
      return (
        <svg {...p}>
          <path d="M17.5 18.5a4.3 4.3 0 0 0 .4-8.6 6 6 0 0 0-11.8 1.2 3.8 3.8 0 0 0 .4 7.4h11Z" />
          <path d="m9.2 13.7 2.1 2.1 3.9-3.9" />
        </svg>
      );
    case 'undo':
      return (
        <svg {...p}>
          <path d="M9 7l-5 5 5 5" />
          <path d="M4 12h11a5 5 0 0 1 0 10h-3" />
        </svg>
      );
    case 'redo':
      return (
        <svg {...p}>
          <path d="M15 7l5 5-5 5" />
          <path d="M20 12H9a5 5 0 0 0 0 10h3" />
        </svg>
      );
    case 'grip':
      return (
        <svg {...f}>
          <circle cx="9" cy="6" r="1.6" />
          <circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" />
          <circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" />
          <circle cx="15" cy="18" r="1.6" />
        </svg>
      );
    case 'align-left':
      return (
        <svg {...p}>
          <path d="M4 6h16M4 12h10M4 18h13" />
        </svg>
      );
    case 'align-center':
      return (
        <svg {...p}>
          <path d="M4 6h16M7 12h10M6 18h12" />
        </svg>
      );
    case 'align-right':
      return (
        <svg {...p}>
          <path d="M4 6h16M10 12h10M7 18h13" />
        </svg>
      );
    default:
      return null;
  }
}
