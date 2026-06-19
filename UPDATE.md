# Updates einspielen

Jede Gemeinde aktualisiert **selbst und wann sie möchte** (am besten nicht während der
Gottesdienstzeit). Neue Versionen erscheinen als fertiges Image automatisch mit jedem Release –
ihr müsst nicht einzeln beliefert werden.

## Standard-Update

Im Ordner mit eurer `docker-compose.yml` und `.env`:

```bash
docker compose pull      # neue Image-Version holen
docker compose up -d      # Container neu erstellen
docker image prune -f     # optional: altes Image aufräumen
```

> **Das Daten-Volume `musik-data` NICHT löschen.** Dort liegen eure Einstellungen
> (Gemeindename, Links). Nur `docker compose pull` + `up -d` anwenden – dann bleiben sie erhalten.

## Auf eine bestimmte Version festlegen (empfohlen für Reproduzierbarkeit)

Standardmäßig zieht das Compose `:latest`. Wer kontrolliert aktualisieren will, trägt eine feste
Version ein:

```yaml
# in docker-compose.yml
image: ghcr.io/falwin/churchtools-musik-app:v2.0.0
```

Zum Aktualisieren dann die Versionsnummer hochsetzen und `docker compose pull && up -d` ausführen.

## Was ist neu?

Die Änderungen je Version stehen im **[CHANGELOG.md](CHANGELOG.md)**. Versionierung nach SemVer:

- `vX.Y.**Z**` – Bugfix (gefahrlos)
- `vX.**Y**.0` – neue Funktion (abwärtskompatibel)
- `v**X**.0.0` – größere Umstellung (vor dem Update kurz ins CHANGELOG schauen)
