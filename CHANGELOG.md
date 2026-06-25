# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier festgehalten.
Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [SemVer](https://semver.org/lang/de/):
`MAJOR.MINOR.PATCH` – z. B. `v2.1.0` = Feature, `v2.1.1` = Bugfix, `v3.0.0` = größere Umstellung.

## [Unreleased]

## [2.1.1] – 2026-06-25

### Behoben

- **Festhängender Zoom in der Strom-/Mehrseiten-Ansicht (iPad):** Eine reingezoomte Seite konnte
  „kleben" bleiben – besonders, wenn ein gespeicherter Zoom beim Öffnen wiederhergestellt wurde
  (dann gab es keinen sichtbaren Ausweg). Neu erscheint ein Knopf **„Zoom zurücksetzen"**, sobald
  eine Seite vergrößert ist; ein Tipp setzt die Seite auf Normalgröße zurück **und** löscht ihren
  gespeicherten Zoom dauerhaft. Pinch-Zoom und das bewusste Speichern eines Ausschnitts bleiben
  unverändert.

## [2.1.0] – 2026-06-25

### Neu

- **Mehrere benannte Lied-Versionen:** Statt nur „Original/Bearbeitet" lassen sich pro Lied
  beliebig viele benannte Versionen anlegen (z. B. „Akustik", „Jugend"), umschalten, umbenennen
  und löschen. Versionen liegen im ChurchTools-Arrangement und sind für das ganze Team sichtbar.
  Tonart, Kapo, Spalten, Schrift, Abschnitts-Transponierung **und Anmerkungen gelten je Version**.
- **Persönliches Setup pro Konto (geräteübergreifend):** Anmerkungen (Stift/Text), Zoom sowie die
  Lied-Einstellungen werden jetzt am ChurchTools-Konto auf dem Server gespeichert und synchronisiert
  (vorher nur lokal pro Gerät). **Musikalische Einstellungen** (Tonart, Kapo, Abschnitte, gewählte
  Version, Nur-Text, Anzeige) gelten auf allen Geräten gleich. **Display-abhängige Einstellungen**
  (Spalten, Schrift, Zoom) werden **pro Gerätetyp** geteilt – Handy und „Tablet/Computer" getrennt,
  damit z. B. 2 Spalten vom iPad nicht auf dem Handy landen. Aktualisiert sich automatisch (alle
  30 s bzw. beim Zurückkehren zur App); vorhandene Geräte-Daten werden beim ersten Start übernommen.
- **Akkord-Ansicht als PDF (SongSelect-Look):** Jedes Lied wird aus dem ChordPro-Text als
  sauberes PDF erzeugt und angezeigt. Komplett **schwarz** (saubere S/W-Ausdrucke), deutliche
  Abschnitts-Labels (Vers/Refrain), Kopfzeile mit Tonart/Taktart/BPM und dem
  **ChurchTools-Musik-App-Logo oben rechts**. Lange Zeilen werden umbrochen, Abschnitte bleiben
  zusammen, 2-spaltiger Satz ohne Überlappung.
- **Zoom als Modus:** Pinch zum Zoomen, dann **✓ (Fertig) / ✗ (Zurück)** zum Festsetzen der
  Ansicht – danach funktionieren Wischen und Tippen wieder normal. Der Zoom wird **pro Lied-Seite
  dauerhaft gespeichert** (kein blauer Aktiv-Balken im Live-Betrieb).
- **2-Seiten-Querformat-Strom:** Im Querformat laufen zwei Seiten nebeneinander als ein Strom
  über den ganzen Ablauf; jede Seite ist ein eigener Bereich mit eigenem Zoom. Seiten auf leicht
  grauem Grund mit Mittelstreifen (Seitenränder beim Zeichnen sichtbar); eine einzelne Seite ist
  linksbündig, das letzte Lied steht nie allein (rechts, vorheriges links).
- **Volle Anmerkungen pro Lied-Seite:** Stift, Marker (glatter Leuchtstrich), Radierer (Farben
  Schwarz/Rot/Gelb), Textfelder sowie **Rückgängig/Wiederholen** – pro Version gespeichert.
- **Ablauf-Export als PDF** (Teilen-Symbol) – exportiert die Lieder genau wie angezeigt.

### Geändert

- **Viewer-Hintergrund** der Akkord-Ansicht jetzt leicht grau (statt weiß) + dezenter Seitenschatten,
  damit beim Zeichnen die Seitenränder klar erkennbar sind.
- **App-Logo** im PDF eng in die obere rechte Ecke gesetzt (eigene, zugeschnittene Logo-Variante
  ohne transparenten Rand; das App-Icon bleibt unverändert).
- **Auslieferung Test-Instanz:** Auto-Deploy über ein `:staging`-Image (GitHub-CI) + Watchtower auf
  dem NAS – kein manueller Container-Neubau mehr (siehe `deploy/docker-compose.staging.yml`).
- **Wartung:** Build-Werkzeug **Vite auf 8** angehoben (inkl. Vitest 3, `@vitejs/plugin-react`,
  `vite-plugin-pwa`). Behebt die zurückgestellten `npm audit`-Findings in `esbuild` (betrafen nur
  den lokalen Dev-Server, kein Produktivrisiko): von 7 Hinweisen (u. a. „high"/„critical") auf 1
  „low" (Windows-only Dev-Server). Build/Tests (44)/Lint grün. Keine Änderung am App-Verhalten.
- Basis-Image und CI auf **Node 22** (Vite 8 setzt Node ≥ 20.19 voraus).
- Vitest: deprecated `environmentMatchGlobs` entfernt – Komponenten-Tests setzen ihre
  jsdom-Umgebung per `// @vitest-environment`-Docblock.

### Behoben

- **Anmerkungen zuverlässiger:** kein Festhängen mehr (Pointer-Capture, nur Primär-Finger,
  Abbruch-Behandlung); über Textfeldern kann nun mit Stift/Marker gezeichnet werden.
- **Marker** zeichnet wieder einen glatten, gleichmäßigen Leuchtstrich (kein „Gepunktel" mehr).
- **Textfelder:** ließen sich nicht platzieren (Text-Ebene war 0×0) – behoben. Nach dem Eintippen
  ist der Text ausgewählt (Bearbeiten-/Verschieben-Rahmen); ein Klick ins Leere schließt nur das
  Eingabefeld bzw. hebt die Auswahl auf, statt ein neues Feld anzulegen oder den Text zu verschieben.
- **Auto-Auffrischung** überschreibt keine gerade gemachten Anmerkungen/Einstellungen mehr, bevor
  sie hochgeladen sind (Text bleibt stehen, „Alles löschen" wird nicht wieder zurückgeholt).
- **Letztes Lied** im 2-up-Querformat steht jetzt rechts (vorheriges links) statt allein links.
- **„Link hinzufügen"** stürzt nicht mehr ab, wenn die App über HTTP läuft (`crypto.randomUUID`
  nur im sicheren Kontext – Fallback ergänzt).
- Akkord-Seiten füllen im **Hoch- und Querformat** korrekt die Höhe (kein zu kleines Dokument).
- Rand-Tippen überspringt keine zweite Seite mehr; nach Rückkehr in die App stimmt die
  Querformat-Ansicht wieder.
- Liederliste: runder **Hinzufügen-Knopf** statt eckigem Kasten, einheitliche Zeilenhöhen;
  keine ungewollte vertikale Scroll-Bewegung der ganzen WebApp mehr.

## [2.0.1] – 2026-06-22

### Behoben

- **iOS-PWA-Layout (Homescreen/Standalone):** App füllt jetzt zuverlässig den vollen Bildschirm
  in **beiden** Ausrichtungen. Ursachen behoben:
  - `100dvh` aktualisierte sich beim Drehen nicht (Tab-Leiste rutschte im Querformat unter den
    Bildschirm) → App-Höhe wird jetzt aus `window.innerHeight` gesetzt (`--app-h`, mehrfach
    nachgesetzt bei `load`/`pageshow`/rAF) **plus** der unteren Safe-Area, die `innerHeight` im
    Standalone-Modus ausschließt (sonst dunkler Streifen unter der Leiste).
  - Detailansichten (Setlist/Chart) richteten ihr `position:absolute`-Layout am Layout-Viewport
    aus (ohne untere Safe-Area) → `#root` ist jetzt Bezugsrahmen, die Ansichten füllen die volle
    Höhe (kein leerer Balken / dunkler Streifen mehr).
  - Scrollbereiche bekommen unten Platz, damit der letzte Eintrag über den Home-Strich hinaus
    scrollbar ist.
- **Chord-Chart-Footer** springt nicht mehr zwischen 1- und 2-zeiligen „Nächstes Lied"-Titeln
  (feste Mindesthöhe, max. 2 Zeilen) und sitzt mit stabilem Abstand über dem Home-Strich.
- Tab-Leiste: Abstand der Symbole über dem Home-Strich vereinheitlicht und feinjustiert.

## [2.0.0] – 2026-06-19

Erster **öffentlicher** Release, für die Verteilung an andere Gemeinden
(jede Gemeinde betreibt ihre eigene, autarke Instanz desselben Codes).

### Geändert
- **ChurchTools-Look** als feste App-Optik (Tab-Navigation, neue Farb-/Schrift-Tokens,
  Light/Dark). Die frühere White-Label-Idee (Theming pro Gemeinde) ist verworfen.
- **Von ECG entkoppelt:** `CHURCHTOOLS_BASE_URL` ist Pflichtfeld ohne Default (die App
  startet nicht ohne eigene URL), Gemeindename-Default neutral, Titel generisch.
- Feature „bearbeitete Songversion" intern neutral benannt (vorher überall „ECG"); der
  Datei-Suffix heißt jetzt `— Bearbeitet.chordpro`. Alte `— ECG.chordpro`-Dateien werden
  weiterhin erkannt und beim nächsten Speichern automatisch übernommen.

### Hinzugefügt
- **Verteilung per fertigem Image:** automatischer Build bei jedem Versions-Tag
  (`v*`) → Multi-Arch-Image (amd64 **und** arm64) nach GHCR.
- End-User-Verteilpaket unter `deploy/` (image-basiertes `docker-compose.yml` + `.env.example`).
- **Frei konfigurierbare Links** (Mehr-Tab + optional Login-Seite), pro Instanz anpassbar.
- **Dokumentation:** `README.md`, `INSTALL.md`, `UPDATE.md` und interne Onboarding-Checkliste.
- **MIT-Lizenz** + Disclaimer (inoffizielles Community-Projekt, nicht mit der ChurchTools GmbH verbunden).

## [1.0.0] – 2026-06-18

- Internes/privates Release der App (Setlist aus ChurchTools, Auto-Transponierung,
  ChordPro-Editor, Dokumenten-Viewer, rechtebewusste UI). Produktiv für die ECG Donrath.
