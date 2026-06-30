# Konfigurationsmanagement & Umgebungen

An die DB-lose Realität dieses Projekts angepasst (kein eigener Datenbestand,
ChurchTools ist Datenquelle).

## Konfigurationselemente
- Code (`client/`, `server/`, `shared/`)
- Doku (`README.md`, `INSTALL.md`, `UPDATE.md`, `CHANGELOG.md`, `CLAUDE.md`, `docs/`)
- Tests (`client/src/utils/*.test.ts`) + Testkonzept (`docs/entwicklung/testkonzept.md`)
- `.env.example`, Deploy-Dateien (`Dockerfile`, `docker-compose.dev.yml`, `deploy/`)
- CI/CD (`.github/workflows/`: `ci.yml`, `staging.yml`, `release.yml`), Issue-Vorlagen (`.github/ISSUE_TEMPLATE/`)
- Laufzeit-Konfiguration der Instanz (`site.json` auf dem Volume: Gemeindename + Links)

## Versionierung
- Ein **öffentliches** Git-Repo (`FAlwin/churchtools-musik-app`), MIT-Lizenz.
- Arbeit immer in Feature-Branch + PR, nie direkt auf `main`.
- `.env` wird **nie** committet – nur `.env.example` mit Platzhaltern.
- Releases als Git-Tag `vX.Y.Z` (SemVer) → CI baut die GHCR-Images.

## Baselines
- Gemergter `main` ist die jeweils gültige Baseline.
- Größere Releases bei Bedarf mit Git-Tag markieren.

## Umgebungen
| Umgebung | Datenquelle | Zweck |
|----------|-------------|-------|
| Dev       | ChurchTools (über persönlichen Login) | lokale Entwicklung (`npm run dev`) |
| Unit-Test | keine – reine Logik | automatisierte Unit-Tests (`npm test`) |
| Staging   | ChurchTools | NAS-Test-Instanz `:3002` (`:staging`-Image, Auto-Deploy bei Push auf `main`) |
| Prod      | ChurchTools | NAS, intern `:3001` + extern `musik.ecg-donrath.de` (`:latest`/`:2`, Deploy bei Tag) |

Vor einem Tag lokal `npm run build` + `npm test` grün, dann auf der Staging-Instanz abnehmen
(Auto-Deploy via GHCR), erst danach taggen. Setup/Deployment: `INSTALL.md`,
Quellcode-Variante `docs/betrieb/DEPLOYMENT.md`.

## Nachverfolgbarkeit
`Anforderung (PROJEKTPLAN/DoD) → Issue → Commit/PR (Fixes #) → ggf. Test`.
