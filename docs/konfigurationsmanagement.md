# Konfigurationsmanagement & Umgebungen

An die DB-lose Realität dieses Projekts angepasst (kein eigener Datenbestand,
ChurchTools ist Datenquelle).

## Konfigurationselemente
- Code (`client/`, `server/`, `shared/`)
- Doku (`CLAUDE.md`, `PROJEKTPLAN.md`, `docs/`, `DEPLOYMENT.md`, `WHITE-LABEL.md`)
- Tests (`client/src/utils/*.test.ts`) + Testkonzept (`docs/testkonzept.md`)
- `.env.example`, Deploy-Dateien (`Dockerfile`, `docker-compose.yml`)
- CI (`.github/workflows/ci.yml`), Issue-Vorlagen (`.github/ISSUE_TEMPLATE/`)
- Branding/Konfiguration (`client/src/config/branding.ts`)

## Versionierung
- Ein Git-Repo (`FAlwin/churchtools-musik-app`, privat).
- Arbeit immer in Feature-Branch + PR, nie direkt auf `main`.
- `.env` wird **nie** committet – nur `.env.example` mit Platzhaltern.

## Baselines
- Gemergter `main` ist die jeweils gültige Baseline.
- Größere Releases bei Bedarf mit Git-Tag markieren.

## Umgebungen
| Umgebung | Datenquelle | Zweck |
|----------|-------------|-------|
| Dev      | ChurchTools (über persönlichen Login) | lokale Entwicklung (`npm run dev`) |
| Test     | keine – reine Logik | automatisierte Unit-Tests (`npm test`) |
| Prod     | ChurchTools | NAS, intern `:3001` + extern `musik.ecg-donrath.de` |

Kein Staging: Die App hält keinen eigenen Datenbestand; Risiko bei Updates liegt im
Code, nicht in Daten. Vor einem Update lokal `npm run build` + `npm test` grün,
dann auf das NAS deployen (siehe `DEPLOYMENT.md`).

## Nachverfolgbarkeit
`Anforderung (PROJEKTPLAN/DoD) → Issue → Commit/PR (Fixes #) → ggf. Test`.
