# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier festgehalten.
Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [SemVer](https://semver.org/lang/de/):
`MAJOR.MINOR.PATCH` – z. B. `v2.1.0` = Feature, `v2.1.1` = Bugfix, `v3.0.0` = größere Umstellung.

## [Unreleased] → geplant als v2.0.0

Erster für die Verteilung an andere Gemeinden vorbereiteter Release
(jede Gemeinde betreibt ihre eigene, autarke Instanz desselben Codes).
Wird getaggt, sobald das Repo öffentlich geht (dann auch mit schneller
Multi-Arch-Pipeline über native ARM-Runner).

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
