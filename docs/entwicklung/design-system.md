# Design-System (ChurchTools-Look)

Verbindliche Regeln für das Aussehen. Ziel: Farben/Abstände kommen aus **einer Quelle**,
damit nichts „durchsickert" (z. B. früher Orange).

## Farben – nur über Tokens

Einzige Quelle: `client/src/styles/_variables.scss` (Light = `:root`, Dark = `html[data-theme='dark']`).
**Einzige Ausnahme: `--sat`** (Safe-Area oben) wird in JS gemessen – siehe Tabelle unten und die Regel
am Ende dieses Dokuments.
**Keine rohen Hex-/rgba-Werte in Komponenten** (Ausnahmen: reine Schatten, Overlays, `#fff` auf farbigen Flächen).

| Token                                   | Zweck                                                                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--bg`                                  | Seitenhintergrund                                                                                                                                           |
| `--surface2`                            | Karten / Listen / Header                                                                                                                                    |
| `--surface3`                            | Sekundärflächen (Suche, Kacheln, Pills, Segmente)                                                                                                           |
| `--border` / `--hair`                   | Rahmen / 1px-Trenner                                                                                                                                        |
| `--text` / `--text2` / `--text3`        | Primär / Sekundär / Tertiär                                                                                                                                 |
| `--blue` / `--blue-ink` / `--blue-soft` | **Primär**: Buttons, Links, aktive Tabs, Akzente                                                                                                            |
| `--red`                                 | **Destruktiv**: Abmelden, Löschen, offene Dienste                                                                                                           |
| `--seg-on` / `--track-off`              | aktives Segment / Toggle-Schiene                                                                                                                            |
| `--scrim`                               | Overlay hinter Sheets/Dialogen                                                                                                                              |
| `--nav-bg` / `--shadow`                 | Leisten (Blur) / Karten-Schatten                                                                                                                            |
| `--ui`                                  | System-Schriftfamilie (kein Web-Font)                                                                                                                       |
| `--kb`                                  | **Höhe der iOS-Tastatur** – wird von `hooks/useKeyboardInset` am `visualViewport` gemessen (nur auf Dialog-Overlays gesetzt, siehe Regel unten)             |
| `--sat`                                 | **stabile iOS-Safe-Area oben** – Ausnahme: wird in `client/src/main.tsx` per verstecktem Probe-Element **in JS gemessen**, steht NICHT in `_variables.scss` |

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
  `key-pill`, `neues-lied-aktion` (die ruhige Textaktion „Neues Lied" – im Liederheft **und** im
  „Lied hinzufügen"-Blatt, deshalb geteilt). In Modulen:
  `@use '../styles/mixins' as m;` → `@include m.card-list;`.
- **Komponenten:** `Segment` (Auswahl 2–3 Optionen), `NoteTile` (Noten-Kachel),
  `Icon` (`components/icons.tsx`, Line-Icons – keine Emojis in der UI), `NavBar`, `TabBar`,
  `Sheet`, `ConfirmDialog`, `SongFields` (die Stammdaten-Felder eines Liedes – von „Neues Lied" und
  „Stammdaten ändern" gemeinsam genutzt, damit es die fünf Felder nur einmal gibt).
- **Lied suchen – ein Kopf für alle drei Stellen** (#378): `LiedSucheKopf` (Suchfeld + Quellen-`Segment`)
  mit `LiedTreffer.module.scss` für die Trefferzeilen von „Liedtexte" und „SongSelect". Vorher hatte
  jede Ansicht ihre eigene Kopie des Suchfelds (`AllSongs` und `SongPicker` je eine, dazu eine dritte
  Zeile in `NewSongSheet`). **Regel daraus:** Das Suchfeld gibt es nur noch hier – wer eine vierte Suche
  braucht, nimmt den Kopf, statt seine Optik nachzubauen.
  Der Umschalter erscheint nur bei **mehr als einer** Quelle, und die Sortierleiste (`SongStatsBar`) nur
  bei der Bibliothek: Eine Leiste, die nichts bewirkt, ist schlimmer als keine.

## Theme

Hell/Dunkel/Auto über `useSettings` → `data-theme` auf `<html>`. Komponenten dürfen sich
**nicht** selbst um Dark Mode kümmern – die Tokens schalten um. Falls doch nötig:
`:global(html[data-theme='dark'])` nur als letzte Option.

## Abstand nach oben (Safe Area) – verbindlich

Kopfleisten und alles, was direkt unter der Statusleiste sitzt (Banner, Dropdowns), verwenden
**immer**:

```scss
padding-top: max(20px, var(--sat, env(safe-area-inset-top, 0px)));
// bzw. bei absolut positionierten Elementen:
top: calc(max(20px, var(--sat, env(safe-area-inset-top, 0px))) + Npx);
```

**Nie `env(safe-area-inset-top)` direkt** (#187): iOS setzt den Wert beim Schließen eines modalen
Dialogs kurz auf `0` zurück – mit `env()` schrumpft die Leiste im Transient von ~59px auf 20px und
die ganze Kopfleiste springt sichtbar. `client/src/main.tsx` misst den echten Wert über ein
verstecktes Probe-Element und hält ihn stabil in `--sat`; nur eine echte Orientierungsänderung darf
ihn senken (im Querformat gibt es oben oft keine Safe Area). Der `20px`-Boden fängt zusätzlich den
Safari-Tab-Fall ab (`env()` ist dort immer `0`), `env()` bleibt Fallback, solange `--sat` noch nicht
gemessen wurde → keine Regression auf Geräten ohne Safe Area.

Betroffene Module: `components/NavBar.module.scss`, `components/AblaufChangedBanner.module.scss`,
`components/ChordEditor.module.scss`, `pages/ChordChart.module.scss` (Header + beide Dropdowns).

## Dialoge über der Tastatur (Safe Area unten) – verbindlich

Jedes Vollbild-Overlay mit Eingabefeldern (`Sheet`, `ItemActionSheet`, `ChordEditor`) ist
**`position: fixed`** – NIE `absolute`, sonst scrollt es mit dem Dokument mit, wenn iOS beim
Fokussieren die Seite hochschiebt – und spart die Tastatur aus:

```scss
padding-bottom: calc(16px + var(--kb, 0px));
```

`--kb` liefert der Hook `hooks/useKeyboardInset` (Messung am `visualViewport`); er holt zusätzlich den
von iOS hinterlassenen Dokument-Scroll zurück. Ohne beides liegen Trefferlisten und Knöpfe unter der
Tastatur, und die Kopfleiste bleibt nach dem Schließen verrutscht (#207).
