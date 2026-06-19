# Verteilung an andere Gemeinden (Selbst-Hosting)

> **Status (19.06.2026): Schritte 1–4 umgesetzt** auf Branch `feature/decouple-ecg`
> (Entkopplung, Image-/Release-Pipeline, Doku, MIT-Lizenz) – noch nicht gepusht/gemergt.
> **Offen: Reihenfolge-Schritt 5** – Branch → main, Tag `v2.0.0`, Repo öffentlich schalten,
> GHCR-Package öffentlich, ECG-Re-Deploy. Dieses Dokument bleibt der Fahrplan dazu.

## Kontext & Abgrenzung
Die **alte** White-Label-Idee (jede Gemeinde passt Farben/Logo selbst an) bleibt **verworfen**
(18.06.2026). Wir haben bewusst **eine feste ChurchTools-Version** mit festem Design.

„Teilen" heißt darum hier **nicht** Theming pro Gemeinde, sondern **Multi-Tenancy durch
getrennte Deployments**: Jede Gemeinde betreibt ihre **eigene, autarke Instanz** desselben
Codes – mit eigener ChurchTools-Verbindung und eigenem Gemeindenamen.

## Getroffene Entscheidungen (19.06.2026)
| Frage | Entscheidung |
|---|---|
| Was darf eine fremde Gemeinde anpassen? | **Nur Gemeindename (`orgName`, In-App) + eigene ChurchTools-Verbindung (`.env`).** Keine Farben/Logo-Anpassung. |
| Verteilungsweg | **Öffentliches GitHub-Repo + fertige, versionierte Docker-Images (GHCR).** |
| Onboarding | **Beides:** schriftliche Self-Service-Anleitung **und** interne Begleit-Checkliste. |
| Betriebsmodell | Alwin bleibt **komplett raus**: keine zentrale Infrastruktur, keine geteilten Secrets, kein Support-Versprechen. |

## Leitprinzip: EINE Codebasis für alle
Die ECG-Instanz und alle fremden Gemeinden laufen auf **demselben Code aus demselben Repo**.
Unterschiede stecken **nur in der Konfiguration**, nicht im Code:

| Was | Wo | ECG | Andere Gemeinde |
|---|---|---|---|
| ChurchTools-URL, `SESSION_SECRET`, Port, Admin-Recht | `.env` (auf dem jeweiligen Server) | eure | ihre |
| Gemeindename | In-App (Admin, „Mehr"-Tab) | „ECG Donrath" | ihr Name |
| Code / Optik / Features | Repo | **identisch** | **identisch** |

→ **Kein Fork, keine zweite „Teil-Version".** Die bereinigte Version *ist* die Version, mit der
auch die ECG läuft. Eine getrennte Distributions-Version zu pflegen wird bewusst vermieden.

---

## Umsetzungs-Fahrplan

### Schritt 1 – Code von ECG entkoppeln (Voraussetzung)
ECG-spezifische Reste müssen raus, bevor das Repo öffentlich gehen kann:

| Stelle | Heute | Soll |
|---|---|---|
| `server/src/config.ts` (`churchtoolsBaseUrl`) | Fallback `https://ecg-donrath.church.tools` | **Pflichtfeld ohne Default** – App startet nicht ohne eigene URL (verhindert, dass eine fehlkonfigurierte fremde Instanz still mit dem ECG-ChurchTools redet) |
| `shared/types/index.ts` (`DEFAULT_SITE_CONFIG.orgName`) | „ECG Donrath" | neutral (z. B. „Meine Gemeinde") |
| `client/index.html` | Titel/Meta „· ECG Donrath" | generisch bzw. aus `orgName` |
| `client/src/pages/Settings.tsx` | evtl. ECG-Texte | generisch |
| Logo/Assets | Schallwellen-Logo | bleibt als neutraler Default (kein ECG-Schriftzug) – ok |

**Secrets-Hygiene (Pflicht vor Veröffentlichung):**
- Git-Historie auf Tokens/Passwörter/`.env` scannen (z. B. `gitleaks detect`).
- `.env` ist per `.gitignore` ausgeschlossen – prüfen, dass nie eine eingecheckt wurde.
- Im Zweifel: mit **frischer Git-History** starten (Repo neu initialisieren) statt History zu bereinigen.

### Schritt 2 – Distribution & Update-Pipeline
- **Image-basiertes `docker-compose.yml`** für Endnutzer (`image: ghcr.io/falwin/churchtools-musik-app:vX`
  statt `build: .`). Das build-basierte Compose bleibt fürs eigene Entwickeln.
- **GitHub Actions:** bei Tag `v*` ein **Multi-Arch-Image** (amd64 **und arm64** – viele NAS sind ARM)
  bauen und nach **GHCR (öffentlich)** pushen.
- **SemVer + CHANGELOG.** `v2.1.0` = Feature, `v2.1.1` = Bugfix, `v3.0.0` = größere Umstellung.

### Schritt 3 – Dokumentation (Beides)
- **`INSTALL.md` (Self-Service):** Voraussetzungen (Docker/NAS, ChurchTools erreichbar),
  `.env` ausfüllen (eigene CT-URL, `SESSION_SECRET` per `openssl rand -hex 32`, `ADMIN_PERMISSION`),
  Container starten, Reverse Proxy + HTTPS, erster Admin-Login → Gemeindename setzen.
- **`UPDATE.md`:** neues Image ziehen, Container neu erstellen, Daten-Volume behalten.
- **Begleit-Checkliste (intern):** was vorab abzufragen ist (CT-URL, welches CT-Recht = Admin,
  Subdomain, wer hat Docker-Zugriff) + typische Stolpersteine (Cookie/HTTPS, CT-Rechte, Proxy-Header).
- **`README.md`** für Außenstehende (Was ist das, Screenshots, Schnellstart, Lizenz, Disclaimer).

### Schritt 4 – Rechtliches
- **`LICENSE`** hinzufügen – Empfehlung **MIT** (erlaubt Nutzung, schließt **Haftung/Gewähr aus**;
  ermöglicht Weiterleben ohne Alwin).
- **Disclaimer** im README: „Inoffizielles Community-Projekt, nicht mit der ChurchTools GmbH
  verbunden. ‚ChurchTools' ist Marke der jeweiligen Inhaber." App-Name beschreibend halten
  („… **für** ChurchTools"), nicht wie ein offizielles CT-Produkt klingen lassen.
- **DSGVO-Hinweis:** jede Gemeinde verantwortet ihre Instanz, ihren CT-Zugang und ihre Daten selbst.

### Reihenfolge der Umsetzung
1. Entkopplung + Secrets-Scan → 2. Image-/CI-Pipeline → 3. Doku → 4. Lizenz/Disclaimer →
5. Repo öffentlich schalten + erstes Release (`v2.x`).

---

## Update-Ablauf in Zukunft (für JEDES Feature/Bugfix)
```
1. Alwin:   Branch → Änderung → PR → merge in main
2. Alwin:   Git-Tag setzen (z. B. v2.1.0)
3. CI:      baut automatisch das Image → GHCR (öffentlich)
4. Alwin:   ECG-Container neu bauen → ECG ist aktuell
5. Andere:  ziehen das neue Image, WANN SIE WOLLEN, und bauen ihren Container neu
```
- „Zur Verfügung stellen" passiert **automatisch** mit dem Tag – niemand muss einzeln beliefert
  werden. CHANGELOG-Eintrag genügt als Info.
- Jede Gemeinde aktualisiert selbst (nicht in der Gottesdienstzeit). Daten-Volume behalten →
  Gemeindename/Einstellungen überleben das Update.
- Dank MIT-Lizenz ist Weiterentwicklung **freiwillig** – pausiert Alwin, laufen alle Instanzen weiter.

## Was „komplett raus sein" technisch absichert
- Kein zentraler Server, kein geteilter Token, **kein Call-Home** – jede App spricht ausschließlich
  mit dem ChurchTools der eigenen Gemeinde.
- Jeder Nutzer meldet sich mit **eigenen ChurchTools-Zugangsdaten** an (Session als signiertes,
  httpOnly-Cookie). Nichts läuft über die ECG.
- Öffentlicher Code + Image-Pipeline = Gemeinden sind voll selbstständig; Alwin ist kein
  Single Point of Failure.

## Risiken (und Schutz)
| Risiko | Schutz |
|---|---|
| Versehentlich Geheimnisse veröffentlicht | Secrets-Scan vor dem Öffentlich-Schalten; `.gitignore`; ggf. frische History |
| Haftung bei fremdem Einsatz | MIT-Lizenz (keine Gewähr) + DSGVO-Hinweis |
| Verwechslung mit offiziellem CT-Produkt | Disclaimer + beschreibender Name |

> Verwandte Doku: Design/Konventionen `docs/design-system.md` · Architektur-Entscheidungen
> `docs/entscheidungen.md` · Konfig/Umgebungen `docs/konfigurationsmanagement.md`.
