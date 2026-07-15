# Design-System (ChurchTools-Look)

Verbindliche Regeln für das Aussehen. Ziel: Farben/Abstände kommen aus **einer Quelle**,
damit nichts „durchsickert" (z. B. früher Orange).

## Farben – nur über Tokens
Einzige Quelle: `client/src/styles/_variables.scss` (Light = `:root`, Dark = `html[data-theme='dark']`).
**Keine rohen Hex-/rgba-Werte in Komponenten** (Ausnahmen: reine Schatten, Overlays, `#fff` auf farbigen Flächen).

| Token | Zweck |
|---|---|
| `--bg` | Seitenhintergrund |
| `--surface2` | Karten / Listen / Header |
| `--surface3` | Sekundärflächen (Suche, Kacheln, Pills, Segmente) |
| `--border` / `--hair` | Rahmen / 1px-Trenner |
| `--text` / `--text2` / `--text3` | Primär / Sekundär / Tertiär |
| `--blue` / `--blue-ink` / `--blue-soft` | **Primär**: Buttons, Links, aktive Tabs, Akzente |
| `--red` | **Destruktiv**: Abmelden, Löschen, offene Dienste |
| `--seg-on` / `--track-off` | aktives Segment / Toggle-Schiene |
| `--scrim` | Overlay hinter Sheets/Dialogen |
| `--nav-bg` / `--shadow` | Leisten (Blur) / Karten-Schatten |
| `--ui` | System-Schriftfamilie (kein Web-Font) |

**Es gibt bewusst KEIN `--orange`, `--teal`, `--chord`.** Akzent = Blau, Destruktiv = Rot.
Wer eine „auffällige" Farbe braucht: `--blue` (Aktion) oder `--red` (Warnung/Destruktiv).

Akkorde/Anmerkungen: Akkorde im Chart sind **schwarz/fett** (SongSelect-Stil). Die
Anmerkungs-Stiftfarben (Palette inline in `pages/ChordChart.tsx`) sind
**Rot `#bb2946`, Blau `#0062ac`, Türkis `#1bb0a2`, Orange `#fb8f00`** – Standard Blau,
plus freier Farbwähler.

## Schrift
System-Font über `var(--ui)`. Kein Google-Font-Import. Ausnahme: der ChordPro-**Editor**
nutzt bewusst Monospace (`'JetBrains Mono', monospace`) für die Roh-Bearbeitung.

## Wiederverwendbare Bausteine
- **SCSS-Mixins** (`client/src/styles/_mixins.scss`): `card-list`, `group-header`, `list-row`,
  `key-pill`. In Modulen: `@use '../styles/mixins' as m;` → `@include m.card-list;`.
- **Komponenten:** `Segment` (Auswahl 2–3 Optionen), `NoteTile` (Noten-Kachel),
  `Icon` (`components/icons.tsx`, Line-Icons – keine Emojis in der UI), `NavBar`, `TabBar`,
  `Sheet`, `ConfirmDialog`.

## Theme
Hell/Dunkel/Auto über `useSettings` → `data-theme` auf `<html>`. Komponenten dürfen sich
**nicht** selbst um Dark Mode kümmern – die Tokens schalten um. Falls doch nötig:
`:global(html[data-theme='dark'])` nur als letzte Option.
