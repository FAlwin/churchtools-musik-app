# API des eigenen Backends

> Referenz der Endpunkte, die das Express-Backend dem Client anbietet (ausgelagert aus `CLAUDE.md`).
> ChurchTools-spezifische Schreib-/Lese-Eigenheiten stehen weiterhin in `CLAUDE.md`.

- `GET  /api/site-config` → `{ appName, description, orgName }` (öffentlich, für Login/Mehr)
- `PUT  /api/site-config` → Gemeinde-Name speichern (nur Admin, Zod-validiert)
- `POST /api/auth/login` {email, password} → `{authenticated, user}` + setzt Session-Cookie
- `POST /api/auth/logout` → Session löschen
- `GET  /api/auth/me` → `{authenticated, user?}`
- `GET  /api/capabilities` → Rechte des Nutzers (view/edit agenda, view/edit songcategory) → steuert UI
- `GET  /api/services?from=&to=` → `Service[]` (nur mit Setlist; Default-Fenster -7d…+42d)
- `GET  /api/services/:eventId/setlist` → kompletter Ablauf (`AgendaItem[]`, Lieder mit `chordpro` (Original) + `versions[]` + documents[])
- `PATCH /api/services/:eventId/agenda/order` → Reihenfolge zurückschreiben (ganze Liste)
- `POST/PUT/DELETE /api/services/:eventId/agenda/items[/:itemId]` → Ablaufpunkt anlegen/ändern/löschen (PUT-Felder u.a. `title`, `responsible`, `arrangementId`, `unlink`, `durationMin` → CT-Sekunden)
- `PUT  /api/services/:eventId/agenda/items/:itemId/hidden` {hidden} → Uhrzeit aus-/einblenden (CT-„Auge", hide/unhide)
- `GET  /api/songs?query=` → Songsuche (Lied zum Ablauf hinzufügen)
- `GET  /api/song-library` → alle Lieder (Ansicht „Alle Lieder")
- `GET  /api/song-usage` → Nutzungsstatistik letzte 12 Monate (1h-Cache)
- `GET  /api/songs/:songId/chart` → Chart eines einzelnen Lieds (aus „Alle Lieder")
- `POST /api/songs/:songId/versions` {arrangementId, name, text} → neue benannte Version anlegen → `SongVersion`
- `PUT  /api/songs/:songId/versions/:versionKey` {arrangementId, text?, name?} → Version aktualisieren/umbenennen
- `DELETE /api/songs/:songId/versions/:versionKey` {arrangementId} → Version löschen (Original bleibt)
- `GET  /api/songs/:songId/files/:fileId` → PDF/Bild aus ChurchTools durchreichen (Viewer)
- `GET  /api/annotations?songs=` / `PUT /api/annotations/:key` / `DELETE …/:key` → Anmerkungen+Zoom pro Konto (Feld-Merge strokes/texts/zoom; key `song<id>_v<ver>_<seite>[_d<class>]`)
- `GET  /api/settings?songs=` / `PUT /api/settings` → Lied-Einstellungen pro Konto (Schlüssel-Wert, Merge)
