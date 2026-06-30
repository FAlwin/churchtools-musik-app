# Updates einspielen

Jede Gemeinde aktualisiert **selbst und wann sie möchte** (am besten nicht während der
Gottesdienstzeit). Neue Versionen erscheinen als fertiges Image automatisch mit jedem Release –
ihr müsst nicht einzeln beliefert werden.

## Einfachste Variante: Doppelklick (Mac / Windows)

Im `deploy/`-Ordner liegt ein Update-Skript – einfach doppelklicken:

- **macOS:** `update.command`
- **Windows:** `update.bat`

Es holt die neue Version, startet die App neu und räumt alte Images auf – die Daten bleiben erhalten.

## Standard-Update (manuell / NAS)

Im Ordner mit eurer `docker-compose.yml` und `.env`:

```bash
docker compose pull      # neue Image-Version holen
docker compose up -d      # Container neu erstellen
docker image prune -f     # optional: altes Image aufräumen
```

> **Das Daten-Volume `musik-data` NICHT löschen.** Dort liegen eure Einstellungen
> (Gemeindename, Links). Nur `docker compose pull` + `up -d` anwenden – dann bleiben sie erhalten.

## Welche Version zieht ihr? (Image-Tag)

In der `docker-compose.yml` steht hinter `image:` ein Tag. Empfohlen ist **`:2`**:

```yaml
image: ghcr.io/falwin/churchtools-musik-app:2
```

| Tag | Bedeutung |
|---|---|
| **`:2`** (empfohlen) | Alle Updates der Version 2 (Funktionen + Bugfixes), **kein** ungewollter Sprung auf v3 |
| `:2.1.7` | Eine ganz feste Version – ändert sich nie von selbst (volle Kontrolle) |
| `:latest` | Immer das Allerneueste, **inklusive** großer Umstellungen (v3 …) |

Ein Sprung auf eine größere Version (z. B. von `:2` auf `:3`) ist damit immer eine **bewusste**
Entscheidung – Tag ändern, vorher kurz ins [CHANGELOG.md](CHANGELOG.md) schauen, dann aktualisieren.

## Was ist neu?

Die Änderungen je Version stehen im **[CHANGELOG.md](CHANGELOG.md)**. Versionierung nach SemVer:

- `vX.Y.**Z**` – Bugfix (gefahrlos)
- `vX.**Y**.0` – neue Funktion (abwärtskompatibel)
- `v**X**.0.0` – größere Umstellung (vor dem Update kurz ins CHANGELOG schauen)
